from fastapi import APIRouter, HTTPException, Depends, Body, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
import os
import json
import time
import uuid
import pandas as pd
from datetime import datetime
import shutil
from pathlib import Path
import threading
import queue
import numpy as np

# Import services
from services.retrieval_service import retrieval_service
from services.generation_service import generation_service
from services.benchmark_service import benchmark_service
from database.mongodb_client import mongodb_client
from database.chroma_client import chroma_client

# Import config
from config import BENCHMARK_DIR, BENCHMARK_RESULTS_DIR, DATA_DIR

benchmark_progress = {}
benchmark_results_cache = {}

# Khởi tạo router
router = APIRouter(
    prefix="",
    tags=["admin"],
    responses={404: {"description": "Not found"}},
)

# === MODELS ===
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

# === ENDPOINTS ===
@router.get("/status", response_model=SystemStatus)
async def get_admin_status():
    try:
        # Kiểm tra ChromaDB
        collection = chroma_client.get_collection()
        collection_count = collection.count()
        
        # Kiểm tra MongoDB
        db = mongodb_client.get_database()
        
        # Thống kê cache từ retrieval_service
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
        print(f"Error in get_admin_status: {str(e)}")
        return {
            "status": "error",
            "message": f"Hệ thống gặp sự cố: {str(e)}",
            "database": {
                "chromadb": {"status": "error"},
                "mongodb": {"status": "error"}
            },
            "cache_stats": None
        }

@router.get("/cache/stats")
async def get_cache_detailed_stats():
    try:
        # Lấy thống kê cơ bản từ retrieval_service
        basic_stats = retrieval_service.get_cache_stats()
        
        db = mongodb_client.get_database()
        
        # Thống kê cache theo văn bản liên quan
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
        
        # Thống kê cache theo hitCount
        popular_cache = list(db.text_cache.find(
            {"validityStatus": "valid"},
            {"cacheId": 1, "questionText": 1, "hitCount": 1, "_id": 0}
        ).sort("hitCount", -1).limit(5))
        
        # Thống kê cache theo thời gian tạo
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
        print(f"Error in get_cache_detailed_stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clear-cache")
async def clear_cache():
    try:
        print("Bắt đầu xóa toàn bộ cache...")
        # Đếm số lượng trước khi xóa
        db = mongodb_client.get_database()
        before_count = db.text_cache.count_documents({})
        print(f"Số lượng documents trước khi xóa: {before_count}")
        
        # Gọi service để xóa
        deleted_count = retrieval_service.clear_all_cache()
        
        # Đếm lại sau khi xóa
        after_count = db.text_cache.count_documents({})
        print(f"Số lượng documents sau khi xóa: {after_count}")
        
        # Kiểm tra xem có xóa thành công không
        if before_count == after_count and before_count > 0:
            print("Xóa qua service không thành công, thử xóa trực tiếp từ MongoDB...")
            result = db.text_cache.delete_many({})
            direct_deleted = result.deleted_count
            after_direct = db.text_cache.count_documents({})
            print(f"Đã xóa trực tiếp {direct_deleted} entries")
            
            return {
                "message": f"Đã xóa {direct_deleted} cache entries bằng phương pháp trực tiếp",
                "deleted_count": direct_deleted,
                "verification": {
                    "before_count": before_count,
                    "after_service": after_count,
                    "after_direct": after_direct
                }
            }
        
        return {
            "message": f"Đã xóa {deleted_count} cache entries",
            "deleted_count": deleted_count,
            "verification": {
                "before_count": before_count,
                "after_count": after_count,
                "verified_deleted": before_count - after_count
            }
        }
    except Exception as e:
        print(f"Error in clear_cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clear-invalid-cache")
async def clear_invalid_cache():
    try:
        # Sử dụng phương thức mới từ retrieval_service
        deleted_count = retrieval_service.clear_all_invalid_cache()
        
        return {
            "message": f"Đã xóa {deleted_count} cache entries không hợp lệ",
            "deleted_count": deleted_count
        }
    except Exception as e:
        print(f"Error in clear_invalid_cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invalidate-cache/{doc_id}")
