import pymongo
from typing import Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import MONGO_URI, MONGO_DB_NAME

class MongoDBClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBClient, cls).__new__(cls)
            cls._instance.client = None
            cls._instance.db = None
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        try:
            self.client = pymongo.MongoClient(MONGO_URI)
            self.db = self.client[MONGO_DB_NAME]
            print(f"Đã kết nối tới MongoDB: {MONGO_DB_NAME}")
        except Exception as e:
            print(f"Lỗi kết nối MongoDB: {str(e)}")
            self.client = None
            self.db = None
    
    def get_database(self):
        if self.db is None:
            self.initialize()
        return self.db
    
    def get_collection(self, collection_name: str):
        if not self.db:
            self.initialize()
        return self.db[collection_name]

    def create_indexes(self):
        if self.db is None:
            self.initialize()
        
        # Kiểm tra và tạo collection text_cache nếu chưa tồn tại
        collections = self.db.list_collection_names()
        if "text_cache" not in collections:
            self.db.create_collection("text_cache")
            print("Đã tạo collection text_cache")
        
        # Indexes cho text_cache collection
        try:
            self.db.text_cache.create_index([("cacheId", 1)], unique=True)
            print("Đã tạo index cho cacheId")
        except Exception as e:
            print(f"Lỗi khi tạo index cho cacheId: {str(e)}")
        
        try:
            self.db.text_cache.create_index([("normalizedQuestion", "text")])
            print("Đã tạo text index cho normalizedQuestion")
        except Exception as e:
            print(f"Lỗi khi tạo text index: {str(e)}")
        
        try:
            self.db.text_cache.create_index([("questionText", 1)])
            print("Đã tạo index cho questionText")
        except Exception as e:
            print(f"Lỗi khi tạo index cho questionText: {str(e)}")
        
        try:
            self.db.text_cache.create_index([("keywords", 1)])
            print("Đã tạo index cho keywords")
        except Exception as e:
            print(f"Lỗi khi tạo index cho keywords: {str(e)}")
        
        try:
            self.db.text_cache.create_index([("relatedDocIds", 1)])
            print("Đã tạo index cho relatedDocIds")
        except Exception as e:
            print(f"Lỗi khi tạo index cho relatedDocIds: {str(e)}")
        
        try:
            self.db.text_cache.create_index([("validityStatus", 1)])
            print("Đã tạo index cho validityStatus")
        except Exception as e:
            print(f"Lỗi khi tạo index cho validityStatus: {str(e)}")
        
        try:
            self.db.text_cache.create_index([("expiresAt", 1)], expireAfterSeconds=0)  # TTL index
            print("Đã tạo TTL index cho expiresAt")
        except Exception as e:
            print(f"Lỗi khi tạo TTL index: {str(e)}")
        
        # Indexes cho users collection
        self.db.users.create_index([("username", 1)], unique=True)
        self.db.users.create_index([("email", 1)], unique=True)
        
        # Indexes cho chats collection
        self.db.chats.create_index([("user_id", 1)])
        self.db.chats.create_index([("user_id", 1), ("updated_at", -1)])
        
        print("Đã tạo tất cả indexes cho MongoDB")

    def close(self):
        if self.client:
            self.client.close()
            self.client = None
            self.db = None

mongodb_client = MongoDBClient()

# Lấy database instance để sử dụng trong các modules khác
db = mongodb_client.get_database()