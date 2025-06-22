import pymongo
from pymongo import MongoClient
from typing import Optional, Dict, Any, List
import sys
import os
from datetime import datetime

# Import config 
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_CONFIG

class MongoDBClient:
    """
    Singleton MongoDB client để quản lý kết nối và operations
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBClient, cls).__new__(cls)
            cls._instance.client = None
            cls._instance.db = None
            cls._instance._initialized = False
        return cls._instance

    def initialize(self):
        """
        Khởi tạo kết nối MongoDB với error handling
        """
        if self._initialized:
            return
            
        try:
            # Tạo kết nối với MongoDB
            self.client = MongoClient(
                DB_CONFIG.MONGO_URI,
                serverSelectionTimeoutMS=5000,  # Timeout 5 giây
                connectTimeoutMS=10000,         # Connect timeout 10 giây
                maxPoolSize=50,                 # Max connection pool size
                retryWrites=True                # Retry writes on network issues
            )
            
            # Lấy database
            self.db = self.client[DB_CONFIG.MONGO_DB_NAME]
            
            # Test connection bằng cách ping server
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
        """
        Lấy database instance, tự động khởi tạo nếu chưa có
        """
        if not self._initialized:
            self.initialize()
        return self.db

    def get_collection(self, collection_name: str):
        """
        Lấy collection theo tên, tự động khởi tạo database nếu cần
        """
        db = self.get_database()
        if not db:
            raise Exception("Không thể kết nối tới database")
        return db[collection_name]

    def create_indexes(self):
        """
        Tạo tất cả indexes cần thiết cho performance tối ưu
        """
        if not self.db:
            self.initialize()

        print("🔧 Bắt đầu tạo indexes cho MongoDB...")
        
        try:
            # === USERS COLLECTION INDEXES ===
            users_collection = self.get_collection("users")
            
            # Index cho username (unique)
            users_collection.create_index([("username", 1)], unique=True, background=True)
            # Index cho email (unique)  
            users_collection.create_index([("email", 1)], unique=True, background=True)
            # Index cho status và role (để filter)
            users_collection.create_index([("status", 1)], background=True)
            users_collection.create_index([("role", 1)], background=True)
            # Index cho last_login_at (để sort)
            users_collection.create_index([("last_login_at", -1)], background=True)

        except Exception as e:
            print(f" Lỗi tạo indexes cho users: {str(e)}")

        try:
            conversations_collection = self.get_collection("chats")
            # Index cho user_id (thường xuyên query)
            conversations_collection.create_index([("user_id", 1)], background=True)
            # Compound index cho user_id + updated_at (list conversations của user)
            conversations_collection.create_index([("user_id", 1), ("updated_at", -1)], background=True)
            # Index cho status (để filter)
            conversations_collection.create_index([("status", 1)], background=True)
            # Index cho title (để search)
            conversations_collection.create_index([("title", "text")], background=True)
            # Index cho created_at (để analytics)
            conversations_collection.create_index([("created_at", -1)], background=True)

        except Exception as e:
            print(f"Lỗi tạo indexes cho conversations: {str(e)}")

        try:
            cache_collection = self.get_collection("text_cache")
            # Index cho cacheId (unique, thường xuyên query)
            cache_collection.create_index([("cache_id", 1)], unique=True, background=True)
            # Text index cho normalized_question (để search)
            cache_collection.create_index([("normalized_question", "text")], background=True)
            cache_collection.create_index([("question_text", "text")], background=True)
            # Index cho keywords array
            cache_collection.create_index([("keywords", 1)], background=True)
            # Index cho related_doc_ids (để invalidate cache)
            cache_collection.create_index([("related_doc_ids", 1)], background=True)
            # Index cho validity_status (để cleanup)
            cache_collection.create_index([("validity_status", 1)], background=True)
            # TTL Index cho expires_at (tự động xóa expired entries)
            cache_collection.create_index([("expires_at", 1)], expireAfterSeconds=0, background=True)
            # Index cho cache_type
            cache_collection.create_index([("cache_type", 1)], background=True)
            # Index cho metrics.hit_count (analytics)
            cache_collection.create_index([("metrics.hit_count", -1)], background=True)

        except Exception as e:
            print(f"Lỗi tạo indexes cho cache: {str(e)}")

        try:
            feedback_collection = self.get_collection("feedback")
            # Index cho user_id (nếu có)
            feedback_collection.create_index([("user_id", 1)], background=True)
            # Index cho chat_id
            feedback_collection.create_index([("chat_id", 1)], background=True)
            # Index cho timestamp (để sort)
            feedback_collection.create_index([("timestamp", -1)], background=True)
            # Index cho rating (analytics)
            feedback_collection.create_index([("rating", 1)], background=True)

        except Exception as e:
            print(f"Lỗi tạo indexes cho feedback: {str(e)}")

        try:
            activity_logs_collection = self.get_collection("activity_logs")
            # Index cho activity_type
            activity_logs_collection.create_index([("activity_type", 1)], background=True)
            # Index cho user_id
            activity_logs_collection.create_index([("user_id", 1)], background=True)
            # Index cho timestamp (để sort và cleanup)
            activity_logs_collection.create_index([("timestamp", -1)], background=True)
            # TTL index để tự động xóa logs cũ (30 ngày)
            activity_logs_collection.create_index([("created_at", 1)], expireAfterSeconds=2592000, background=True)  # 30 * 24 * 60 * 60

        except Exception as e:
            print(f"Lỗi tạo indexes cho activity_logs: {str(e)}")

        print("Hoàn thành tạo tất cả indexes cho MongoDB!")

    def get_collection_stats(self) -> Dict[str, Any]:
        """
        Lấy thống kê về tất cả collections trong database
        """
        if not self.db:
            return {"error": "Database not connected"}

        stats = {}
        
        try:
            # Lấy danh sách tất cả collections
            collection_names = self.db.list_collection_names()
            
            for collection_name in collection_names:
                try:
                    collection = self.db[collection_name]
                    
                    # Đếm documents
                    doc_count = collection.count_documents({})
                    
                    # Lấy collection stats
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
            return {"error": f"Failed to get collection stats: {str(e)}"}
            
        return stats

    def health_check(self) -> Dict[str, Any]:
        """
        Kiểm tra health của MongoDB connection
        """
        health_info = {
            "status": "disconnected",
            "database": DB_CONFIG.MONGO_DB_NAME,
            "collections": [],
            "total_documents": 0,
            "connection_time": None
        }
        
        try:
            start_time = datetime.now()
            
            # Ping database
            self.client.admin.command('ping')
            
            connection_time = (datetime.now() - start_time).total_seconds()
            
            # Lấy thông tin collections
            collections = self.db.list_collection_names()
            total_docs = 0
            
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
        """
        Đóng kết nối MongoDB
        """
        if self.client:
            self.client.close()
            self.client = None
            self.db = None
            self._initialized = False
            print("🔌 Đã đóng kết nối MongoDB")
    
    def save_user(self, user_data: Dict[str, Any]) -> str:
        """
        Lưu thông tin người dùng mới
        """
        user_data["created_at"] = datetime.now()
        user_data["updated_at"] = datetime.now()
        
        users_collection = self.get_collection("users")
        result = users_collection.insert_one(user_data)
        return str(result.inserted_id)

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Lấy thông tin người dùng theo ID
        """
        from bson.objectid import ObjectId
        
        try:
            users_collection = self.get_collection("users")
            return users_collection.find_one({"_id": ObjectId(user_id)})
        except:
            return None

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Lấy thông tin người dùng theo username
        """
        users_collection = self.get_collection("users")
        return users_collection.find_one({"username": username})

    def save_chat_message(self, user_id: str, query: str, answer: str, 
                         context_items: List[str] = None, retrieved_chunks: List[str] = None, 
                         performance_metrics: Dict[str, Any] = None) -> str:
        """
        Lưu tin nhắn chat
        """
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
        """
        Lấy lịch sử chat của người dùng (backward compatibility)
        """
        chat_history_collection = self.get_collection("chat_history")
        return list(chat_history_collection.find(
            {"user_id": user_id},
            {"query": 1, "answer": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(limit))

    def save_user_feedback(self, chat_id: str, feedback_data: Dict[str, Any]) -> str:
        """
        Lưu feedback từ người dùng
        """
        feedback_data["chat_id"] = chat_id
        feedback_data["timestamp"] = datetime.now()
        
        feedback_collection = self.get_collection("user_feedback")
        result = feedback_collection.insert_one(feedback_data)
        return str(result.inserted_id)

mongodb_client = MongoDBClient()

# Export để sử dụng trong các modules khác
def get_mongodb_client():
    return mongodb_client

def get_database():
    return mongodb_client.get_database()