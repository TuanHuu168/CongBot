from datetime import datetime, timedelta
from enum import Enum
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.mongodb_client import mongodb_client

class ActivityType(str, Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    CACHE_CLEAR = "cache_clear"
    CACHE_INVALIDATE = "cache_invalidate"
    BENCHMARK_START = "benchmark_start"
    BENCHMARK_COMPLETE = "benchmark_complete"
    BENCHMARK_FAIL = "benchmark_fail"
    DOCUMENT_UPLOAD = "document_upload"
    DOCUMENT_DELETE = "document_delete"
    SYSTEM_STATUS = "system_status"

class ActivityService:
    def __init__(self):
        self.db = mongodb_client.get_database()
        self.activities_collection = self.db.activity_logs
        
        # Đảm bảo tạo indexes
        try:
            self.activities_collection.create_index([("timestamp", -1)])
            self.activities_collection.create_index([("activity_type", 1)])
            self.activities_collection.create_index([("user_id", 1)])
        except Exception as e:
            print(f"Cảnh báo: Không thể tạo indexes cho activity_logs: {e}")
    
    def log_activity(
        self, 
        activity_type, 
        description,
        user_id=None,
        user_email=None,
        metadata=None
    ):
        # Ghi log hoạt động vào database
        try:
            activity = {
                "activity_type": activity_type.value,
                "description": description,
                "user_id": user_id,
                "user_email": user_email,
                "metadata": metadata or {},
                "timestamp": datetime.now(),
                "created_at": datetime.now()
            }
            
            result = self.activities_collection.insert_one(activity)
            print(f"Đã ghi log hoạt động: {activity_type.value} - {description}")
            return str(result.inserted_id)
        except Exception as e:
            print(f"Lỗi khi ghi log hoạt động: {e}")
            return ""
    
    def get_recent_activities(self, limit=10):
        # Lấy các hoạt động gần đây từ database
        try:
            activities = list(
                self.activities_collection
                .find({})
                .sort("timestamp", -1)
                .limit(limit)
            )
            
            # Chuyển đổi ObjectId thành string
            for activity in activities:
                activity["_id"] = str(activity["_id"])
                if "timestamp" in activity:
                    activity["timestamp"] = activity["timestamp"].isoformat()
                if "created_at" in activity:
                    activity["created_at"] = activity["created_at"].isoformat()
            
            return activities
        except Exception as e:
            print(f"Lỗi khi lấy các hoạt động gần đây: {e}")
            return []
    
    def get_activities_by_type(self, activity_type, limit=5):
        # Lấy hoạt động theo loại
        try:
            activities = list(
                self.activities_collection
                .find({"activity_type": activity_type.value})
                .sort("timestamp", -1)
                .limit(limit)
            )
            
            for activity in activities:
                activity["_id"] = str(activity["_id"])
                if "timestamp" in activity:
                    activity["timestamp"] = activity["timestamp"].isoformat()
            
            return activities
        except Exception as e:
            print(f"Lỗi khi lấy hoạt động theo loại: {e}")
            return []
    
    def cleanup_old_activities(self, days_to_keep=30):
        # Dọn dẹp các hoạt động cũ hơn số ngày được chỉ định
        try:
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            result = self.activities_collection.delete_many(
                {"timestamp": {"$lt": cutoff_date}}
            )
            return result.deleted_count
        except Exception as e:
            print(f"Lỗi khi dọn dẹp các hoạt động cũ: {e}")
            return 0

# Singleton instance
activity_service = ActivityService()