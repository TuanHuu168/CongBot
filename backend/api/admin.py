from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Body
from fastapi.responses import FileResponse
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
import os
import json
import time
import uuid
import pandas as pd
import shutil
from pathlib import Path
import threading
import queue
import numpy as np
import tempfile

# Import các service
from services.retrieval_service import retrieval_service
from services.generation_service import generation_service
from services.benchmark_service import benchmark_service
from services.activity_service import activity_service, ActivityType
from services.document_processing_service import document_processing_service
from database.mongodb_client import mongodb_client
from database.chroma_client import chroma_client

# Import config
from config import BENCHMARK_DIR, BENCHMARK_RESULTS_DIR, DATA_DIR, EMBEDDING_MODEL_NAME

VN_TZ = timezone(timedelta(hours=7))

def now_utc():
    return datetime.now(timezone.utc)

benchmark_progress = {}
benchmark_results_cache = {}

# Theo dõi trạng thái xử lý PDF
document_processing_status = {}

router = APIRouter(prefix="", tags=["admin"], responses={404: {"description": "Not found"}})

class BenchmarkConfig(BaseModel):
    file_path: str = "benchmark.json"
    output_dir: str = "benchmark_results"

class DocumentUpload(BaseModel):
    doc_id: str
    doc_type: str
    doc_title: str
    effective_date: str
    status: str = "active"
    document_scope: str = "Quốc gia"

class SystemStatus(BaseModel):
    status: str
    message: str
    database: Dict[str, Any]
    cache_stats: Optional[Dict[str, Any]] = None

class UserFeedback(BaseModel):
    chat_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    is_accurate: Optional[bool] = None
    is_helpful: Optional[bool] = None

class DeleteChatRequest(BaseModel):
    user_id: str

class BatchDeleteRequest(BaseModel):
    user_id: str
    chat_ids: List[str]

# Ghi log các hoạt động của admin
def log_admin_activity(activity_type: ActivityType, description: str, metadata: Dict = None):
    activity_service.log_activity(activity_type, description, metadata=metadata or {})

# Xử lý lỗi chung cho các endpoint
def handle_error(operation: str, error: Exception):
    error_msg = str(error)
    print(f"Lỗi {operation}: {error_msg}")
    log_admin_activity(ActivityType.SYSTEM_STATUS, f"Lỗi {operation}: {error_msg}", 
                      {"error": error_msg, "success": False})
    raise HTTPException(status_code=500, detail=error_msg)

# Các endpoint quản lý hệ thống
@router.get("/status", response_model=SystemStatus)
async def get_admin_status():
    try:
        collection = chroma_client.get_collection()
        collection_count = collection.count()
        
        db = mongodb_client.get_database()
        cache_stats = retrieval_service.get_cache_stats()
        
        return {
            "status": "ok", 
            "message": "Hệ thống đang hoạt động bình thường",
            "database": {
                "chromadb": {
                    "status": "connected",
                    "collection": collection.name,
                    "documents_count": collection_count
                },
                "mongodb": {
                    "status": "connected",
                    "chat_count": db.chats.count_documents({}),
                    "user_count": db.users.count_documents({})
                }
            },
            "cache_stats": cache_stats
        }
    except Exception as e:
        log_admin_activity(ActivityType.SYSTEM_STATUS, f"Lỗi kiểm tra trạng thái: {str(e)}", 
                          {"error": str(e), "success": False})
        return {
            "status": "error",
            "message": f"Hệ thống gặp sự cố: {str(e)}",
            "database": {"chromadb": {"status": "error"}, "mongodb": {"status": "error"}},
            "cache_stats": None
        }

@router.get("/recent-activities")
async def get_recent_activities(limit: int = 10):
    try:
        activities = activity_service.get_recent_activities(limit)
        return {"Các hoạt động": activities, "Số lượng": len(activities)}
    except Exception as e:
        handle_error("get_recent_activities", e)