async def invalidate_cache(doc_id: str):
    try:
        # Sử dụng phương thức từ retrieval_service
        count = retrieval_service.invalidate_document_cache(doc_id)
        
        return {
            "message": f"Đã vô hiệu hóa {count} cache entries liên quan đến văn bản {doc_id}",
            "affected_count": count
        }
    except Exception as e:
        print(f"Error in invalidate_cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Thêm endpoint mới để xóa cache đã hết hạn
@router.post("/delete-expired-cache")
async def delete_expired_cache():
    try:
        deleted_count = retrieval_service.delete_expired_cache()
        
        return {
            "message": f"Đã xóa {deleted_count} cache entries đã hết hạn",
            "deleted_count": deleted_count
        }
    except Exception as e:
        print(f"Error in delete_expired_cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Thêm endpoint để tìm kiếm cache theo từ khóa
@router.get("/search-cache/{keyword}")
async def search_cache(keyword: str, limit: int = 10):
    try:
        results = retrieval_service.search_keyword(keyword, limit)
        
        # Chuẩn bị dữ liệu trả về
        cache_results = []
        for result in results:
            # Chuyển đổi ObjectId sang string
            result["_id"] = str(result["_id"])
            # Chuyển đổi datetime sang string nếu có
            if "createdAt" in result:
                result["createdAt"] = result["createdAt"].isoformat()
            if "updatedAt" in result:
                result["updatedAt"] = result["updatedAt"].isoformat()
            if "lastUsed" in result:
                result["lastUsed"] = result["lastUsed"].isoformat()
            if "expiresAt" in result and result["expiresAt"]:
                result["expiresAt"] = result["expiresAt"].isoformat()
                
            cache_results.append(result)
        
        return {
            "keyword": keyword,
            "count": len(cache_results),
            "results": cache_results
        }
    except Exception as e:
        print(f"Error in search_cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/upload-benchmark")
async def upload_benchmark_file(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="Only JSON files are allowed")
        
        # Read file content
        content = await file.read()
        file_content = content.decode('utf-8')
        
        # Validate JSON format
        try:
            json_data = json.loads(file_content)
            if "benchmark" not in json_data:
                raise HTTPException(status_code=400, detail="Invalid benchmark format. Must contain 'benchmark' key")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format")
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"uploaded_benchmark_{timestamp}.json"
        
        # Save file
        saved_filename = benchmark_service.save_uploaded_benchmark(file_content, filename)
        
        return {
            "message": "Benchmark file uploaded successfully",
            "filename": saved_filename,
            "questions_count": len(json_data["benchmark"])
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error uploading benchmark file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/run-benchmark")
async def run_benchmark_4models(config: BenchmarkConfig):
    try:
        benchmark_id = str(uuid.uuid4())
        
        progress_queue = queue.Queue()
        result_queue = queue.Queue()
        
        benchmark_progress[benchmark_id] = {
            'status': 'running',
            'progress': 0.0,
            'start_time': datetime.now().isoformat(),
            'total_questions': 0
        }
        
        def progress_callback(percent):
            progress_queue.put(float(percent))
        
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
                    progress = progress_queue.get(timeout=1)
                    benchmark_progress[benchmark_id]['progress'] = float(progress)
                except queue.Empty:
                    continue
            
            try:
                status, result = result_queue.get(timeout=5)
                if status == 'success':
                    benchmark_progress[benchmark_id].update({
                        'status': 'completed',
                        'progress': 100.0,
                        'end_time': datetime.now().isoformat(),
                        'stats': result
                    })
                    benchmark_results_cache[benchmark_id] = result
                else:
                    benchmark_progress[benchmark_id].update({
                        'status': 'failed',
                        'end_time': datetime.now().isoformat(),
                        'error': result
                    })
            except queue.Empty:
                benchmark_progress[benchmark_id].update({
                    'status': 'failed',
                    'end_time': datetime.now().isoformat(),
                    'error': 'Benchmark timed out'
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
        print(f"Error starting benchmark: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/benchmark-progress/{benchmark_id}")
async def get_benchmark_progress(benchmark_id: str):
    try:
        if benchmark_id not in benchmark_progress:
            raise HTTPException(status_code=404, detail="Benchmark not found")
        
        progress_data = benchmark_progress[benchmark_id].copy()
        
        # Ensure all values are JSON serializable
        for key, value in progress_data.items():
            if isinstance(value, (np.floating, np.integer)):
                progress_data[key] = float(value)
        
        return progress_data
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error getting benchmark progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/benchmark-results")
async def list_benchmark_results():
    try:
        # Kiểm tra thư mục kết quả tồn tại
        if not os.path.exists(BENCHMARK_RESULTS_DIR):
            return {"results": []}
        
        # Lấy danh sách file CSV trong thư mục
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
                
                # Thử đọc file để lấy số lượng câu hỏi và thống kê
                try:
                    df = pd.read_csv(file_path, encoding='utf-8-sig')
                    if not df.empty:
                        # Đếm số câu hỏi (trừ header)
                        stats["questions_count"] = len(df)
                        
                        # Tính average scores nếu có cột SUMMARY
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
                            # Nếu không có SUMMARY, tính trung bình từ tất cả rows
                            if 'current_cosine_sim' in df.columns:
                                try:
                                    numeric_values = pd.to_numeric(df['current_cosine_sim'], errors='coerce')
                                    stats["avg_cosine_sim"] = float(numeric_values.mean())
                                except:
                                    pass
                except Exception as e:
                    print(f"Lỗi khi đọc file {file}: {str(e)}")
                    # Nếu không đọc được file, vẫn thêm thông tin cơ bản
                    stats["questions_count"] = "Unknown"
                
                results.append(stats)
        
        # Sắp xếp theo thời gian tạo mới nhất trước
        results.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {"results": results}
    
    except Exception as e:
        print(f"Error in list_benchmark_results: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
        
        # Lấy thông tin tổng quan
        total_rows = len(df)
        columns = list(df.columns)
        
        # Lấy 5 dòng đầu làm preview
        preview_data = df.head(5).to_dict('records')
        
        # Tính toán thống kê nếu có
        stats = {}
        if 'current_cosine_sim' in df.columns:
            try:
                numeric_values = pd.to_numeric(df['current_cosine_sim'], errors='coerce')
                stats['avg_current_cosine'] = float(numeric_values.mean())
            except:
                pass
        
        return {
            "file_name": file_name,
            "total_rows": total_rows,
            "columns": columns,
            "preview": preview_data,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể đọc file: {str(e)}")

@router.get("/download-benchmark/{filename}")
async def download_benchmark_file(filename: str):
    file_path = os.path.join(BENCHMARK_RESULTS_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    
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
        print(f"Error listing benchmark files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invalidate-cache/{doc_id}")
async def invalidate_cache(doc_id: str):
    try:
        count = retrieval_service.invalidate_document_cache(doc_id)
        
        return {
            "message": f"Đã vô hiệu hóa {count} cache entries liên quan đến văn bản {doc_id}",
            "affected_count": count
        }
    except Exception as e:
        print(f"Error in invalidate_cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-document")
async def upload_document(
    metadata: DocumentUpload = Body(...),
    chunks: List[UploadFile] = File(...)
):
    try:
        # Tạo thư mục cho văn bản mới
        doc_dir = os.path.join(DATA_DIR, metadata.doc_id)
        os.makedirs(doc_dir, exist_ok=True)
        
        # Lưu các file chunk
        saved_chunks = []
        for i, chunk in enumerate(chunks):
            file_name = f"chunk_{i+1}.md"
            file_path = os.path.join(doc_dir, file_name)
            
            # Lưu file
            with open(file_path, "wb") as f:
                f.write(await chunk.read())
            
            saved_chunks.append({
                "chunk_id": f"{metadata.doc_id}_chunk_{i+1}",
                "chunk_type": "content",
                "file_path": f"/data/{metadata.doc_id}/{file_name}",
                "content_summary": f"Phần {i+1} của {metadata.doc_type} {metadata.doc_id}"
            })
        
        # Tạo metadata
        full_metadata = {
            "doc_id": metadata.doc_id,
            "doc_type": metadata.doc_type,
            "doc_title": metadata.doc_title,
            "issue_date": datetime.now().strftime("%d-%m-%Y"),
            "effective_date": metadata.effective_date,
            "expiry_date": None,
            "status": metadata.status,
            "document_scope": metadata.document_scope,
            "replaces": [],
            "replaced_by": None,
            "amends": None,
            "amended_by": None,
            "retroactive": False,
            "retroactive_date": None,
            "chunks": saved_chunks
        }
        
        # Lưu metadata
        with open(os.path.join(doc_dir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(full_metadata, f, ensure_ascii=False, indent=2)
        
        # Tải văn bản vào ChromaDB
        # Bổ sung sau phần này
        
        return {
            "message": f"Đã tải lên văn bản {metadata.doc_id} thành công với {len(saved_chunks)} chunks",
            "doc_id": metadata.doc_id
        }
    except Exception as e:
        print(f"Error in upload_document: {str(e)}")
        
        # Dọn dẹp nếu có lỗi
        if os.path.exists(doc_dir):
            shutil.rmtree(doc_dir)
            
        raise HTTPException(status_code=500, detail=str(e))

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
                        
                    # Đếm số lượng chunk
                    chunks_count = len(metadata.get("chunks", []))
                    
                    # Thêm thông tin cơ bản
                    doc_info = {
                        "doc_id": metadata.get("doc_id", doc_dir),
                        "doc_type": metadata.get("doc_type", "Unknown"),
                        "doc_title": metadata.get("doc_title", "Unknown"),
                        "effective_date": metadata.get("effective_date", "Unknown"),
                        "status": metadata.get("status", "active"),
                        "chunks_count": chunks_count
                    }
                    
                    documents.append(doc_info)
                except Exception as e:
                    print(f"Lỗi khi đọc metadata của {doc_dir}: {str(e)}")
        
        # Sắp xếp theo ID văn bản
        documents.sort(key=lambda x: x["doc_id"])
        
        return {"documents": documents}
    except Exception as e:
        print(f"Error in list_documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    doc_dir = os.path.join(DATA_DIR, doc_id)
    metadata_path = os.path.join(doc_dir, "metadata.json")
    
    if not os.path.exists(doc_dir) or not os.path.exists(metadata_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy văn bản: {doc_id}")
    
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        # Đọc nội dung chunks
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
        print(f"Error in get_document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
        
        # Xóa thư mục văn bản
        shutil.rmtree(doc_dir)
        
        # Xóa trong ChromaDB
        # Triển khai logic để xóa văn bản trong ChromaDB
        
        return {"message": f"Đã xóa văn bản {doc_id} thành công"}
    except Exception as e:
        print(f"Error in delete_document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/statistics")
async def get_system_statistics():
    try:
        db = mongodb_client.get_database()
        
        # Thống kê cơ bản
        total_users = db.users.count_documents({})
        total_chats = db.chats.count_documents({})
        total_exchanges = 0
        
        # Đếm tổng số exchanges
        pipeline = [
            {"$project": {"exchange_count": {"$size": {"$ifNull": ["$exchanges", []]}}}},
            {"$group": {"_id": None, "total": {"$sum": "$exchange_count"}}}
        ]
        result = list(db.chats.aggregate(pipeline))
        if result:
            total_exchanges = result[0]["total"]
        
        # Thống kê cache
        total_cache = db.text_cache.count_documents({})
        valid_cache = db.text_cache.count_documents({"validityStatus": "valid"})
        
        # Thống kê tài liệu
        document_count = 0
        chunk_count = 0
        
        if os.path.exists(DATA_DIR):
            document_count = sum(1 for item in os.listdir(DATA_DIR) if os.path.isdir(os.path.join(DATA_DIR, item)))
            
            # Đếm số lượng chunk
            for doc_dir in os.listdir(DATA_DIR):
                doc_path = os.path.join(DATA_DIR, doc_dir)
                metadata_path = os.path.join(doc_path, "metadata.json")
                
                if os.path.isdir(doc_path) and os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                            chunk_count += len(metadata.get("chunks", []))
                    except:
                        pass
        
        # Thống kê ChromaDB
        chroma_count = 0
        try:
            collection = chroma_client.get_collection()
            chroma_count = collection.count()
        except Exception as e:
            print(f"Lỗi khi lấy thông tin ChromaDB: {str(e)}")
        
        # Trả về thống kê
        return {
            "users": {
                "total": total_users
            },
            "chats": {
                "total": total_chats,
                "exchanges": total_exchanges
            },
            "cache": {
                "total": total_cache,
                "valid": valid_cache,
                "invalid": total_cache - valid_cache
            },
            "documents": {
                "total": document_count,
                "chunks": chunk_count,
                "indexed_in_chroma": chroma_count
            },
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        print(f"Error in get_system_statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))