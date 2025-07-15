import pymongo
from pymongo import MongoClient
from typing import Optional, Dict, Any, List
import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_CONFIG

class MongoDBClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBClient, cls).__new__(cls)
            cls._instance.client = None
            cls._instance.db = None
            cls._instance._initialized = False
        return cls._instance

    def initialize(self):
        # Khởi tạo kết nối MongoDB
        if self._initialized:
            return
            
        try:
            self.client = MongoClient(
                DB_CONFIG.MONGO_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                maxPoolSize=50,
                retryWrites=True
            )
            
            self.db = self.client[DB_CONFIG.MONGO_DB_NAME]
            self.client.admin.command('ping')
            
            print(f"Đã kết nối thành công tới MongoDB: {DB_CONFIG.MONGO_DB_NAME}")
            
            self._initialized = True
            
        except Exception as e:
            print(f"Lỗi kết nối MongoDB: {str(e)}")
            self.client = None
            self.db = None
            self._initialized = False
            raise e

    def get_database(self):
        # Lấy database instance
        if not self._initialized:
            self.initialize()
        return self.db

    def get_collection(self, collection_name: str):
        # Lấy collection theo tên
        db = self.get_database()
        if db is None:
            raise Exception("Không thể kết nối tới database")
        return db[collection_name]

    def create_indexes(self):
        # Tạo indexes cho tất cả collections để tối ưu hiệu suất
        if self.db is None:
            self.initialize()

        print("Bắt đầu tạo indexes cho MongoDB...")
        
        def index_exists_by_spec(collection, index_spec):
            # Kiểm tra index theo specification thay vì tên
            existing_indexes = collection.list_indexes()
            target_key = dict(index_spec)
            
            for idx in existing_indexes:
                existing_key = idx.get('key', {})
                if existing_key == target_key:
                    return True, idx.get('name')
            return False, None
        
        def create_index_safe(collection, index_spec, **options):
            # Tạo index an toàn với kiểm tra specification
            exists, existing_name = index_exists_by_spec(collection, index_spec)
            
            if exists:
                return True
            
            try:
                result = collection.create_index(index_spec, **options)
                index_name = options.get('name', result)
                print(f"Đã tạo index: {index_name}")
                return True
            except Exception as e:
                index_name = options.get('name', 'unknown')
                print(f"Lỗi tạo index {index_name}: {str(e)}")
                return False
        
        try:
            # Indexes cho collection users
            users_collection = self.get_collection("users")
            print("  Tạo indexes cho users...")
            
            create_index_safe(users_collection, [("username", 1)], unique=True, background=True)
            create_index_safe(users_collection, [("email", 1)], unique=True, background=True)
            create_index_safe(users_collection, [("status", 1)], background=True)
            create_index_safe(users_collection, [("role", 1)], background=True)
            create_index_safe(users_collection, [("last_login_at", -1)], background=True)

        except Exception as e:
            print(f"  Lỗi tạo indexes cho users: {str(e)}")

        try:
            # Indexes cho collection chats
            conversations_collection = self.get_collection("chats")
            print("  Tạo indexes cho chats...")
            
            create_index_safe(conversations_collection, [("user_id", 1)], background=True)
            create_index_safe(conversations_collection, [("user_id", 1), ("updated_at", -1)], background=True)
            create_index_safe(conversations_collection, [("status", 1)], background=True)
            create_index_safe(conversations_collection, [("title", "text")], background=True)
            create_index_safe(conversations_collection, [("created_at", -1)], background=True)

        except Exception as e:
            print(f"  Lỗi tạo indexes cho conversations: {str(e)}")

        try:
            # Indexes cho collection cache
            cache_collection = self.get_collection("text_cache")
            print("  Tạo indexes cho cache...")
            
            # Dọn dẹp cache documents có cacheId không hợp lệ chỉ khi cần
            invalid_count = cache_collection.count_documents({
                "$or": [
                    {"cacheId": None},
                    {"cacheId": ""},
                    {"cacheId": {"$exists": False}}
                ]
            })
            
            if invalid_count > 0:
                print(f"    Đang dọn dẹp {invalid_count} cache documents có cacheId không hợp lệ...")
                deleted_result = cache_collection.delete_many({
                    "$or": [
                        {"cacheId": None},
                        {"cacheId": ""},
                        {"cacheId": {"$exists": False}}
                    ]
                })
                print(f"    Đã xóa {deleted_result.deleted_count} documents có cacheId không hợp lệ")
            
            # Tạo các index cho cache
            create_index_safe(cache_collection, [("cacheId", 1)], unique=True, background=True, sparse=True)
            
            # Kiểm tra text index riêng vì có cấu trúc đặc biệt
            existing_indexes = cache_collection.list_indexes()
            has_text_index = any(idx.get('key', {}).get('_fts') == 'text' for idx in existing_indexes)
            if not has_text_index:
                try:
                    cache_collection.create_index([("questionText", "text"), ("normalizedQuestion", "text")], background=True)
                    print("    Đã tạo text index cho cache")
                except Exception as e:
                    print(f"    Lỗi tạo text index: {str(e)}")
            else:
                print("    Text index đã tồn tại")
            
            create_index_safe(cache_collection, [("keywords", 1)], background=True)
            create_index_safe(cache_collection, [("relatedDocIds", 1)], background=True)
            create_index_safe(cache_collection, [("validityStatus", 1)], background=True)
            create_index_safe(cache_collection, [("expiresAt", 1)], background=True)
            create_index_safe(cache_collection, [("hitCount", -1)], background=True)
            create_index_safe(cache_collection, [("createdAt", -1)], background=True)

        except Exception as e:
            print(f"  Lỗi tạo indexes cho cache: {str(e)}")

        try:
            # Indexes cho collection feedback
            feedback_collection = self.get_collection("feedback")
            print("  Tạo indexes cho feedback...")
            
            create_index_safe(feedback_collection, [("user_id", 1)], background=True)
            create_index_safe(feedback_collection, [("chat_id", 1)], background=True)
            create_index_safe(feedback_collection, [("timestamp", -1)], background=True)
            create_index_safe(feedback_collection, [("rating", 1)], background=True)

        except Exception as e:
            print(f"  Lỗi tạo indexes cho feedback: {str(e)}")

        try:
            # Indexes cho collection activity_logs
            activity_logs_collection = self.get_collection("activity_logs")
            print("  Tạo indexes cho activity_logs...")
            
            create_index_safe(activity_logs_collection, [("activity_type", 1)], background=True)
            create_index_safe(activity_logs_collection, [("user_id", 1)], background=True)
            create_index_safe(activity_logs_collection, [("timestamp", -1)], background=True)
            create_index_safe(activity_logs_collection, [("created_at", 1)], background=True)

        except Exception as e:
            print(f"  Lỗi tạo indexes cho activity_logs: {str(e)}")

        print("Hoàn thành tạo tất cả indexes cho MongoDB!")

    def get_collection_stats(self) -> Dict[str, Any]:
        # Lấy thống kê chi tiết về tất cả collections
        if self.db is None:
            return {"error": "Database chưa được kết nối"}

        stats = {}
        
        try:
            collection_names = self.db.list_collection_names()
            
            for collection_name in collection_names:
                try:
                    collection = self.db[collection_name]
                    doc_count = collection.count_documents({})
                    collection_stats = self.db.command("collStats", collection_name)
                    
                    stats[collection_name] = {
                        "document_count": doc_count,
                        "size_bytes": collection_stats.get("size", 0),
                        "storage_size_bytes": collection_stats.get("storageSize", 0),
                        "index_count": collection_stats.get("nindexes", 0),
                        "average_doc_size": collection_stats.get("avgObjSize", 0),
                    }
                    
                except Exception as e:
                    stats[collection_name] = {"error": str(e)}
                    
        except Exception as e:
            return {"error": f"Lỗi khi lấy thống kê collection: {str(e)}"}
            
        return stats

    def health_check(self) -> Dict[str, Any]:
        # Kiểm tra tình trạng sức khỏe của database
        health_info = {
            "status": "disconnected",
            "database": DB_CONFIG.MONGO_DB_NAME,
            "collections": [],
            "total_documents": 0,
            "connection_time": None
        }
        
        try:
            start_time = datetime.now()
            self.client.admin.command('ping')
            connection_time = (datetime.now() - start_time).total_seconds()
            
            collections = self.db.list_collection_names()
            total_docs = 0
            
            # Đếm tổng số tài liệu trong tất cả collections
            for collection_name in collections:
                try:
                    count = self.db[collection_name].count_documents({})
                    total_docs += count
                except:
                    pass
            
            health_info.update({
                "status": "connected",
                "collections": collections,
                "total_documents": total_docs,
                "connection_time": connection_time,
                "server_info": self.client.server_info()["version"]
            })
            
        except Exception as e:
            health_info["error"] = str(e)
            
        return health_info

    def close(self):
        # Đóng kết nối database
        if self.client:
            self.client.close()
            self.client = None
            self.db = None
            self._initialized = False
            print("Đã đóng kết nối MongoDB")

    # CÁC PHƯƠNG THỨC HELPER
    def save_user(self, user_data: Dict[str, Any]) -> str:
        # Lưu thông tin người dùng mới
        user_data["created_at"] = datetime.now()
        user_data["updated_at"] = datetime.now()
        
        users_collection = self.get_collection("users")
        result = users_collection.insert_one(user_data)
        return str(result.inserted_id)

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        # Tìm người dùng theo ID
        from bson.objectid import ObjectId
        
        try:
            users_collection = self.get_collection("users")
            return users_collection.find_one({"_id": ObjectId(user_id)})
        except:
            return None

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        # Tìm người dùng theo tên đăng nhập
        users_collection = self.get_collection("users")
        return users_collection.find_one({"username": username})

    def save_chat_message(self, user_id: str, query: str, answer: str, 
                         context_items: List[str] = None, retrieved_chunks: List[str] = None, 
                         performance_metrics: Dict[str, Any] = None) -> str:
        # Lưu tin nhắn chat với các thông tin liên quan
        chat_data = {
            "user_id": user_id,
            "query": query,
            "answer": answer,
            "context_items": context_items or [],
            "retrieved_chunks": retrieved_chunks or [],
            "performance": performance_metrics or {},
            "timestamp": datetime.now()
        }
        
        chat_history_collection = self.get_collection("chat_history")
        result = chat_history_collection.insert_one(chat_data)
        return str(result.inserted_id)

    def get_user_chat_history(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        # Lấy lịch sử chat của người dùng
        chat_history_collection = self.get_collection("chat_history")
        return list(chat_history_collection.find(
            {"user_id": user_id},
            {"query": 1, "answer": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(limit))

    def save_user_feedback(self, chat_id: str, feedback_data: Dict[str, Any]) -> str:
        # Lưu phản hồi của người dùng
        feedback_data["chat_id"] = chat_id
        feedback_data["timestamp"] = datetime.now()
        
        feedback_collection = self.get_collection("user_feedback")
        result = feedback_collection.insert_one(feedback_data)
        return str(result.inserted_id)

# Khởi tạo singleton instance
mongodb_client = MongoDBClient()

def get_mongodb_client():
    # Hàm helper để lấy MongoDB client
    return mongodb_client

def get_database():
    # Hàm helper để lấy database
    return mongodb_client.get_database()