@router.get("/statistics")
async def get_system_statistics():
    try:
        db = mongodb_client.get_database()
        
        # Thống kê người dùng và chat
        total_users = db.users.count_documents({})
        total_chats = db.chats.count_documents({})
        
        # Tổng số tin nhắn (exchanges) trong các cuộc trò chuyện
        pipeline = [
            {"$project": {"exchange_count": {"$size": {"$ifNull": ["$exchanges", []]}}}},
            {"$group": {"_id": None, "total": {"$sum": "$exchange_count"}}}
        ]
        result = list(db.chats.aggregate(pipeline))
        total_exchanges = result[0]["total"] if result else 0
        
        # Thống kê cache
        total_cache = db.text_cache.count_documents({})
        valid_cache = db.text_cache.count_documents({"validityStatus": "valid"})
        
        # Thống kê tài liệu
        document_count = 0
        chunk_count = 0
        if os.path.exists(DATA_DIR):
            document_count = sum(1 for item in os.listdir(DATA_DIR) 
                               if os.path.isdir(os.path.join(DATA_DIR, item)))
            
            for doc_dir in os.listdir(DATA_DIR):
                metadata_path = os.path.join(DATA_DIR, doc_dir, "metadata.json")
                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                            chunk_count += len(metadata.get("chunks", []))
                    except:
                        pass
        
        # Số lượng tài liệu đã được index trong ChromaDB
        chroma_count = 0
        try:
            collection = chroma_client.get_collection()
            chroma_count = collection.count()
        except Exception as e:
            print(f"Lỗi ChromaDB: {str(e)}")
        
        return {
            "users": {"total": total_users},
            "chats": {"total": total_chats, "exchanges": total_exchanges},
            "cache": {"total": total_cache, "valid": valid_cache, "invalid": total_cache - valid_cache},
            "documents": {"total": document_count, "chunks": chunk_count, "indexed_in_chroma": chroma_count},
            "timestamp": now_utc().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        handle_error("get_system_statistics", e)

# Các endpoint quản lý cache đầy đủ
@router.get("/cache/stats")
async def get_cache_detailed_stats():
    try:
        basic_stats = retrieval_service.get_cache_stats()
        db = mongodb_client.get_database()
        
        # Thống kê cache theo văn bản
        doc_stats = []
        pipeline = [
            {"$unwind": "$relatedDocIds"},
            {"$group": {"_id": "$relatedDocIds", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        doc_results = list(db.text_cache.aggregate(pipeline))
        for result in doc_results:
            doc_stats.append({
                "doc_id": result["_id"],
                "cache_count": result["count"]
            })
        
        # Cache phổ biến nhất
        popular_cache = list(db.text_cache.find(
            {"validityStatus": "valid"},
            {"cacheId": 1, "questionText": 1, "hitCount": 1, "_id": 0}
        ).sort("hitCount", -1).limit(5))
        
        # Cache gần đây nhất
        recent_cache = list(db.text_cache.find(
            {},
            {"cacheId": 1, "questionText": 1, "createdAt": 1, "_id": 0}
        ).sort("createdAt", -1).limit(5))
        
        return {
            "basic_stats": basic_stats,
            "document_distribution": doc_stats,
            "popular_cache": popular_cache,
            "recent_cache": recent_cache
        }
    except Exception as e:
        handle_error("get_cache_detailed_stats", e)

@router.post("/clear-cache")
async def clear_cache():
    try:
        print("Bắt đầu xóa toàn bộ cache...")
        
        db = mongodb_client.get_database()
        mongo_before = db.text_cache.count_documents({})
        
        chroma_before = 0
        try:
            cache_collection = retrieval_service.chroma.get_cache_collection()
            if cache_collection:
                chroma_before = cache_collection.count()
        except Exception as e:
            print(f"Không thể đếm ChromaDB cache: {str(e)}")
        
        print(f"Trước khi xóa - MongoDB: {mongo_before}, ChromaDB: {chroma_before}")
        
        deleted_count = retrieval_service.clear_all_cache()
        
        mongo_after = db.text_cache.count_documents({})
        chroma_after = 0
        try:
            cache_collection = retrieval_service.chroma.get_cache_collection()
            if cache_collection:
                chroma_after = cache_collection.count()
        except Exception as e:
            print(f"Không thể đếm ChromaDB cache sau khi xóa: {str(e)}")
        
        print(f"Sau khi xóa - MongoDB: {mongo_after}, ChromaDB: {chroma_after}")
        
        log_admin_activity(ActivityType.CACHE_CLEAR,
                          f"Admin xóa toàn bộ cache: MongoDB {deleted_count} entries, ChromaDB {chroma_before - chroma_after} entries",
                          {
                              "action": "admin_clear_all_cache",
                              "mongodb_before": mongo_before,
                              "mongodb_after": mongo_after,
                              "mongodb_deleted": deleted_count,
                              "chromadb_before": chroma_before,
                              "chromadb_after": chroma_after,
                              "chromadb_deleted": chroma_before - chroma_after
                          })
        
        return {
            "message": f"Đã xóa toàn bộ cache thành công",
            "mongodb": {
                "deleted_count": deleted_count,
                "before": mongo_before,
                "after": mongo_after
            },
            "chromadb": {
                "before": chroma_before,
                "after": chroma_after,
                "deleted": chroma_before - chroma_after
            },
            "total_deleted": deleted_count + (chroma_before - chroma_after)
        }
        
    except Exception as e:
        handle_error("clear_cache", e)

@router.post("/clear-invalid-cache")
async def clear_invalid_cache():
    try:
        print("Bắt đầu xóa cache không hợp lệ...")
        
        db = mongodb_client.get_database()
        invalid_before = db.text_cache.count_documents({"validityStatus": "invalid"})
        print(f"Tìm thấy {invalid_before} cache không hợp lệ")
        
        deleted_count = retrieval_service.clear_all_invalid_cache()
        
        invalid_after = db.text_cache.count_documents({"validityStatus": "invalid"})
        print(f"Còn lại {invalid_after} cache không hợp lệ")
        
        log_admin_activity(ActivityType.CACHE_CLEAR,
                          f"Admin xóa cache không hợp lệ: {deleted_count} entries",
                          {
                              "action": "admin_clear_invalid_cache",
                              "invalid_before": invalid_before,
                              "invalid_after": invalid_after,
                              "deleted_count": deleted_count
                          })
        
        return {
            "message": f"Đã xóa {deleted_count} cache entries không hợp lệ",
            "deleted_count": deleted_count,
            "verification": {
                "invalid_before": invalid_before,
                "invalid_after": invalid_after,
                "actually_deleted": invalid_before - invalid_after
            }
        }
        
    except Exception as e:
        handle_error("clear_invalid_cache", e)

@router.post("/invalidate-cache/{doc_id}")
async def invalidate_cache(doc_id: str):
    try:
        count = retrieval_service.invalidate_document_cache(doc_id)
        
        return {
            "message": f"Đã vô hiệu hóa {count} cache entries liên quan đến văn bản {doc_id}",
            "affected_count": count
        }
    except Exception as e:
        handle_error("invalidate_cache", e)

@router.get("/cache/detailed-status")
async def get_cache_detailed_status():
    try:
        db = mongodb_client.get_database()
        mongo_total = db.text_cache.count_documents({})
        mongo_valid = db.text_cache.count_documents({"validityStatus": "valid"})
        mongo_invalid = db.text_cache.count_documents({"validityStatus": "invalid"})
        
        chroma_total = 0
        chroma_error = None
        try:
            cache_collection = retrieval_service.chroma.get_cache_collection()
            if cache_collection:
                chroma_total = cache_collection.count()
            else:
                chroma_error = "Không tìm thấy cache collection"
        except Exception as e:
            chroma_error = str(e)
        
        service_stats = retrieval_service.get_cache_stats()
        
        return {
            "mongodb": {
                "total": mongo_total,
                "valid": mongo_valid,
                "invalid": mongo_invalid,
                "status": "connected"
            },
            "chromadb": {
                "total": chroma_total,
                "status": "connected" if not chroma_error else "error",
                "error": chroma_error
            },
            "service_stats": service_stats,
            "sync_status": {
                "in_sync": mongo_total == chroma_total,
                "difference": abs(mongo_total - chroma_total)
            }
        }
        
    except Exception as e:
        handle_error("get_cache_detailed_status", e)

@router.post("/delete-expired-cache")
async def delete_expired_cache():
    try:
        print("Admin yêu cầu xóa cache đã hết hạn...")
        
        db = mongodb_client.get_database()
        expired_before = db.text_cache.count_documents({"expiresAt": {"$lt": now_utc()}})
        
        deleted_count = retrieval_service.delete_expired_cache()
        
        log_admin_activity(ActivityType.CACHE_CLEAR,
                          f"Admin xóa cache đã hết hạn: {deleted_count} entries",
                          {
                              "action": "delete_expired_cache",
                              "expired_before": expired_before,
                              "deleted_count": deleted_count
                          })
        
        return {
            "message": f"Đã xóa {deleted_count} cache entries đã hết hạn",
            "deleted_count": deleted_count,
            "expired_found": expired_before
        }
        
    except Exception as e:
        handle_error("delete_expired_cache", e)

@router.get("/search-cache/{keyword}")
async def search_cache(keyword: str, limit: int = 10):
    try:
        print(f"Admin tìm kiếm cache với từ khóa: '{keyword}'")
        
        if not keyword.strip():
            raise HTTPException(status_code=400, detail="Từ khóa không được để trống")
        
        results = retrieval_service.search_keyword(keyword.strip(), limit)
        
        cache_results = []
        for result in results:
            try:
                processed_result = {
                    "id": str(result["_id"]),
                    "cacheId": result.get("cacheId", ""),
                    "questionText": result.get("questionText", ""),
                    "answer": result.get("answer", "")[:200] + "..." if len(result.get("answer", "")) > 200 else result.get("answer", ""),
                    "validityStatus": result.get("validityStatus", ""),
                    "hitCount": result.get("hitCount", 0),
                    "keywords": result.get("keywords", []),
                    "relatedDocIds": result.get("relatedDocIds", [])
                }
                
                for date_field in ["createdAt", "updatedAt", "lastUsed", "expiresAt"]:
                    if date_field in result and result[date_field]:
                        processed_result[date_field] = result[date_field].isoformat()
                    else:
                        processed_result[date_field] = None
                
                cache_results.append(processed_result)
                
            except Exception as e:
                print(f"Lỗi xử lý cache result: {str(e)}")
                continue
        
        return {
            "keyword": keyword,
            "limit": limit,
            "count": len(cache_results),
            "total_found": len(results),
            "results": cache_results
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_error("search_cache", e)

# Các endpoint quản lý tài liệu với upload có embedding
@router.post("/upload-document")
async def upload_document(
    metadata: str = Form(...),
    chunks: List[UploadFile] = File(...)
):
    try:
        # Phân tích metadata từ form
        doc_metadata = json.loads(metadata)
        doc_id = doc_metadata.get("doc_id")
        
        if not doc_id:
            raise HTTPException(status_code=400, detail="doc_id là bắt buộc")
        
        # Tạo thư mục tài liệu
        doc_dir = os.path.join(DATA_DIR, doc_id)
        os.makedirs(doc_dir, exist_ok=True)
        
        # Lưu chunks và chuẩn bị cho ChromaDB
        saved_chunks = []
        ids_to_add = []
        documents_to_add = []
        metadatas_to_add = []
        
        for i, chunk in enumerate(chunks):
            # Lưu file chunk
            file_name = f"chunk_{i+1}.md"
            file_path = os.path.join(doc_dir, file_name)
            
            with open(file_path, "wb") as f:
                content = await chunk.read()
                f.write(content)
            
            # Đọc nội dung để embedding
            chunk_content = content.decode('utf-8')
            
            # Tạo thông tin chunk cho metadata.json
            chunk_id = f"{doc_id}_chunk_{i+1}"
            chunk_info = {
                "chunk_id": chunk_id,
                "chunk_type": "content",
                "file_path": f"/data/{doc_id}/{file_name}",
                "content_summary": f"Phần {i+1} của {doc_metadata.get('doc_type', 'văn bản')} {doc_id}"
            }
            saved_chunks.append(chunk_info)
            
            # Chuẩn bị cho ChromaDB
            document_text = f"passage: {chunk_content}"
            chunk_metadata = {
                "doc_id": doc_id,
                "doc_type": doc_metadata.get("doc_type", ""),
                "doc_title": doc_metadata.get("doc_title", ""),
                "effective_date": doc_metadata.get("effective_date", ""),
                "document_scope": doc_metadata.get("document_scope", ""),
                "chunk_id": chunk_id,
                "chunk_type": "content",
                "content_summary": chunk_info["content_summary"],
                "chunk_index": str(i),
                "total_chunks": str(len(chunks))
            }
            
            ids_to_add.append(chunk_id)
            documents_to_add.append(document_text)
            metadatas_to_add.append(chunk_metadata)
        
        # Tạo metadata.json đầy đủ
        full_metadata = {
            "doc_id": doc_id,
            "doc_type": doc_metadata.get("doc_type", ""),
            "doc_title": doc_metadata.get("doc_title", ""),
            "issue_date": now_utc().strftime("%d-%m-%Y"),
            "effective_date": doc_metadata.get("effective_date", ""),
            "expiry_date": None,
            "status": doc_metadata.get("status", "active"),
            "document_scope": doc_metadata.get("document_scope", "Quốc gia"),
            "replaces": [],
            "replaced_by": None,
            "amends": None,
            "amended_by": None,
            "retroactive": False,
            "retroactive_date": None,
            "chunks": saved_chunks,
            "related_documents": []
        }
        
        # Lưu metadata.json
        with open(os.path.join(doc_dir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(full_metadata, f, ensure_ascii=False, indent=2)
        
        print(f"[UPLOAD THỦ CÔNG] Bắt đầu embedding {len(ids_to_add)} chunks vào ChromaDB với model: {EMBEDDING_MODEL_NAME}")
        print(f"[UPLOAD THỦ CÔNG] Tài liệu: {doc_id} - Sử dụng embedding model: {EMBEDDING_MODEL_NAME}")
        
        # Embedding vào ChromaDB
        success = chroma_client.add_documents_to_main(
            ids=ids_to_add,
            documents=documents_to_add,
            metadatas=metadatas_to_add
        )
        
        if not success:
            # Nếu ChromaDB thất bại, xóa thư mục đã tạo
            shutil.rmtree(doc_dir)
            raise HTTPException(status_code=500, detail="Lỗi khi embedding vào ChromaDB")
        
        log_admin_activity(ActivityType.SYSTEM_STATUS, 
                          f"Upload document {doc_id} thành công với {len(saved_chunks)} chunks")
        
        return {
            "message": f"Đã tải lên và embedding văn bản {doc_id} thành công với {len(saved_chunks)} chunks",
            "doc_id": doc_id,
            "chunks_count": len(saved_chunks),
            "chromadb_embedded": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Dọn dẹp nếu có lỗi
        doc_id = None
        try:
            doc_metadata = json.loads(metadata)
            doc_id = doc_metadata.get("doc_id")
            if doc_id:
                doc_dir = os.path.join(DATA_DIR, doc_id)
                if os.path.exists(doc_dir):
                    shutil.rmtree(doc_dir)
        except:
            pass
        handle_error("upload_document", e)

@router.post("/upload-document-auto")
async def upload_document_auto(
    file: UploadFile = File(...),
    doc_id: str = Form(...),
    doc_type: str = Form(...),
    doc_title: str = Form(...),
    effective_date: str = Form(...),
    document_scope: str = Form("Quốc gia")
):
    
    # Kiểm tra loại file
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in ['.pdf', '.doc', '.docx', '.md']:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file PDF, Word (.doc, .docx), Markdown (.md)")
    
    processing_id = str(uuid.uuid4())
    
    try:
        document_processing_status[processing_id] = {
            "status": "starting",
            "progress": 0,
            "message": "Đang khởi tạo xử lý...",
            "doc_id": doc_id,
            "file_type": file_extension,
            "original_filename": file.filename,
            "start_time": datetime.now().isoformat(),
            "embedded_to_chroma": False,
            "approved": False
        }
        
        print(f"Bắt đầu xử lý {file_extension} upload cho doc_id: {doc_id}")
        
        # Đọc file vào bộ nhớ
        content = await file.read()
        
        # Lưu file tạm thời với phần mở rộng phù hợp
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        document_processing_status[processing_id].update({
            "status": "processing",
            "progress": 20,
            "message": f"Đang trích xuất nội dung {file_extension.upper()}..."
        })
        
        # Chuẩn bị metadata
        doc_metadata = {
            "doc_id": doc_id,
            "doc_type": doc_type,
            "doc_title": doc_title,
            "effective_date": effective_date,
            "document_scope": document_scope
        }
        
        # Xử lý tài liệu trong luồng nền
        def process_document_background():
            try:
                document_processing_status[processing_id].update({
                    "status": "processing",
                    "progress": 40,
                    "message": "Đang gọi Gemini để phân tích và tự động nhận diện metadata..."
                })
                
                # Gọi service xử lý tài liệu (CHỈ chia chunk, KHÔNG embed)
                result = document_processing_service.process_document(temp_file_path, doc_metadata)
                
                document_processing_status[processing_id].update({
                    "status": "completed",
                    "progress": 100,
                    "message": f"Hoàn thành phân tích! {result['processing_summary']}",
                    "result": result,
                    "end_time": datetime.now().isoformat(),
                    "embedded_to_chroma": False,
                    "approved": False
                })
                
                log_admin_activity(ActivityType.DOCUMENT_UPLOAD,
                                  f"Chia chunk {file_extension.upper()} tự động: {result['doc_id']} - {result['chunks_count']} chunks (chờ duyệt)",
                                  metadata={
                                      "doc_id": result['doc_id'],
                                      "original_doc_id": doc_id,
                                      "chunks_count": result['chunks_count'],
                                      "related_docs_count": result['related_documents_count'],
                                      "method": f"{file_extension}_auto_chunk",
                                      "status": "pending_approval",
                                      "auto_detected": result.get('auto_detected', {}),
                                      "file_type": file_extension,
                                      "original_filename": file.filename
                                  })
                    
            except Exception as e:
                document_processing_status[processing_id].update({
                    "status": "failed",
                    "progress": 0,
                    "message": f"Lỗi: {str(e)}",
                    "error": str(e),
                    "end_time": datetime.now().isoformat(),
                    "embedded_to_chroma": False,
                    "approved": False
                })
                
                log_admin_activity(ActivityType.SYSTEM_STATUS,
                                  f"Lỗi chia chunk {file_extension.upper()}: {doc_id} - {str(e)}",
                                  metadata={
                                      "doc_id": doc_id,
                                      "error": str(e),
                                      "method": f"{file_extension}_auto_chunk",
                                      "file_type": file_extension,
                                      "original_filename": file.filename
                                  })
            finally:
                # Xóa file tạm
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
        
        # Chạy xử lý nền
        thread = threading.Thread(target=process_document_background)
        thread.daemon = True
        thread.start()
        
        return {
            "message": f"Đã bắt đầu xử lý {file_extension.upper()}",
            "processing_id": processing_id,
            "doc_id": doc_id,
            "file_type": file_extension,
            "original_filename": file.filename
        }
        
    except Exception as e:
        # Dọn dẹp
        try:
            os.unlink(temp_file_path)
        except:
            pass
            
        if processing_id in document_processing_status:
            del document_processing_status[processing_id]
            
        handle_error("upload_document_auto", e)

@router.get("/document-processing-status/{processing_id}")
async def get_document_processing_status(processing_id: str):
    # Lấy trạng thái xử lý tài liệu
    if processing_id not in document_processing_status:
        raise HTTPException(status_code=404, detail="Không tìm thấy quá trình xử lý")
    
    return document_processing_status[processing_id]

@router.post("/approve-document-chunks/{processing_id}")
async def approve_document_chunks(processing_id: str):
    # Admin duyệt và embed chunks vào ChromaDB
    if processing_id not in document_processing_status:
        raise HTTPException(status_code=404, detail="Không tìm thấy quá trình xử lý")
    
    status = document_processing_status[processing_id]
    
    if status.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Chỉ có thể duyệt tài liệu đã xử lý thành công")
    
    if status.get("embedded_to_chroma"):
        raise HTTPException(status_code=400, detail="Tài liệu này đã được embed vào ChromaDB")
    
    try:
        doc_id = status.get("doc_id")
        result = status.get("result", {})
        metadata = result.get("metadata", {})
        chunks = metadata.get("chunks", [])
        file_type = status.get("file_type", "document")
        
        # Sử dụng doc_id từ result (có thể đã được tự động nhận diện)
        final_doc_id = result.get("doc_id", doc_id)
        
        print(f"Admin duyệt và embed {file_type.upper()} {final_doc_id} vào ChromaDB...")
        
        # Chuẩn bị dữ liệu để embed
        ids_to_add = []
        documents_to_add = []
        metadatas_to_add = []
        
        for i, chunk_info in enumerate(chunks):
            # Đọc nội dung chunk
            chunk_path = os.path.join(DATA_DIR, chunk_info.get("file_path", "").replace("/data/", ""))
            if os.path.exists(chunk_path):
                with open(chunk_path, 'r', encoding='utf-8') as f:
                    chunk_content = f.read()
                
                # Chuẩn bị cho ChromaDB
                document_text = f"passage: {chunk_content}"
                chunk_metadata = {
                    "doc_id": final_doc_id,
                    "doc_type": metadata.get("doc_type", ""),
                    "doc_title": metadata.get("doc_title", ""),
                    "effective_date": metadata.get("effective_date", ""),
                    "document_scope": metadata.get("document_scope", ""),
                    "chunk_id": chunk_info.get("chunk_id"),
                    "chunk_type": chunk_info.get("chunk_type"),
                    "content_summary": chunk_info.get("content_summary"),
                    "chunk_index": str(i),
                    "total_chunks": str(len(chunks))
                }
                
                ids_to_add.append(chunk_info.get("chunk_id"))
                documents_to_add.append(document_text)
                metadatas_to_add.append(chunk_metadata)
        
        print(f"[UPLOAD TỰ ĐỘNG] Admin duyệt và embedding {len(ids_to_add)} chunks vào ChromaDB với model: {EMBEDDING_MODEL_NAME}")
        print(f"[UPLOAD TỰ ĐỘNG] Tài liệu: {final_doc_id} - Loại file: {file_type} - Sử dụng embedding model: {EMBEDDING_MODEL_NAME}")

        # Embedding vào ChromaDB
        success = chroma_client.add_documents_to_main(
            ids=ids_to_add,
            documents=documents_to_add,
            metadatas=metadatas_to_add
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Lỗi khi embedding vào ChromaDB")
        
        # Cập nhật trạng thái
        document_processing_status[processing_id].update({
            "embedded_to_chroma": True,
            "approved": True,
            "approved_at": datetime.now().isoformat(),
            "message": f"Đã duyệt và embed {len(chunks)} chunks vào ChromaDB"
        })
        
        log_admin_activity(ActivityType.DOCUMENT_UPLOAD,
                          f"Admin duyệt và embed {file_type.upper()}: {final_doc_id} - {len(chunks)} chunks",
                          metadata={
                              "doc_id": final_doc_id,
                              "chunks_count": len(chunks),
                              "method": f"{file_type}_approved",
                              "processing_id": processing_id,
                              "file_type": file_type
                          })
        
        return {
            "message": f"Đã duyệt và embed {len(chunks)} chunks vào ChromaDB thành công",
            "doc_id": final_doc_id,
            "chunks_embedded": len(chunks),
            "file_type": file_type
        }
        
    except Exception as e:
        handle_error("approve_document_chunks", e)

@router.post("/regenerate-document-chunks/{processing_id}")
async def regenerate_document_chunks(processing_id: str):
    # Tạo lại chunks cho tài liệu (yêu cầu upload lại)
    if processing_id not in document_processing_status:
        raise HTTPException(status_code=404, detail="Không tìm thấy quá trình xử lý")
    
    old_status = document_processing_status[processing_id]
    doc_id = old_status.get("doc_id")
    file_type = old_status.get("file_type", "document")
    
    # Lấy doc_id cuối cùng từ result nếu có (tự động nhận diện)
    result = old_status.get("result", {})
    final_doc_id = result.get("doc_id", doc_id)
    
    try:
        # Xóa thư mục cũ nếu chưa được embed
        if not old_status.get("embedded_to_chroma", False):
            doc_dir = os.path.join(DATA_DIR, final_doc_id)
            if os.path.exists(doc_dir):
                shutil.rmtree(doc_dir)
                print(f"Đã xóa thư mục cũ: {doc_dir}")
        
        # Xóa trạng thái xử lý cũ
        del document_processing_status[processing_id]
        
        log_admin_activity(ActivityType.SYSTEM_STATUS,
                          f"Admin yêu cầu tạo lại chunks cho {file_type.upper()} {final_doc_id}",
                          metadata={
                              "doc_id": final_doc_id,
                              "original_doc_id": doc_id,
                              "old_processing_id": processing_id,
                              "action": "regenerate_request",
                              "file_type": file_type
                          })
        
        return {
            "message": f"Đã xóa kết quả cũ. Vui lòng upload lại file {file_type.upper()} để tạo chunks mới",
            "doc_id": final_doc_id,
            "original_doc_id": doc_id,
            "old_processing_id": processing_id,
            "file_type": file_type
        }
        
    except Exception as e:
        handle_error("regenerate_document_chunks", e)


@router.get("/documents")
async def list_documents():
    try:
        if not os.path.exists(DATA_DIR):
            return {"documents": []}
        
        documents = []
        for doc_dir in os.listdir(DATA_DIR):
            doc_path = os.path.join(DATA_DIR, doc_dir)
            metadata_path = os.path.join(doc_path, "metadata.json")
            
            if os.path.isdir(doc_path) and os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                    
                    # Kiểm tra xem tài liệu có trong ChromaDB không
                    embedded_in_chroma = False
                    try:
                        collection = chroma_client.get_collection()
                        # Kiểm tra chunk đầu tiên
                        first_chunk = metadata.get("chunks", [])
                        if first_chunk:
                            first_chunk_id = first_chunk[0].get("chunk_id")
                            result = collection.get(ids=[first_chunk_id])
                            embedded_in_chroma = len(result.get("ids", [])) > 0
                    except:
                        embedded_in_chroma = False
                        
                    doc_info = {
                        "doc_id": metadata.get("doc_id", doc_dir),
                        "doc_type": metadata.get("doc_type", "Unknown"),
                        "doc_title": metadata.get("doc_title", "Unknown"),
                        "effective_date": metadata.get("effective_date", "Unknown"),
                        "status": metadata.get("status", "active"),
                        "chunks_count": len(metadata.get("chunks", [])),
                        "embedded_in_chroma": embedded_in_chroma,
                        "related_documents_count": len(metadata.get("related_documents", []))
                    }
                    
                    documents.append(doc_info)
                except Exception as e:
                    print(f"Lỗi khi đọc metadata của {doc_dir}: {str(e)}")
        
        documents.sort(key=lambda x: x["doc_id"])
        
        return {"documents": documents}
    except Exception as e:
        handle_error("list_documents", e)

@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    doc_dir = os.path.join(DATA_DIR, doc_id)
    metadata_path = os.path.join(doc_dir, "metadata.json")
    
    if not os.path.exists(doc_dir) or not os.path.exists(metadata_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy văn bản: {doc_id}")
    
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        chunks = []
        for chunk_info in metadata.get("chunks", []):
            chunk_path = os.path.join(DATA_DIR, chunk_info.get("file_path", "").replace("/data/", ""))
            if os.path.exists(chunk_path):
                with open(chunk_path, 'r', encoding='utf-8') as f:
                    chunk_content = f.read()
                
                chunks.append({
                    "chunk_id": chunk_info.get("chunk_id"),
                    "chunk_type": chunk_info.get("chunk_type"),
                    "content_summary": chunk_info.get("content_summary"),
                    "content": chunk_content[:500] + "..." if len(chunk_content) > 500 else chunk_content
                })
        
        metadata["chunks"] = chunks
        
        return metadata
    except Exception as e:
        handle_error("get_document", e)

@router.get("/documents/{doc_id}/chunks")
async def get_document_chunks(doc_id: str):
    # Lấy thông tin chi tiết các chunks của một tài liệu
    try:
        doc_dir = os.path.join(DATA_DIR, doc_id)
        metadata_path = os.path.join(doc_dir, "metadata.json")
        
        if not os.path.exists(doc_dir) or not os.path.exists(metadata_path):
            raise HTTPException(status_code=404, detail=f"Không tìm thấy văn bản: {doc_id}")
        
        # Đọc metadata
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        # Đọc nội dung từng chunk
        chunks_detail = []
        for chunk_info in metadata.get("chunks", []):
            chunk_path = os.path.join(DATA_DIR, chunk_info.get("file_path", "").replace("/data/", ""))
            
            chunk_detail = {
                "chunk_id": chunk_info.get("chunk_id"),
                "chunk_type": chunk_info.get("chunk_type"),
                "content_summary": chunk_info.get("content_summary"),
                "file_path": chunk_info.get("file_path"),
                "content": "",
                "word_count": 0,
                "exists": False
            }
            
            if os.path.exists(chunk_path):
                try:
                    with open(chunk_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    chunk_detail.update({
                        "content": content,
                        "word_count": len(content.split()),
                        "exists": True
                    })
                except Exception as e:
                    print(f"Lỗi đọc chunk {chunk_path}: {str(e)}")
            
            chunks_detail.append(chunk_detail)
        
        return {
            "doc_id": doc_id,
            "doc_info": {
                "doc_type": metadata.get("doc_type"),
                "doc_title": metadata.get("doc_title"),
                "effective_date": metadata.get("effective_date"),
                "status": metadata.get("status"),
                "total_chunks": len(chunks_detail),
                "related_documents": metadata.get("related_documents", [])
            },
            "chunks": chunks_detail
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_error("get_document_chunks", e)

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, confirm: bool = False):
    if not confirm:
        return {"message": f"Vui lòng xác nhận việc xóa văn bản {doc_id} bằng cách gửi 'confirm: true'"}
    
    doc_dir = os.path.join(DATA_DIR, doc_id)
    
    if not os.path.exists(doc_dir):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy văn bản: {doc_id}")
    
    try:
        # Vô hiệu hóa cache trước
        try:
            retrieval_service.invalidate_document_cache(doc_id)
        except Exception as e:
            print(f"Cảnh báo: Không thể vô hiệu hóa cache cho {doc_id}: {str(e)}")
        
        # Xóa từ ChromaDB
        try:
            # Lấy danh sách chunk IDs từ metadata
            metadata_path = os.path.join(doc_dir, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                chunk_ids = [chunk.get("chunk_id") for chunk in metadata.get("chunks", [])]
                
                # Xóa từng chunk từ ChromaDB
                collection = chroma_client.get_main_collection()
                if collection and chunk_ids:
                    try:
                        collection.delete(ids=chunk_ids)
                        print(f"Đã xóa {len(chunk_ids)} chunks từ ChromaDB")
                    except Exception as e:
                        print(f"Lỗi xóa chunks từ ChromaDB: {str(e)}")
        except Exception as e:
            print(f"Lỗi xử lý ChromaDB: {str(e)}")
        
        # Xóa thư mục tài liệu
        shutil.rmtree(doc_dir)
        
        return {"message": f"Đã xóa văn bản {doc_id} thành công"}
    except Exception as e:
        handle_error("delete_document", e)

# Các endpoint Benchmark (giữ nguyên logic cũ)
@router.post("/upload-benchmark")
async def upload_benchmark_file(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file JSON")
        
        content = await file.read()
        file_content = content.decode('utf-8')
        
        try:
            json_data = json.loads(file_content)
            if "benchmark" not in json_data:
                raise HTTPException(status_code=400, detail="Format benchmark không hợp lệ. Phải có key 'benchmark'")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Format JSON không hợp lệ")
        
        timestamp = now_utc().strftime("%Y%m%d_%H%M%S")
        filename = f"uploaded_benchmark_{timestamp}.json"
        
        saved_filename = benchmark_service.save_uploaded_benchmark(file_content, filename)
        
        return {
            "message": "Upload benchmark thành công",
            "filename": saved_filename,
            "questions_count": len(json_data["benchmark"])
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_error("upload_benchmark_file", e)

@router.post("/run-benchmark")
async def run_benchmark_4models(config: BenchmarkConfig):
    try:
        benchmark_id = str(uuid.uuid4())
        
        log_admin_activity(ActivityType.BENCHMARK_START,
                          f"Bắt đầu chạy benchmark với file {config.file_path}",
                          {
                              "benchmark_id": benchmark_id,
                              "file_path": config.file_path,
                              "output_dir": config.output_dir
                          })
        
        progress_queue = queue.Queue()
        result_queue = queue.Queue()
        
        benchmark_progress[benchmark_id] = {
            'status': 'running',
            'progress': 0.0,
            'phase': 'starting',
            'current_step': 0,
            'total_steps': 0,
            'start_time': now_utc().isoformat()
        }
        
        def progress_callback(progress_info):
            if isinstance(progress_info, dict):
                progress_queue.put(progress_info)
            else:
                progress_queue.put({'progress': float(progress_info)})
        
        def run_benchmark_thread():
            try:
                stats = benchmark_service.run_benchmark(
                    benchmark_file=config.file_path,
                    progress_callback=progress_callback
                )
                result_queue.put(('success', stats))
            except Exception as e:
                result_queue.put(('error', str(e)))
        
        def monitor_progress():
            thread = threading.Thread(target=run_benchmark_thread)
            thread.start()
            
            while thread.is_alive():
                try:
                    progress_info = progress_queue.get(timeout=1)
                    if isinstance(progress_info, dict):
                        benchmark_progress[benchmark_id].update(progress_info)
                    else:
                        benchmark_progress[benchmark_id]['progress'] = float(progress_info)
                except queue.Empty:
                    continue
            
            try:
                status, result = result_queue.get(timeout=5)
                if status == 'success':
                    benchmark_progress[benchmark_id].update({
                        'status': 'completed',
                        'progress': 100.0,
                        'phase': 'completed',
                        'end_time': now_utc().isoformat(),
                        'stats': result
                    })
                    benchmark_results_cache[benchmark_id] = result
                    
                    log_admin_activity(ActivityType.BENCHMARK_COMPLETE,
                                      f"Hoàn thành benchmark {benchmark_id}: {result.get('total_questions', 0)} câu hỏi",
                                      {
                                          "benchmark_id": benchmark_id,
                                          "total_questions": result.get('total_questions', 0),
                                          "output_file": result.get('output_file', ''),
                                          "file_path": config.file_path,
                                          "duration_minutes": (datetime.now(VN_TZ) - datetime.fromisoformat(benchmark_progress[benchmark_id]['start_time'])).total_seconds() / 60
                                      })
                else:
                    benchmark_progress[benchmark_id].update({
                        'status': 'failed',
                        'phase': 'failed',
                        'end_time': now_utc().isoformat(),
                        'error': result
                    })
                    
                    log_admin_activity(ActivityType.BENCHMARK_FAIL,
                                      f"Thất bại khi chạy benchmark {benchmark_id}: {result}",
                                      {
                                          "benchmark_id": benchmark_id,
                                          "error": result,
                                          "file_path": config.file_path
                                      })
            except queue.Empty:
                benchmark_progress[benchmark_id].update({
                    'status': 'failed',
                    'phase': 'timeout',
                    'end_time': now_utc().isoformat(),
                    'error': 'Benchmark timed out'
                })
                
                log_admin_activity(ActivityType.BENCHMARK_FAIL,
                                  f"Benchmark {benchmark_id} timeout",
                                  {
                                      "benchmark_id": benchmark_id,
                                      "error": "timeout",
                                      "file_path": config.file_path
                                  })
        
        monitor_thread = threading.Thread(target=monitor_progress)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        return {
            "message": "Benchmark started",
            "benchmark_id": benchmark_id,
            "status": "running"
        }
        
    except Exception as e:
        handle_error("run_benchmark_4models", e)

@router.get("/benchmark-progress/{benchmark_id}")
async def get_benchmark_progress(benchmark_id: str):
    try:
        if benchmark_id not in benchmark_progress:
            raise HTTPException(status_code=404, detail="Benchmark not found")
        
        progress_data = benchmark_progress[benchmark_id].copy()
        
        for key, value in progress_data.items():
            if isinstance(value, (np.floating, np.integer)):
                progress_data[key] = float(value)
        
        return progress_data
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_error("get_benchmark_progress", e)

@router.get("/benchmark-results")
async def list_benchmark_results():
    try:
        if not os.path.exists(BENCHMARK_RESULTS_DIR):
            return {"results": []}
        
        results = []
        for file in os.listdir(BENCHMARK_RESULTS_DIR):
            if file.endswith('.csv'):
                file_path = os.path.join(BENCHMARK_RESULTS_DIR, file)
                stats = {
                    "file_name": file,
                    "file_path": file_path,
                    "created_at": datetime.fromtimestamp(os.path.getctime(file_path)).strftime("%Y-%m-%d %H:%M:%S"),
                    "size_kb": round(os.path.getsize(file_path) / 1024, 2)
                }
                
                try:
                    df = pd.read_csv(file_path, encoding='utf-8-sig')
                    if not df.empty:
                        stats["questions_count"] = len(df)
                        
                        if 'STT' in df.columns:
                            summary_rows = df[df['STT'] == 'SUMMARY']
                            if not summary_rows.empty:
                                summary_row = summary_rows.iloc[0]
                                if 'current_cosine_sim' in summary_row:
                                    try:
                                        stats["avg_cosine_sim"] = float(summary_row['current_cosine_sim'])
                                    except:
                                        pass
                                if 'current_retrieval_accuracy' in summary_row:
                                    try:
                                        stats["avg_retrieval_accuracy"] = float(summary_row['current_retrieval_accuracy'])
                                    except:
                                        pass
                        else:
                            if 'current_cosine_sim' in df.columns:
                                try:
                                    numeric_values = pd.to_numeric(df['current_cosine_sim'], errors='coerce')
                                    stats["avg_cosine_sim"] = float(numeric_values.mean())
                                except:
                                    pass
                except Exception as e:
                    print(f"Lỗi khi đọc file {file}: {str(e)}")
                    stats["questions_count"] = "Unknown"
                
                results.append(stats)
        
        results.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {"results": results}
    
    except Exception as e:
        handle_error("list_benchmark_results", e)

@router.get("/benchmark-results/{file_name}")
async def download_benchmark_result(file_name: str):
    file_path = os.path.join(BENCHMARK_RESULTS_DIR, file_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file: {file_name}")
    
    return FileResponse(
        file_path, 
        media_type='text/csv;charset=utf-8',
        filename=file_name,
        headers={"Content-Disposition": f"attachment; filename={file_name}"}
    )

@router.get("/view-benchmark/{file_name}")
async def view_benchmark_content(file_name: str):
    file_path = os.path.join(BENCHMARK_RESULTS_DIR, file_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file: {file_name}")
    
    try:
        df = pd.read_csv(file_path, encoding='utf-8-sig')
        
        total_rows = len(df)
        columns = list(df.columns)
        
        summary_row = None
        data_rows = df
        
        if 'STT' in df.columns:
            summary_rows = df[df['STT'] == 'SUMMARY']
            if not summary_rows.empty:
                summary_row = summary_rows.iloc[0].to_dict()
                data_rows = df[df['STT'] != 'SUMMARY']
        
        model_stats = {}
        
        models = {
            'current': {
                'cosine_col': 'current_cosine_sim',
                'retrieval_col': 'current_retrieval_accuracy',
                'time_col': 'current_processing_time',
                'name': 'Current System'
            },
            'langchain': {
                'cosine_col': 'langchain_cosine_sim', 
                'retrieval_col': 'langchain_retrieval_accuracy',
                'time_col': 'langchain_processing_time',
                'name': 'LangChain'
            },
            'haystack': {
                'cosine_col': 'haystack_cosine_sim',
                'retrieval_col': 'haystack_retrieval_accuracy', 
                'time_col': 'haystack_processing_time',
                'name': 'Haystack'
            },
            'chatgpt': {
                'cosine_col': 'chatgpt_cosine_sim',
                'retrieval_col': 'chatgpt_retrieval_accuracy',
                'time_col': 'chatgpt_processing_time', 
                'name': 'ChatGPT'
            }
        }
        
        for model_key, model_info in models.items():
            stats = {
                'name': model_info['name'],
                'cosine_similarity': {'avg': 0, 'min': 0, 'max': 0, 'count': 0},
                'retrieval_accuracy': {'avg': 0, 'min': 0, 'max': 0, 'count': 0},
                'processing_time': {'avg': 0, 'min': 0, 'max': 0, 'count': 0}
            }
            
            if model_info['cosine_col'] in data_rows.columns:
                cosine_values = pd.to_numeric(data_rows[model_info['cosine_col']], errors='coerce').dropna()
                if not cosine_values.empty:
                    stats['cosine_similarity'] = {
                        'avg': float(cosine_values.mean()),
                        'min': float(cosine_values.min()),
                        'max': float(cosine_values.max()),
                        'count': int(len(cosine_values))
                    }
            
            if model_info['retrieval_col'] in data_rows.columns:
                retrieval_values = pd.to_numeric(data_rows[model_info['retrieval_col']], errors='coerce').dropna()
                if not retrieval_values.empty:
                    stats['retrieval_accuracy'] = {
                        'avg': float(retrieval_values.mean()),
                        'min': float(retrieval_values.min()),
                        'max': float(retrieval_values.max()),
                        'count': int(len(retrieval_values))
                    }
            
            if model_info['time_col'] in data_rows.columns:
                time_values = pd.to_numeric(data_rows[model_info['time_col']], errors='coerce').dropna()
                if not time_values.empty:
                    stats['processing_time'] = {
                        'avg': float(time_values.mean()),
                        'min': float(time_values.min()),
                        'max': float(time_values.max()),
                        'count': int(len(time_values))
                    }
            
            model_stats[model_key] = stats
        
        best_models = {
            'cosine_similarity': max(model_stats.items(), 
                                   key=lambda x: x[1]['cosine_similarity']['avg'] if x[1]['cosine_similarity']['count'] > 0 else 0),
            'retrieval_accuracy': max(model_stats.items(), 
                                    key=lambda x: x[1]['retrieval_accuracy']['avg'] if x[1]['retrieval_accuracy']['count'] > 0 else 0),
            'processing_time': min(model_stats.items(), 
                                 key=lambda x: x[1]['processing_time']['avg'] if x[1]['processing_time']['count'] > 0 else float('inf'))
        }
        
        preview_data = data_rows.head(5).to_dict('records')
        
        return {
            "file_name": file_name,
            "total_questions": int(len(data_rows)) if 'STT' in df.columns else total_rows,
            "columns": columns,
            "model_stats": model_stats,
            "best_models": {
                'cosine_similarity': {
                    'name': best_models['cosine_similarity'][1]['name'],
                    'score': best_models['cosine_similarity'][1]['cosine_similarity']['avg']
                },
                'retrieval_accuracy': {
                    'name': best_models['retrieval_accuracy'][1]['name'], 
                    'score': best_models['retrieval_accuracy'][1]['retrieval_accuracy']['avg']
                },
                'processing_time': {
                    'name': best_models['processing_time'][1]['name'],
                    'time': best_models['processing_time'][1]['processing_time']['avg']
                }
            },
            "summary_row": summary_row,
            "preview": preview_data[:3]
        }
    except Exception as e:
        handle_error("view_benchmark_content", e)

@router.get("/download-benchmark/{filename}")
async def download_benchmark_file(filename: str):
    file_path = os.path.join(BENCHMARK_RESULTS_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file: {filename}")
    
    return FileResponse(
        file_path, 
        media_type='text/csv;charset=utf-8', 
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/benchmark-files")
async def list_benchmark_files():
    try:
        files = []
        if os.path.exists(BENCHMARK_DIR):
            for filename in os.listdir(BENCHMARK_DIR):
                if filename.endswith('.json'):
                    file_path = os.path.join(BENCHMARK_DIR, filename)
                    try:
                        with open(file_path, 'r', encoding='utf-8-sig') as f:
                            data = json.load(f)
                            questions_count = len(data.get('benchmark', []))
                        
                        files.append({
                            'filename': filename,
                            'questions_count': questions_count,
                            'size': os.path.getsize(file_path),
                            'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                        })
                    except:
                        continue
        
        return {'files': files}
    except Exception as e:
        handle_error("list_benchmark_files", e)
        
# Các endpoint quản lý người dùng cho admin (giữ nguyên logic cũ)
@router.get("/users")
async def get_all_users(limit: int = 100, skip: int = 0):
    # Lấy danh sách tất cả người dùng
    try:
        db = mongodb_client.get_database()
        
        # Lấy danh sách users với projection loại bỏ password
        users = list(db.users.find(
            {},
            {
                "password": 0,  # Không trả về password
                "token": 0      # Không trả về token
            }
        ).sort("created_at", -1).skip(skip).limit(limit))
        
        # Chuyển đổi ObjectId thành string
        for user in users:
            user["id"] = str(user.pop("_id"))
            user["created_at"] = user.get("created_at", now_utc())
            user["updated_at"] = user.get("updated_at", now_utc())
            
            # Đảm bảo có đầy đủ fields cần thiết
            user["role"] = user.get("role", "user")
            user["status"] = user.get("status", "active")
            user["fullName"] = user.get("fullName", user.get("full_name", ""))
            user["phoneNumber"] = user.get("phoneNumber", user.get("phone_number", ""))
            user["lastLogin"] = user.get("last_login", user.get("lastLogin"))
        
        total_count = db.users.count_documents({})
        
        return {
            "users": users,
            "total": total_count,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        handle_error("get_all_users", e)

@router.get("/users/{user_id}")
async def get_user_detail(user_id: str):
    # Lấy thông tin chi tiết một người dùng
    try:
        db = mongodb_client.get_database()
        
        from bson.objectid import ObjectId
        user = db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"password": 0, "token": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        user["id"] = str(user.pop("_id"))
        user["fullName"] = user.get("fullName", user.get("full_name", ""))
        user["phoneNumber"] = user.get("phoneNumber", user.get("phone_number", ""))
        
        return {"user": user}
        
    except Exception as e:
        handle_error("get_user_detail", e)

@router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: dict = Body(...)):
    # Cập nhật thông tin người dùng
    try:
        db = mongodb_client.get_database()
        
        from bson.objectid import ObjectId
        
        # Kiểm tra user tồn tại
        existing_user = db.users.find_one({"_id": ObjectId(user_id)})
        if not existing_user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        # Chuẩn bị data update
        update_data = {}
        allowed_fields = ["fullName", "email", "phoneNumber", "role", "status"]
        
        for field in allowed_fields:
            if field in user_data:
                update_data[field] = user_data[field]
        
        if not update_data:
            raise HTTPException(status_code=400, detail="Không có dữ liệu để cập nhật")
        
        # Kiểm tra email trùng lặp nếu có update email
        if "email" in update_data:
            email_exists = db.users.find_one({
                "email": update_data["email"],
                "_id": {"$ne": ObjectId(user_id)}
            })
            if email_exists:
                raise HTTPException(status_code=400, detail="Email đã được sử dụng bởi người dùng khác")
        
        update_data["updated_at"] = now_utc()
        
        # Thực hiện update
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Không thể cập nhật người dùng")
        
        log_admin_activity(ActivityType.SYSTEM_STATUS,
                          f"Admin cập nhật thông tin user {existing_user.get('username', user_id)}",
                          {
                              "action": "update_user",
                              "user_id": user_id,
                              "username": existing_user.get("username"),
                              "updated_fields": list(update_data.keys())
                          })
        
        return {
            "message": "Cập nhật thông tin người dùng thành công",
            "user_id": user_id
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_error("update_user", e)

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, confirm: bool = False):
    # Xóa người dùng
    try:
        if not confirm:
            raise HTTPException(status_code=400, detail="Vui lòng xác nhận việc xóa người dùng")
        
        db = mongodb_client.get_database()
        
        from bson.objectid import ObjectId
        
        # Kiểm tra user tồn tại
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        username = user.get("username", "unknown")
        
        # Không cho phép xóa admin cuối cùng
        if user.get("role") == "admin":
            admin_count = db.users.count_documents({"role": "admin"})
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Không thể xóa admin cuối cùng trong hệ thống")
        
        # Xóa tất cả chats của user
        chat_delete_result = db.chats.update_many(
            {"user_id": user_id},
            {"$set": {"status": "deleted", "updated_at": now_utc()}}
        )
        
        # Xóa user
        delete_result = db.users.delete_one({"_id": ObjectId(user_id)})
        
        if delete_result.deleted_count == 0:
            raise HTTPException(status_code=400, detail="Không thể xóa người dùng")
        
        log_admin_activity(ActivityType.SYSTEM_STATUS,
                          f"Admin xóa user {username}",
                          {
                              "action": "delete_user",
                              "user_id": user_id,
                              "username": username,
                              "deleted_chats": chat_delete_result.modified_count
                          })
        
        return {
            "message": f"Đã xóa người dùng {username} thành công",
            "deleted_chats": chat_delete_result.modified_count
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_error("delete_user", e)

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, password_data: dict = Body(...)):
    # Reset mật khẩu cho người dùng
    try:
        new_password = password_data.get("new_password")
        if not new_password or len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
        
        db = mongodb_client.get_database()
        
        from bson.objectid import ObjectId
        import bcrypt
        
        # Kiểm tra user tồn tại
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        # Hash mật khẩu mới
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), salt).decode('utf-8')
        
        # Cập nhật mật khẩu
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "password": hashed_password,
                    "updated_at": now_utc()
                },
                "$unset": {"token": ""}  # Xóa token hiện tại để bắt đăng nhập lại
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Không thể reset mật khẩu")
        
        username = user.get("username", "unknown")
        
        log_admin_activity(ActivityType.SYSTEM_STATUS,
                          f"Admin reset mật khẩu cho user {username}",
                          {
                              "action": "reset_password",
                              "user_id": user_id,
                              "username": username
                          })
        
        return {
            "message": f"Đã reset mật khẩu cho người dùng {username} thành công"
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_error("reset_user_password", e)

@router.post("/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: str):
    # Vô hiệu hóa hoặc kích hoạt lại người dùng
    try:
        db = mongodb_client.get_database()
        
        from bson.objectid import ObjectId
        
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        current_status = user.get("status", "active")
        new_status = "inactive" if current_status == "active" else "active"
        
        # Không cho phép vô hiệu hóa admin cuối cùng
        if user.get("role") == "admin" and new_status == "inactive":
            active_admin_count = db.users.count_documents({
                "role": "admin",
                "status": "active"
            })
            if active_admin_count <= 1:
                raise HTTPException(status_code=400, detail="Không thể vô hiệu hóa admin cuối cùng")
        
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "status": new_status,
                    "updated_at": now_utc()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Không thể thay đổi trạng thái người dùng")
        
        username = user.get("username", "unknown")
        
        log_admin_activity(ActivityType.SYSTEM_STATUS,
                          f"Admin {new_status} user {username}",
                          {
                              "action": "toggle_user_status",
                              "user_id": user_id,
                              "username": username,
                              "old_status": current_status,
                              "new_status": new_status
                          })
        
        return {
            "message": f"Đã {new_status} người dùng {username}",
            "new_status": new_status
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_error("toggle_user_status", e)