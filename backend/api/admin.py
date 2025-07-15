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
from database.elasticsearch_client import elasticsearch_client

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

class SearchRelatedChunksRequest(BaseModel):
    doc_id: str
    relationship: str
    description: str

class AnalyzeChunksRequest(BaseModel):
    new_document: Dict[str, Any]
    existing_chunks: List[Dict[str, Any]]
    analysis_type: str = "invalidation_check"

class InvalidateChunksRequest(BaseModel):
    chunk_ids: List[str]
    reason: str
    new_document_id: str

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
        return {"activities": activities, "count": len(activities)}
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
        
@router.get("/cache/recent")
async def get_recent_cache(limit: int = 10):
    """Lấy danh sách cache gần đây với dữ liệu thật từ MongoDB"""
    try:
        db = mongodb_client.get_database()
        
        print(f"Đang lấy {limit} cache gần đây từ MongoDB...")
        
        # Kiểm tra xem có collection text_cache không
        total_cache = db.text_cache.count_documents({})
        print(f"Tổng số cache trong DB: {total_cache}")
        
        if total_cache == 0:
            return {
                "recent_cache": [],
                "total_returned": 0,
                "message": "Không có dữ liệu cache trong hệ thống"
            }
        
        # Lấy cache gần đây nhất, sort theo thời gian tạo
        recent_cache = list(db.text_cache.find(
            {},
            {
                "cacheId": 1,
                "questionText": 1,
                "validityStatus": 1,
                "hitCount": 1,
                "createdAt": 1,
                "lastUsed": 1,
                "relatedDocIds": 1,
                "answer": 1
            }
        ).sort("createdAt", -1).limit(limit))
        
        print(f"Đã tìm thấy {len(recent_cache)} cache entries")
        
        # Format dữ liệu để frontend hiển thị
        formatted_cache = []
        for cache in recent_cache:
            question_text = cache.get("questionText", "")
            if len(question_text) > 80:
                question_display = question_text[:80] + "..."
            else:
                question_display = question_text
            
            cache_entry = {
                "cache_id": cache.get("cacheId", "unknown"),
                "question_text": question_display,
                "full_question": question_text,
                "validity_status": cache.get("validityStatus", "unknown"),
                "hit_count": cache.get("hitCount", 0),
                "created_at": cache.get("createdAt").isoformat() if cache.get("createdAt") else None,
                "last_used": cache.get("lastUsed").isoformat() if cache.get("lastUsed") else None,
                "related_docs_count": len(cache.get("relatedDocIds", [])),
                "has_answer": bool(cache.get("answer", "").strip())
            }
            formatted_cache.append(cache_entry)
        
        return {
            "recent_cache": formatted_cache,
            "total_returned": len(formatted_cache),
            "total_in_db": total_cache
        }
        
    except Exception as e:
        print(f"Lỗi khi lấy cache gần đây: {str(e)}")
        handle_error("get_recent_cache", e)

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

