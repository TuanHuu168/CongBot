from fastapi import APIRouter, HTTPException, Depends, Body, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
import os
import json
import time
import pandas as pd
from datetime import datetime
import shutil
from pathlib import Path
import numpy as np

# Import services
from services.retrieval_service import retrieval_service
from services.generation_service import generation_service
from database.mongodb_client import mongodb_client
from database.chroma_client import chroma_client

# Import config
from config import BENCHMARK_DIR, BENCHMARK_RESULTS_DIR, DATA_DIR

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
        cache_count = db.text_cache.count_documents({})
        valid_cache_count = db.text_cache.count_documents({"validityStatus": "valid"})
        conversation_count = db.chats.count_documents({})
        user_count = db.users.count_documents({})
        
        # Tính tổng dung lượng cache
        cache_stats = {
            "total_count": cache_count,
            "valid_count": valid_cache_count,
            "invalid_count": cache_count - valid_cache_count,
            "hit_rate": None  # Cần tính toán thêm nếu cần
        }
        
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
                    "chat_count": conversation_count,
                    "user_count": user_count
                }
            },
            "cache_stats": cache_stats
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Hệ thống gặp sự cố: {str(e)}",
            "database": {
                "chromadb": {"status": "error"},
                "mongodb": {"status": "error"}
            },
            "cache_stats": None
        }

@router.post("/run-benchmark")
async def run_benchmark(config: BenchmarkConfig):
    try:
        # Tạo thư mục kết quả nếu chưa tồn tại
        os.makedirs(BENCHMARK_RESULTS_DIR, exist_ok=True)
        
        # Đường dẫn đầy đủ cho file benchmark
        benchmark_file = os.path.join(BENCHMARK_DIR, config.file_path)
        if not os.path.exists(benchmark_file):
            raise HTTPException(status_code=404, detail=f"Không tìm thấy file benchmark: {config.file_path}")
        
        # Đọc file benchmark
        with open(benchmark_file, 'r', encoding='utf-8') as f:
            benchmark_data = json.load(f)
        
        results = []
        
        # Tạo tên file kết quả với timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = os.path.join(BENCHMARK_RESULTS_DIR, f"benchmark_results_{timestamp}.csv")
        
        # Chạy từng câu hỏi trong benchmark
        total_questions = len(benchmark_data.get('benchmark', []))
        print(f"Bắt đầu chạy benchmark với {total_questions} câu hỏi...")
        
        for i, item in enumerate(benchmark_data.get('benchmark', [])):
            question_id = item.get('id', f"q{i+1}")
            question = item.get('question', '')
            expected_answer = item.get('ground_truth', '')
            expected_contexts = item.get('contexts', [])
            
            print(f"Đang xử lý câu hỏi {i+1}/{total_questions}: {question_id}")
            
            # Gọi service để lấy câu trả lời
            try:
                # Retrieval
                retrieval_result = retrieval_service.retrieve(question, use_cache=False)
                context_items = retrieval_result.get('context_items', [])
                retrieved_chunks = retrieval_result.get('retrieved_chunks', [])
                retrieval_time = retrieval_result.get('execution_time', 0)
                
                # Generation
                generation_start = time.time()
                if context_items:
                    generation_result = generation_service.generate_answer(question)
                    answer = generation_result.get('answer', '')
                    generation_time = time.time() - generation_start
                else:
                    answer = "Không tìm thấy thông tin liên quan."
                    generation_time = 0
                
                total_time = retrieval_time + generation_time
                
                # Tính retrieval score
                retrieval_score = 0
                if expected_contexts:
                    matches = set()
                    for retrieved in retrieved_chunks:
                        for expected in expected_contexts:
                            if expected in retrieved:
                                matches.add(expected)
                    
                    retrieval_score = len(matches) / len(expected_contexts) if expected_contexts else 0
                
                # Lưu kết quả
                result = {
                    'question_id': question_id,
                    'question': question,
                    'expected_contexts': ','.join(expected_contexts),
                    'retrieved_contexts': ','.join(retrieved_chunks),
                    'retrieval_score': retrieval_score,
                    'retrieval_time': retrieval_time,
                    'generation_time': generation_time,
                    'total_time': total_time,
                    'expected_answer': expected_answer[:500],  # Giới hạn để không quá dài
                    'answer': answer[:500],  # Giới hạn để không quá dài
                    'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                
                results.append(result)
                
                # Cập nhật file CSV sau mỗi câu hỏi
                df = pd.DataFrame(results)
                df.to_csv(csv_path, index=False, encoding='utf-8-sig')
                
            except Exception as e:
                print(f"Lỗi khi xử lý câu hỏi {question_id}: {str(e)}")
                continue
        
        # Tính toán thống kê
        if results:
            avg_retrieval_time = sum(r['retrieval_time'] for r in results) / len(results)
            avg_generation_time = sum(r['generation_time'] for r in results) / len(results)
            avg_total_time = sum(r['total_time'] for r in results) / len(results)
            avg_retrieval_score = sum(r['retrieval_score'] for r in results) / len(results)
            
            # Thêm hàng tổng kết vào DataFrame
            summary = {
                'question_id': 'SUMMARY',
                'question': f'Avg scores for {len(results)} questions',
                'expected_contexts': '',
                'retrieved_contexts': '',
                'retrieval_score': avg_retrieval_score,
                'retrieval_time': avg_retrieval_time,
                'generation_time': avg_generation_time,
                'total_time': avg_total_time,
                'expected_answer': '',
                'answer': '',
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            results.append(summary)
            
            # Lưu lại file kết quả cuối cùng
            df = pd.DataFrame(results)
            df.to_csv(csv_path, index=False, encoding='utf-8-sig')
        
        return {
            "message": f"Benchmark đã hoàn thành với {len(results)-1} câu hỏi",
            "file_path": csv_path,
            "stats": {
                "avg_retrieval_time": avg_retrieval_time,
                "avg_generation_time": avg_generation_time,
                "avg_total_time": avg_total_time,
                "avg_retrieval_score": avg_retrieval_score
            }
        }
    
    except Exception as e:
        print(f"Error in /run-benchmark endpoint: {str(e)}")
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
                    df = pd.read_csv(file_path)
                    if not df.empty and 'SUMMARY' in df['question_id'].values:
                        summary_row = df[df['question_id'] == 'SUMMARY'].iloc[0]
                        stats["questions_count"] = len(df) - 1  # Trừ hàng summary
                        stats["avg_retrieval_score"] = summary_row.get('retrieval_score', None)
                        stats["avg_total_time"] = summary_row.get('total_time', None)
                except Exception as e:
                    print(f"Lỗi khi đọc file {file}: {str(e)}")
                
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
    
    return FileResponse(file_path, media_type='text/csv', filename=file_name)

@router.post("/clear-cache")
async def clear_cache(confirm: bool = False):
    if not confirm:
        return {"message": "Vui lòng xác nhận việc xóa cache bằng cách gửi 'confirm: true'"}
    
    try:
        db = mongodb_client.get_database()
        result = db.text_cache.delete_many({})
        
        # Xóa collection cache trong ChromaDB nếu có
        try:
            chroma_client.delete_collection("cache_questions")
        except Exception as e:
            print(f"Lỗi khi xóa collection cache_questions: {str(e)}")
        
        return {
            "message": f"Đã xóa {result.deleted_count} cache entries",
            "deleted_count": result.deleted_count
        }
    except Exception as e:
        print(f"Error in clear_cache: {str(e)}")
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