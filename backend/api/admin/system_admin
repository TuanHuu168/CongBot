from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel
import os

from database.mongodb_client import mongodb_client
from database.chroma_client import chroma_client
from services.retrieval_service import retrieval_service
from services.activity_service import activity_service, ActivityType
from config import DATA_DIR
from .shared_utils import handle_admin_error, now_utc

router = APIRouter()

class SystemStatus(BaseModel):
    status: str
    message: str
    database: Dict[str, Any]
    cache_stats: Optional[Dict[str, Any]] = None

class SystemStatistics(BaseModel):
    users: Dict[str, int]
    chats: Dict[str, int]
    cache: Dict[str, int]
    documents: Dict[str, int]
    timestamp: str

@router.get("/status", response_model=SystemStatus)
async def get_system_status():
    """Lấy trạng thái tổng quan của hệ thống"""
    try:
        collection = chroma_client.get_collection()
        collection_count = collection.count()
        
        db = mongodb_client.get_database()
        cache_stats = retrieval_service.get_cache_stats()
        
        return SystemStatus(
            status="ok", 
            message="Hệ thống đang hoạt động bình thường",
            database={
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
            cache_stats=cache_stats
        )
    except Exception as e:
        print(f"Lỗi khi kiểm tra trạng thái hệ thống: {str(e)}")
        activity_service.log_activity(
            ActivityType.SYSTEM_STATUS,
            f"Lỗi khi kiểm tra trạng thái hệ thống: {str(e)}",
            metadata={"error": str(e), "success": False}
        )
        return SystemStatus(
            status="error",
            message=f"Hệ thống gặp sự cố: {str(e)}",
            database={
                "chromadb": {"status": "error"},
                "mongodb": {"status": "error"}
            },
            cache_stats=None
        )
        
@router.get("/recent-activities")
async def get_recent_activities(limit: int = 10):
    """Lấy danh sách hoạt động gần đây"""
    try:
        activities = activity_service.get_recent_activities(limit)
        return {
            "activities": activities,
            "count": len(activities)
        }
    except Exception as e:
        handle_admin_error("lấy hoạt động gần đây", e)

@router.get("/statistics", response_model=SystemStatistics)
async def get_system_statistics():
    """Lấy thống kê tổng quan hệ thống"""
    try:
        db = mongodb_client.get_database()
        
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
        
        total_cache = db.text_cache.count_documents({})
        valid_cache = db.text_cache.count_documents({"validityStatus": "valid"})
        
        document_count = 0
        chunk_count = 0
        
        # Đếm documents và chunks
        if os.path.exists(DATA_DIR):
            document_count = sum(1 for item in os.listdir(DATA_DIR) if os.path.isdir(os.path.join(DATA_DIR, item)))
            
            for doc_dir in os.listdir(DATA_DIR):
                doc_path = os.path.join(DATA_DIR, doc_dir)
                metadata_path = os.path.join(doc_path, "metadata.json")
                
                if os.path.isdir(doc_path) and os.path.exists(metadata_path):
                    try:
                        import json
                        with open(metadata_path, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                            chunk_count += len(metadata.get("chunks", []))
                    except:
                        pass
        
        chroma_count = 0
        try:
            collection = chroma_client.get_collection()
            chroma_count = collection.count()
        except Exception as e:
            print(f"Lỗi khi lấy thông tin ChromaDB: {str(e)}")
        
        return SystemStatistics(
            users={"total": total_users},
            chats={
                "total": total_chats,
                "exchanges": total_exchanges
            },
            cache={
                "total": total_cache,
                "valid": valid_cache,
                "invalid": total_cache - valid_cache
            },
            documents={
                "total": document_count,
                "chunks": chunk_count,
                "indexed_in_chroma": chroma_count
            },
            timestamp=now_utc().strftime("%Y-%m-%d %H:%M:%S")
        )
    except Exception as e:
        handle_admin_error("lấy thống kê hệ thống", e)