# Các endpoint quản lý tài liệu
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
        
        print(f"Admin duyệt và embed {file_type.upper()} {final_doc_id} vào ChromaDB và Elasticsearch...")
        
        # Chuẩn bị dữ liệu để embed
        ids_to_add = []
        documents_to_add = []
        metadatas_to_add = []
        es_chunks_data = []  # Thêm cho Elasticsearch
        
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
                
                # Chuẩn bị cho Elasticsearch
                es_chunk_data = {
                    "chunk_id": chunk_info.get("chunk_id"),
                    "doc_type": metadata.get("doc_type", ""),
                    "doc_title": metadata.get("doc_title", ""),
                    "content": chunk_content,
                    "content_summary": chunk_info.get("content_summary", ""),
                    "effective_date": metadata.get("effective_date", ""),
                    "status": metadata.get("status", "active"),
                    "document_scope": metadata.get("document_scope", ""),
                    "chunk_type": chunk_info.get("chunk_type", ""),
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "keywords": [],
                    "created_at": metadata.get("issue_date", "")
                }
                es_chunks_data.append(es_chunk_data)
        
        print(f"Admin duyệt và embedding {len(ids_to_add)} chunks vào ChromaDB với model: {EMBEDDING_MODEL_NAME}")
        print(f"Tài liệu: {final_doc_id} - Loại file: {file_type} - Sử dụng embedding model: {EMBEDDING_MODEL_NAME}")

        # Embedding vào ChromaDB
        chroma_success = chroma_client.add_documents_to_main(
            ids=ids_to_add,
            documents=documents_to_add,
            metadatas=metadatas_to_add
        )
        
        # Index vào Elasticsearch
        es_success = retrieval_service.index_document_to_elasticsearch(final_doc_id, es_chunks_data)
        
        if not chroma_success:
            raise HTTPException(status_code=500, detail="Lỗi khi embedding vào ChromaDB")
        
        # Cập nhật trạng thái
        document_processing_status[processing_id].update({
            "embedded_to_chroma": chroma_success,
            "indexed_to_elasticsearch": es_success,
            "approved": True,
            "approved_at": datetime.now().isoformat(),
            "message": f"Đã duyệt và embed {len(chunks)} chunks vào ChromaDB" + 
                      (f" và Elasticsearch" if es_success else " (Elasticsearch thất bại)")
        })
        
        log_admin_activity(ActivityType.DOCUMENT_UPLOAD,
                          f"Admin duyệt và embed {file_type.upper()}: {final_doc_id} - {len(chunks)} chunks (ChromaDB: {chroma_success}, ES: {es_success})",
                          metadata={
                              "doc_id": final_doc_id,
                              "chunks_count": len(chunks),
                              "method": f"{file_type}_approved",
                              "processing_id": processing_id,
                              "file_type": file_type,
                              "chroma_success": chroma_success,
                              "elasticsearch_success": es_success
                          })
        
        return {
            "message": f"Đã duyệt và embed {len(chunks)} chunks thành công",
            "doc_id": final_doc_id,
            "chunks_embedded": len(chunks),
            "file_type": file_type,
            "chroma_success": chroma_success,
            "elasticsearch_success": es_success
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
        
        # Xóa từ Elasticsearch
        try:
            es_success = retrieval_service.delete_document_from_elasticsearch(doc_id)
            if not es_success:
                print(f"Cảnh báo: Không thể xóa document {doc_id} từ Elasticsearch")
        except Exception as e:
            print(f"Lỗi xóa từ Elasticsearch: {str(e)}")
        
        # Xóa thư mục tài liệu
        shutil.rmtree(doc_dir)
        
        return {"message": f"Đã xóa văn bản {doc_id} thành công khỏi tất cả hệ thống"}
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
        
@router.get("/elasticsearch/status")
async def get_elasticsearch_status():
    try:
        health = elasticsearch_client.health_check()
        stats = elasticsearch_client.get_index_stats()
        
        return {
            "elasticsearch": health,
            "index_stats": stats,
            "hybrid_stats": retrieval_service.get_stats()
        }
    except Exception as e:
        handle_error("get_elasticsearch_status", e)

@router.post("/elasticsearch/reindex-all")
async def reindex_all_documents():
    try:
        print("Bắt đầu reindex tất cả documents vào Elasticsearch...")
        
        # Lấy danh sách tất cả documents
        if not os.path.exists(DATA_DIR):
            raise HTTPException(status_code=404, detail="Thư mục data không tồn tại")
        
        doc_folders = []
        for item in os.listdir(DATA_DIR):
            item_path = os.path.join(DATA_DIR, item)
            if os.path.isdir(item_path):
                doc_folders.append(item_path)
        
        if not doc_folders:
            raise HTTPException(status_code=404, detail="Không tìm thấy document nào")
        
        success_count = 0
        total_chunks = 0
        
        for doc_folder in doc_folders:
            try:
                metadata_path = os.path.join(doc_folder, "metadata.json")
                if not os.path.exists(metadata_path):
                    continue
                
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                
                doc_id = metadata.get("doc_id", os.path.basename(doc_folder))
                chunks = metadata.get("chunks", [])
                
                # Chuẩn bị chunk data cho Elasticsearch
                chunks_data = []
                for chunk_info in chunks:
                    chunk_path = os.path.join(DATA_DIR, chunk_info.get("file_path", "").replace("/data/", ""))
                    if os.path.exists(chunk_path):
                        with open(chunk_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        chunk_data = {
                            "chunk_id": chunk_info.get("chunk_id"),
                            "doc_type": metadata.get("doc_type", ""),
                            "doc_title": metadata.get("doc_title", ""),
                            "content": content,
                            "content_summary": chunk_info.get("content_summary", ""),
                            "effective_date": metadata.get("effective_date", ""),
                            "status": metadata.get("status", "active"),
                            "document_scope": metadata.get("document_scope", ""),
                            "chunk_type": chunk_info.get("chunk_type", ""),
                            "chunk_index": chunk_info.get("chunk_index", 0),
                            "total_chunks": len(chunks),
                            "keywords": [],
                            "created_at": metadata.get("issue_date", "")
                        }
                        chunks_data.append(chunk_data)
                
                # Index vào Elasticsearch
                if chunks_data:
                    success = retrieval_service.index_document_to_elasticsearch(doc_id, chunks_data)
                    if success:
                        success_count += 1
                        total_chunks += len(chunks_data)
                        print(f"Reindexed document {doc_id}: {len(chunks_data)} chunks")
                    else:
                        print(f"Failed to reindex document {doc_id}")
                
            except Exception as e:
                print(f"Lỗi reindex document {doc_folder}: {str(e)}")
                continue
        
        log_admin_activity(ActivityType.SYSTEM_STATUS,
                          f"Reindex Elasticsearch: {success_count} documents, {total_chunks} chunks",
                          {
                              "action": "elasticsearch_reindex_all",
                              "success_documents": success_count,
                              "total_documents": len(doc_folders),
                              "total_chunks": total_chunks
                          })
        
        return {
            "message": f"Reindex hoàn thành: {success_count}/{len(doc_folders)} documents",
            "success_documents": success_count,
            "total_documents": len(doc_folders),
            "total_chunks": total_chunks
        }
        
    except Exception as e:
        handle_error("reindex_all_documents", e)

@router.delete("/elasticsearch/index")
async def clear_elasticsearch_index():
    try:
        # Xóa toàn bộ index và tạo lại
        client = elasticsearch_client.get_client()
        if not client:
            raise HTTPException(status_code=500, detail="Không thể kết nối Elasticsearch")
        
        index_name = elasticsearch_client.index_name
        
        # Xóa index cũ
        if client.indices.exists(index=index_name):
            client.indices.delete(index=index_name)
            print(f"Đã xóa index {index_name}")
        
        # Tạo lại index
        elasticsearch_client._create_index_if_not_exists()
        
        log_admin_activity(ActivityType.SYSTEM_STATUS,
                          f"Đã xóa và tạo lại Elasticsearch index",
                          {"action": "elasticsearch_clear_index"})
        
        return {
            "message": f"Đã xóa và tạo lại index {index_name} thành công"
        }
        
    except Exception as e:
        handle_error("clear_elasticsearch_index", e)

@router.post("/elasticsearch/search-test")
async def test_elasticsearch_search(search_data: dict = Body(...)):
    try:
        query = search_data.get("query", "")
        if not query:
            raise HTTPException(status_code=400, detail="Query không được để trống")
        
        # Test search với Elasticsearch
        es_results = elasticsearch_client.search_documents(query, size=10)
        
        # Test hybrid search
        hybrid_results = retrieval_service.retrieve(query, use_cache=False)
        
        return {
            "query": query,
            "elasticsearch_results": {
                "total": es_results.get("total", 0),
                "hits": es_results.get("hits", []),
                "max_score": es_results.get("max_score", 0)
            },
            "hybrid_results": {
                "total": len(hybrid_results.get("retrieved_chunks", [])),
                "method": hybrid_results.get("search_method", "unknown"),
                "execution_time": hybrid_results.get("execution_time", 0),
                "stats": hybrid_results.get("stats", {})
            }
        }
        
    except Exception as e:
        handle_error("test_elasticsearch_search", e)
        
@router.post("/search-related-chunks")
async def search_related_chunks(request: SearchRelatedChunksRequest):
    """Tìm kiếm chunks liên quan trong ChromaDB dựa trên doc_id"""
    try:
        doc_id = request.doc_id
        relationship = request.relationship
        description = request.description
        
        print(f"Đang tìm chunks cho doc_id: {doc_id} với relationship: {relationship}")
        
        # Tìm kiếm trong ChromaDB bằng cách filter theo doc_id
        collection = chroma_client.get_main_collection()
        if not collection:
            return {"chunks": [], "exists_in_db": False}
        
        try:
            # Lấy tất cả chunks có doc_id tương ứng
            results = collection.get(
                where={"doc_id": doc_id},
                include=["documents", "metadatas"]
            )
            
            chunks_found = []
            if results and results.get("ids"):
                for i, chunk_id in enumerate(results["ids"]):
                    metadata = results["metadatas"][i] if i < len(results["metadatas"]) else {}
                    document = results["documents"][i] if i < len(results["documents"]) else ""
                    
                    # Loại bỏ prefix "passage: " nếu có
                    if document.startswith("passage: "):
                        document = document[9:]
                    
                    chunk_data = {
                        "chunk_id": chunk_id,
                        "content": document[:200] + "..." if len(document) > 200 else document,  # Trích dẫn ngắn
                        "full_content": document,  # Nội dung đầy đủ cho LLM
                        "content_summary": metadata.get("content_summary", ""),
                        "doc_id": metadata.get("doc_id", ""),
                        "doc_type": metadata.get("doc_type", ""),
                        "doc_title": metadata.get("doc_title", ""),
                        "chunk_type": metadata.get("chunk_type", ""),
                        "chunk_index": metadata.get("chunk_index", ""),
                        "effective_date": metadata.get("effective_date", "")
                    }
                    chunks_found.append(chunk_data)
            
            print(f"Tìm thấy {len(chunks_found)} chunks cho doc_id: {doc_id}")
            
            log_admin_activity(ActivityType.SYSTEM_STATUS,
                              f"Tìm kiếm chunks liên quan: {doc_id} - {len(chunks_found)} chunks",
                              {
                                  "doc_id": doc_id,
                                  "relationship": relationship,
                                  "chunks_found": len(chunks_found),
                                  "action": "search_related_chunks"
                              })
            
            return {
                "chunks": chunks_found,
                "exists_in_db": len(chunks_found) > 0,
                "total_found": len(chunks_found),
                "doc_id": doc_id,
                "relationship": relationship
            }
            
        except Exception as e:
            print(f"Lỗi khi tìm kiếm chunks trong ChromaDB: {str(e)}")
            return {"chunks": [], "exists_in_db": False, "error": str(e)}
            
    except Exception as e:
        handle_error("search_related_chunks", e)

@router.post("/analyze-chunks-for-invalidation")
async def analyze_chunks_for_invalidation(request: AnalyzeChunksRequest):
    """Sử dụng LLM để phân tích chunks nào cần vô hiệu hóa"""
    try:
        new_document = request.new_document
        existing_chunks = request.existing_chunks
        
        print(f"Bắt đầu phân tích LLM cho document mới: {new_document.get('doc_id')}")
        print(f"Số chunks hiện có cần kiểm tra: {len(existing_chunks)}")
        
        if not existing_chunks:
            return {
                "analysis_summary": "Không có chunks hiện có để phân tích.",
                "chunks_to_invalidate": [],
                "reasoning": "Danh sách chunks trống."
            }
        
        # Tạo prompt cho LLM phân tích
        analysis_prompt = f"""
Bạn là chuyên gia pháp luật Việt Nam. Nhiệm vụ của bạn là phân tích xem văn bản pháp luật mới có làm vô hiệu hóa (supersede) các chunks văn bản cũ nào không.

**VĂN BẢN MỚI:**
- Mã: {new_document.get('doc_id', '')}
- Loại: {new_document.get('doc_type', '')}
- Tiêu đề: {new_document.get('doc_title', '')}
- Ngày hiệu lực: {new_document.get('effective_date', '')}
- Số chunks: {len(new_document.get('chunks', []))}

**CÁC CHUNKS HIỆN CÓ TRONG HỆ THỐNG:**
{chr(10).join([f"- {chunk.get('chunk_id', '')}: {chunk.get('content_summary', '')} (Doc: {chunk.get('doc_id', '')}, Ngày hiệu lực: {chunk.get('effective_date', '')})" for chunk in existing_chunks[:10]])}
{f"... và {len(existing_chunks) - 10} chunks khác" if len(existing_chunks) > 10 else ""}

**YÊU CẦU PHÂN TÍCH:**
1. **Phân tích mối quan hệ pháp lý:** Xác định văn bản mới có thay thế, bãi bỏ, hoặc sửa đổi các văn bản cũ không
2. **Nguyên tắc vô hiệu hóa:**
   - Văn bản có ngày hiệu lực muộn hơn thường thay thế văn bản cũ
   - Văn bản cùng cơ quan ban hành có thể thay thế nhau
   - Văn bản cấp cao hơn có thể bãi bỏ văn bản cấp thấp hơn
   - Văn bản chuyên ngành thay thế trong phạm vi chuyên môn

3. **Xác định chunks cần vô hiệu hóa:**
   - Chỉ vô hiệu hóa chunks bị thay thế hoàn toàn
   - Không vô hiệu hóa nếu chỉ bổ sung hoặc làm rõ
   - Ưu tiên an toàn: khi có nghi ngờ, không vô hiệu hóa

**TRẠNG THÁI VÔ HIỆU HÓA:**
- "superseded": Bị thay thế hoàn toàn
- "amended": Bị sửa đổi một phần (không vô hiệu hóa)
- "supplemented": Được bổ sung (không vô hiệu hóa)

Trả về JSON theo format:
{{
    "analysis_summary": "Tóm tắt kết quả phân tích",
    "chunks_to_invalidate": [
        {{
            "chunk_id": "id_chunk_cần_vô_hiệu_hóa",
            "reason": "Lý do cụ thể tại sao cần vô hiệu hóa",
            "relationship": "superseded|replaced",
            "confidence": 0.9
        }}
    ],
    "chunks_to_keep": [
        {{
            "chunk_id": "id_chunk_giữ_lại", 
            "reason": "Lý do tại sao không vô hiệu hóa"
        }}
    ],
    "reasoning": "Giải thích chi tiết quá trình phân tích và quyết định"
}}

**LƯU Ý:** Chỉ vô hiệu hóa khi chắc chắn 100%. Khi có nghi ngờ, hãy giữ lại và giải thích trong reasoning.
"""

        try:
            # Gọi GenerationService với method đúng
            print("Đang gọi LLM để phân tích chunks...")
            
            response = generation_service.generate_answer(
                query=analysis_prompt,
                use_cache=False
            )
            
            # Parse JSON response
            response_text = response.get('answer', '').strip()
            print("Preview response từ LLM:")
            print(response_text[:500] + "..." if len(response_text) > 500 else response_text)
            
            # Tìm JSON trong response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start == -1 or json_end <= json_start:
                raise ValueError("Không tìm thấy JSON hợp lệ trong phản hồi LLM")
            
            json_str = response_text[json_start:json_end]
            analysis_result = json.loads(json_str)
            
            # Validate kết quả
            chunks_to_invalidate = analysis_result.get('chunks_to_invalidate', [])
            chunks_to_keep = analysis_result.get('chunks_to_keep', [])
            
            print(f"LLM phân tích hoàn thành:")
            print(f"  - Chunks cần vô hiệu hóa: {len(chunks_to_invalidate)}")
            print(f"  - Chunks giữ lại: {len(chunks_to_keep)}")
            
            log_admin_activity(ActivityType.SYSTEM_STATUS,
                              f"LLM phân tích chunks: {new_document.get('doc_id')} - {len(chunks_to_invalidate)} cần vô hiệu hóa",
                              {
                                  "new_doc_id": new_document.get('doc_id'),
                                  "existing_chunks_count": len(existing_chunks),
                                  "chunks_to_invalidate": len(chunks_to_invalidate),
                                  "chunks_to_keep": len(chunks_to_keep),
                                  "action": "llm_analyze_chunks"
                              })
            
            return analysis_result
            
        except json.JSONDecodeError as je:
            print(f"Lỗi parse JSON từ LLM: {str(je)}")
            return {
                "analysis_summary": f"Lỗi phân tích: {str(je)}",
                "chunks_to_invalidate": [],
                "chunks_to_keep": [],
                "reasoning": "LLM trả về định dạng không hợp lệ",
                "error": str(je)
            }
            
    except Exception as e:
        handle_error("analyze_chunks_for_invalidation", e)

@router.post("/invalidate-chunks")
async def invalidate_chunks(request: InvalidateChunksRequest):
    """Thực hiện vô hiệu hóa các chunks được chỉ định"""
    try:
        chunk_ids = request.chunk_ids
        reason = request.reason
        new_document_id = request.new_document_id
        
        if not chunk_ids:
            raise HTTPException(status_code=400, detail="Danh sách chunk_ids không được trống")
        
        print(f"Bắt đầu vô hiệu hóa {len(chunk_ids)} chunks:")
        for chunk_id in chunk_ids:
            print(f"  - {chunk_id}")
        
        invalidated_cache_count = 0
        invalidated_chunks_count = 0
        errors = []
        
        # 1. Vô hiệu hóa cache trong MongoDB cho từng chunk
        db = mongodb_client.get_database()
        for chunk_id in chunk_ids:
            try:
                # Tìm cache entries có chứa chunk này
                cache_update_result = db.text_cache.update_many(
                    {
                        "relevantDocuments.chunkId": chunk_id,
                        "validityStatus": "valid"
                    },
                    {
                        "$set": {
                            "validityStatus": "invalid",
                            "invalidatedAt": datetime.now(),
                            "invalidationReason": reason,
                            "invalidatedBy": new_document_id
                        }
                    }
                )
                invalidated_cache_count += cache_update_result.modified_count
                print(f"Đã vô hiệu hóa {cache_update_result.modified_count} cache entries cho chunk {chunk_id}")
                
            except Exception as e:
                error_msg = f"Lỗi vô hiệu hóa cache cho {chunk_id}: {str(e)}"
                print(error_msg)
                errors.append(error_msg)
        
        # 2. Vô hiệu hóa chunks trong ChromaDB cache collection
        try:
            cache_collection = chroma_client.get_cache_collection()
            if cache_collection:
                # Tìm cache entries có chứa chunks này
                for chunk_id in chunk_ids:
                    try:
                        # Tìm cache entries liên quan đến chunk
                        related_caches = list(db.text_cache.find(
                            {"relevantDocuments.chunkId": chunk_id},
                            {"cacheId": 1}
                        ))
                        
                        cache_ids_to_update = [cache["cacheId"] for cache in related_caches]
                        
                        if cache_ids_to_update:
                            # Update metadata trong ChromaDB cache
                            for cache_id in cache_ids_to_update:
                                try:
                                    # Lấy cache hiện tại
                                    existing_cache = cache_collection.get(
                                        ids=[cache_id],
                                        include=["metadatas"]
                                    )
                                    
                                    if existing_cache and existing_cache["ids"]:
                                        # Update metadata
                                        new_metadata = existing_cache["metadatas"][0].copy()
                                        new_metadata["validityStatus"] = "invalid"
                                        new_metadata["invalidatedAt"] = datetime.now().isoformat()
                                        new_metadata["invalidationReason"] = reason
                                        
                                        cache_collection.update(
                                            ids=[cache_id],
                                            metadatas=[new_metadata]
                                        )
                                        invalidated_chunks_count += 1
                                        
                                except Exception as e:
                                    error_msg = f"Lỗi update ChromaDB cache {cache_id}: {str(e)}"
                                    print(error_msg)
                                    errors.append(error_msg)
                    
                    except Exception as e:
                        error_msg = f"Lỗi xử lý ChromaDB cho chunk {chunk_id}: {str(e)}"
                        print(error_msg)
                        errors.append(error_msg)
            
        except Exception as e:
            error_msg = f"Lỗi truy cập ChromaDB cache collection: {str(e)}"
            print(error_msg)
            errors.append(error_msg)
        
        # 3. Log activity
        log_admin_activity(ActivityType.CACHE_INVALIDATE,
                          f"Vô hiệu hóa chunks: {len(chunk_ids)} chunks, {invalidated_cache_count} cache entries",
                          {
                              "chunk_ids": chunk_ids,
                              "reason": reason,
                              "new_document_id": new_document_id,
                              "invalidated_cache_count": invalidated_cache_count,
                              "invalidated_chunks_count": invalidated_chunks_count,
                              "errors": errors,
                              "action": "invalidate_chunks"
                          })
        
        success_message = f"Đã vô hiệu hóa thành công {len(chunk_ids)} chunks"
        if errors:
            success_message += f" (có {len(errors)} lỗi)"
        
        print(f"Hoàn thành vô hiệu hóa chunks:")
        print(f"  - Cache entries: {invalidated_cache_count}")
        print(f"  - ChromaDB cache: {invalidated_chunks_count}")
        print(f"  - Lỗi: {len(errors)}")
        
        return {
            "message": success_message,
            "invalidated_cache_count": invalidated_cache_count,
            "invalidated_chunks_count": invalidated_chunks_count,
            "total_processed": len(chunk_ids),
            "errors": errors,
            "reason": reason,
            "new_document_id": new_document_id
        }
        
    except Exception as e:
        handle_error("invalidate_chunks", e)

@router.get("/chunk-validity-status/{chunk_id}")
async def get_chunk_validity_status(chunk_id: str):
    """Kiểm tra trạng thái validity của một chunk"""
    try:
        db = mongodb_client.get_database()
        
        # Tìm cache entries có chứa chunk này
        cache_entries = list(db.text_cache.find(
            {"relevantDocuments.chunkId": chunk_id},
            {
                "cacheId": 1,
                "validityStatus": 1,
                "invalidatedAt": 1,
                "invalidationReason": 1,
                "invalidatedBy": 1
            }
        ))
        
        # Kiểm tra trong ChromaDB
        collection = chroma_client.get_main_collection()
        chunk_exists_in_main = False
        chunk_metadata = {}
        
        if collection:
            try:
                result = collection.get(
                    ids=[chunk_id],
                    include=["metadatas"]
                )
                if result and result.get("ids"):
                    chunk_exists_in_main = True
                    chunk_metadata = result["metadatas"][0] if result["metadatas"] else {}
            except Exception as e:
                print(f"Lỗi kiểm tra chunk trong ChromaDB: {str(e)}")
        
        return {
            "chunk_id": chunk_id,
            "exists_in_main_db": chunk_exists_in_main,
            "chunk_metadata": chunk_metadata,
            "related_cache_entries": len(cache_entries),
            "cache_details": cache_entries,
            "overall_status": "valid" if any(ce.get("validityStatus") == "valid" for ce in cache_entries) else "invalid"
        }
        
    except Exception as e:
        handle_error("get_chunk_validity_status", e)

@router.post("/restore-chunk-validity")
async def restore_chunk_validity(request: dict):
    """Khôi phục trạng thái valid cho chunk (undo invalidation)"""
    try:
        chunk_ids = request.get("chunk_ids", [])
        restore_reason = request.get("reason", "Manual restoration by admin")
        
        if not chunk_ids:
            raise HTTPException(status_code=400, detail="Danh sách chunk_ids không được trống")
        
        db = mongodb_client.get_database()
        restored_cache_count = 0
        
        # Khôi phục validity status trong MongoDB
        for chunk_id in chunk_ids:
            cache_update_result = db.text_cache.update_many(
                {"relevantDocuments.chunkId": chunk_id},
                {
                    "$set": {
                        "validityStatus": "valid",
                        "restoredAt": datetime.now(),
                        "restorationReason": restore_reason
                    },
                    "$unset": {
                        "invalidatedAt": "",
                        "invalidationReason": "",
                        "invalidatedBy": ""
                    }
                }
            )
            restored_cache_count += cache_update_result.modified_count
        
        # Khôi phục trong ChromaDB cache collection
        try:
            cache_collection = chroma_client.get_cache_collection()
            if cache_collection:
                for chunk_id in chunk_ids:
                    related_caches = list(db.text_cache.find(
                        {"relevantDocuments.chunkId": chunk_id},
                        {"cacheId": 1}
                    ))
                    
                    for cache in related_caches:
                        cache_id = cache["cacheId"]
                        try:
                            existing_cache = cache_collection.get(
                                ids=[cache_id],
                                include=["metadatas"]
                            )
                            
                            if existing_cache and existing_cache["ids"]:
                                new_metadata = existing_cache["metadatas"][0].copy()
                                new_metadata["validityStatus"] = "valid"
                                new_metadata.pop("invalidatedAt", None)
                                new_metadata.pop("invalidationReason", None)
                                
                                cache_collection.update(
                                    ids=[cache_id],
                                    metadatas=[new_metadata]
                                )
                        except Exception as e:
                            print(f"Lỗi khôi phục ChromaDB cache {cache_id}: {str(e)}")
        
        except Exception as e:
            print(f"Lỗi khôi phục ChromaDB: {str(e)}")
        
        log_admin_activity(ActivityType.CACHE_INVALIDATE,
                          f"Khôi phục validity cho {len(chunk_ids)} chunks",
                          {
                              "chunk_ids": chunk_ids,
                              "reason": restore_reason,
                              "restored_cache_count": restored_cache_count,
                              "action": "restore_chunk_validity"
                          })
        
        return {
            "message": f"Đã khôi phục validity cho {len(chunk_ids)} chunks",
            "restored_cache_count": restored_cache_count,
            "chunk_ids": chunk_ids
        }
        
    except Exception as e:
        handle_error("restore_chunk_validity", e)