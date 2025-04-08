import pymongo
from typing import Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import MONGO_URI, MONGODB_DATABASE

class MongoDBClient:
    _instance = None  # Singleton instance

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBClient, cls).__new__(cls)
            cls._instance.client = None
            cls._instance.db = None
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        """Khởi tạo kết nối tới MongoDB"""
        try:
            self.client = pymongo.MongoClient(MONGO_URI)
            self.db = self.client[MONGODB_DATABASE]
            print(f"Đã kết nối tới MongoDB: {MONGODB_DATABASE}")
        except Exception as e:
            print(f"Lỗi kết nối MongoDB: {str(e)}")
            self.client = None
            self.db = None
    
    def get_database(self):
        """Trả về đối tượng database"""
        if self.db is None:  # Thay vì if not self.db:
            self.initialize()
        return self.db
    
    def get_collection(self, collection_name: str):
        """Lấy collection từ MongoDB"""
        if self.db is None:  # Thay vì if not self.db:
            self.initialize()
        return self.db[collection_name]

    def create_indexes(self):
        """Tạo các index cho collections"""
        if not self.db:
            self.initialize()
        
        # Indexes cho users collection
        self.db.users.create_index([("username", pymongo.ASCENDING)], unique=True)
        self.db.users.create_index([("email", pymongo.ASCENDING)], unique=True)
        self.db.users.create_index([("status", pymongo.ASCENDING)])
        
        # Indexes cho conversations collection
        self.db.conversations.create_index([("userId", pymongo.ASCENDING)])
        self.db.conversations.create_index([
            ("userId", pymongo.ASCENDING), 
            ("updatedAt", pymongo.DESCENDING)
        ])
        self.db.conversations.create_index([("totalTokens", pymongo.ASCENDING)])
        self.db.conversations.create_index([("exchanges.timestamp", pymongo.ASCENDING)])
        self.db.conversations.create_index([("exchanges.exchangeId", 1)])
        
        # Indexes cho text_cache collection
        self.db.text_cache.create_index([("cacheId", pymongo.ASCENDING)], unique=True)
        self.db.text_cache.create_index([("normalizedQuestion", "text")])
        self.db.text_cache.create_index([("keywords", pymongo.ASCENDING)])
        self.db.text_cache.create_index([("relatedDocIds", pymongo.ASCENDING)])
        self.db.text_cache.create_index([("validityStatus", pymongo.ASCENDING)])
        self.db.text_cache.create_index([("expiresAt", pymongo.ASCENDING)], expireAfterSeconds=0)  # TTL index
        
        print("Đã tạo tất cả indexes cho MongoDB")

    def close(self):
        """Đóng kết nối tới MongoDB"""
        if self.client:
            self.client.close()
            self.client = None
            self.db = None

# Singleton instance
mongodb_client = MongoDBClient()

# Lấy database instance để sử dụng trong các modules khác
db = mongodb_client.get_database()