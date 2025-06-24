from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel

from database.mongodb_client import mongodb_client
from services.retrieval_service import retrieval_service
from services.activity_service import ActivityType
from .shared_utils import handle_admin_error, log_admin_success, now_utc

router = APIRouter()

class CacheStatsResponse(BaseModel):
    basic_stats: Dict[str, Any]
    document_distribution: list
    popular_cache: list
    recent_cache: list

@router.get("/cache/stats", response_model=CacheStatsResponse)
async def get_cache_detailed_stats():
    """Lấy thống kê chi tiết về cache"""
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
        
        # Cache phổ biến
        popular_cache = list(db.text_cache.find(
            {"validityStatus": "valid"},
            {"cacheId": 1, "questionText": 1, "hitCount": 1, "_id": 0}
        ).sort("hitCount", -1).limit(5))
        
        # Cache gần đây
        recent_cache = list(db.text_cache.find(
            {},
            {"cacheId": 1, "questionText": 1, "createdAt": 1, "_id": 0}
        ).sort("createdAt", -1).limit(5))
        
        return CacheStatsResponse(
            basic_stats=basic_stats,
            document_distribution=doc_stats,
            popular_cache=popular_cache,
            recent_cache=recent_cache
        )
    except Exception as e:
        handle_admin_error("lấy thống kê cache", e, ActivityType.CACHE_CLEAR)

@router.post("/clear-cache")
async def clear_all_cache():
    """Xóa toàn bộ cache"""
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
            print(f"Không thể đếm ChromaDB cache sau xóa: {str(e)}")
        
        print(f"Sau khi xóa - MongoDB: {mongo_after}, ChromaDB: {chroma_after}")
        
        log_admin_success(
            "xóa cache",
            f"Admin xóa toàn bộ cache: MongoDB {deleted_count} entries, ChromaDB {chroma_before - chroma_after} entries",
            ActivityType.CACHE_CLEAR,
            {
                "action": "admin_clear_all_cache",
                "mongodb_before": mongo_before,
                "mongodb_after": mongo_after,
                "mongodb_deleted": deleted_count,
                "chromadb_before": chroma_before,
                "chromadb_after": chroma_after,
                "chromadb_deleted": chroma_before - chroma_after
            }
        )
        
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
        handle_admin_error("xóa toàn bộ cache", e, ActivityType.CACHE_CLEAR)

@router.post("/clear-invalid-cache")
async def clear_invalid_cache():
    """Xóa cache không hợp lệ"""
    try:
        print("Bắt đầu xóa cache không hợp lệ...")
        
        db = mongodb_client.get_database()
        invalid_before = db.text_cache.count_documents({"validityStatus": "invalid"})
        print(f"Tìm thấy {invalid_before} cache không hợp lệ")
        
        deleted_count = retrieval_service.clear_all_invalid_cache()
        
        invalid_after = db.text_cache.count_documents({"validityStatus": "invalid"})
        print(f"Còn lại {invalid_after} cache không hợp lệ")
        
        log_admin_success(
            "xóa cache không hợp lệ",
            f"Admin xóa cache không hợp lệ: {deleted_count} entries",
            ActivityType.CACHE_CLEAR,
            {
                "action": "admin_clear_invalid_cache",
                "invalid_before": invalid_before,
                "invalid_after": invalid_after,
                "deleted_count": deleted_count
            }
        )
        
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
        handle_admin_error("xóa cache không hợp lệ", e, ActivityType.CACHE_CLEAR)

@router.post("/invalidate-cache/{doc_id}")
async def invalidate_document_cache(doc_id: str):
    """Vô hiệu hóa cache theo document ID"""
    try:
        count = retrieval_service.invalidate_document_cache(doc_id)
        
        log_admin_success(
            "vô hiệu hóa cache",
            f"Admin vô hiệu hóa {count} cache entries cho văn bản {doc_id}",
            ActivityType.CACHE_INVALIDATE,
            {"doc_id": doc_id, "affected_count": count}
        )
        
        return {
            "message": f"Đã vô hiệu hóa {count} cache entries liên quan đến văn bản {doc_id}",
            "affected_count": count
        }
    except Exception as e:
        handle_admin_error("vô hiệu hóa cache", e)

@router.get("/cache/detailed-status")
async def get_cache_detailed_status():
    """Lấy trạng thái chi tiết của cache system"""
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
                chroma_error = "Cache collection not found"
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
        handle_admin_error("lấy trạng thái cache", e)

@router.post("/delete-expired-cache")
async def delete_expired_cache():
    """Xóa cache đã hết hạn"""
    try:
        print("Admin yêu cầu xóa cache đã hết hạn...")
        
        db = mongodb_client.get_database()
        expired_before = db.text_cache.count_documents({"expiresAt": {"$lt": now_utc()}})
        
        deleted_count = retrieval_service.delete_expired_cache()
        
        log_admin_success(
            "xóa cache hết hạn",
            f"Admin xóa cache đã hết hạn: {deleted_count} entries",
            ActivityType.CACHE_CLEAR,
            {
                "action": "delete_expired_cache",
                "expired_before": expired_before,
                "deleted_count": deleted_count
            }
        )
        
        return {
            "message": f"Đã xóa {deleted_count} cache entries đã hết hạn",
            "deleted_count": deleted_count,
            "expired_found": expired_before
        }
        
    except Exception as e:
        handle_admin_error("xóa cache hết hạn", e, ActivityType.CACHE_CLEAR)

@router.get("/search-cache/{keyword}")
async def search_cache_by_keyword(keyword: str, limit: int = 10):
    """Tìm kiếm cache theo từ khóa"""
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
        handle_admin_error("tìm kiếm cache", e)