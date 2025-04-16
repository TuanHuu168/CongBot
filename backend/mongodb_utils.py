from pymongo import MongoClient
from datetime import datetime
from config import MONGODB_URI

# Tạo kết nối MongoDB
try:
    client = MongoClient(MONGODB_URI)
    db = client.get_database()
    
    # Các collection
    users_collection = db["users"]
    chat_history_collection = db["chat_history"]
    user_feedback_collection = db["user_feedback"]
    
    print("Kết nối MongoDB thành công!")
    
except Exception as e:
    print(f"Lỗi kết nối MongoDB: {e}")
    raise e

# Các hàm tiện ích MongoDB

def save_user(user_data):
    user_data["created_at"] = datetime.now()
    user_data["updated_at"] = datetime.now()
    
    result = users_collection.insert_one(user_data)
    return result.inserted_id

def get_user(user_id):
    return users_collection.find_one({"_id": user_id})

def save_chat_message(user_id, query, answer, context_items=None, retrieved_chunks=None, performance_metrics=None):
    chat_data = {
        "user_id": user_id,
        "query": query,
        "answer": answer,
        "context_items": context_items or [],
        "retrieved_chunks": retrieved_chunks or [],
        "performance": performance_metrics or {},
        "timestamp": datetime.now()
    }
    
    result = chat_history_collection.insert_one(chat_data)
    return result.inserted_id

def get_user_chat_history(user_id, limit=20):
    return list(chat_history_collection.find(
        {"user_id": user_id},
        {"query": 1, "answer": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(limit))

def save_user_feedback(chat_id, feedback_data):
    feedback_data["chat_id"] = chat_id
    feedback_data["timestamp"] = datetime.now()
    
    result = user_feedback_collection.insert_one(feedback_data)
    return result.inserted_id