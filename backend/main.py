from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Any, Optional
import time
import functools
import json
import pandas as pd
import numpy as np
from datetime import datetime
import os
from google import genai
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from fastapi.middleware.cors import CORSMiddleware
from rouge_score import rouge_scorer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from uuid import uuid4
from pymongo import MongoClient
from dotenv import load_dotenv
import bcrypt

# Import router từ các module khác
from api.chat import router as chat_router
from api.admin import router as admin_router

# Load .env file
load_dotenv()

# Tải các biến môi trường
MONGODB_USERNAME = os.getenv("MONGODB_USERNAME")
MONGODB_PASSWORD = os.getenv("MONGODB_PASSWORD", "password")
MONGODB_HOST = os.getenv("MONGODB_HOST")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "chatbot_db")
MONGODB_URI = f"mongodb+srv://{MONGODB_USERNAME}:{MONGODB_PASSWORD}{MONGODB_HOST}/{MONGODB_DATABASE}?retryWrites=true&w=majority"

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "law_data")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBayTCsGKqfARlNRmlssmFfsUM8UvLjXCY")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-base")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

TOP_K = int(os.getenv("TOP_K", "5"))
MAX_CONTEXT_LENGTH = int(os.getenv("MAX_CONTEXT_LENGTH", "4000"))

nltk.download('punkt', quiet=True)

# === MONGODB SETUP ===
try:
    mongodb_client = MongoClient(MONGODB_URI)
    db = mongodb_client.get_database()  # Hoặc mongodb_client[MONGODB_DATABASE]
    
    # Test connection
    mongodb_client.admin.command('ping')
    print("Kết nối MongoDB thành công")
    
    # Các collections
    users_collection = db["users"]
    
except Exception as e:
    print(f"Lỗi kết nối MongoDB: {str(e)}")
    raise e

# === DECORATOR BENCHMARK ===
def benchmark(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        execution_time = time.time() - start_time
        print(f"Thời gian thực thi {func.__name__}: {execution_time:.4f} giây")
        # Thêm thời gian vào kết quả nếu nó là dict
        if isinstance(result, dict):
            result['execution_time'] = execution_time
        return result
    return wrapper

app = FastAPI()

# Thêm CORS để frontend có thể gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite mặc định chạy trên port 5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các router
app.include_router(chat_router)
app.include_router(admin_router)

# Khởi tạo embedding function cho ChromaDB
embedding_function = SentenceTransformerEmbeddingFunction(
    model_name=EMBEDDING_MODEL
)

# Khởi tạo ROUGE scorer
scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)

# === KHỞI TẠO CHROMADB CLIENT ===
try:
    chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    
    # Kiểm tra xem collection đã tồn tại chưa
    try:
        collection = chroma_client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_function
        )
        print(f"Đã kết nối tới collection '{COLLECTION_NAME}', có {collection.count()} chunks")
    except Exception as e:
        print(f"Không thể kết nối tới collection '{COLLECTION_NAME}': {e}")
        # Tạo collection mới nếu chưa tồn tại
        collection = chroma_client.create_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_function
        )
        print(f"Đã tạo collection mới '{COLLECTION_NAME}'")
        
except Exception as e:
    print(f"Không thể kết nối tới ChromaDB: {e}")
    raise Exception("Không thể kết nối tới cơ sở dữ liệu. Vui lòng kiểm tra kết nối ChromaDB.")

# === KHỞI TẠO GEMINI CLIENT ===
client = genai.Client(api_key=GEMINI_API_KEY)

# === INPUT SCHEMA ===
class UserCreate(BaseModel):
    """Model cho việc tạo người dùng mới"""
    username: str
    email: EmailStr
    password: str  # Password gốc, sẽ được hash trước khi lưu
    fullName: str
    phoneNumber: Optional[str] = None

class UserLogin(BaseModel):
    """Model cho việc đăng nhập"""
    username: str
    password: str

class Token(BaseModel):
    """Model cho token trả về sau khi đăng nhập"""
    access_token: str
    token_type: str = "bearer"
    user_id: str

# === MONGODB UTILITY FUNCTIONS ===
def hash_password(password: str) -> str:
    """Tạo hash password với bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra password"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def save_user(user_data: dict) -> str:
    """Lưu thông tin người dùng vào MongoDB"""
    # Hash password trước khi lưu
    if 'password' in user_data:
        user_data['password'] = hash_password(user_data['password'])
    
    user_data["created_at"] = datetime.now()
    
    result = users_collection.insert_one(user_data)
    return str(result.inserted_id)

def get_user_by_username(username: str):
    """Lấy thông tin người dùng từ MongoDB theo tên đăng nhập"""
    return users_collection.find_one({"username": username})

def get_user_by_id(user_id: str):
    """Lấy thông tin người dùng từ MongoDB theo ID"""
    from bson.objectid import ObjectId
    return users_collection.find_one({"_id": ObjectId(user_id)})

# === FUNCTION ĐÁNH GIÁ ĐỘ TƯƠNG ĐỒNG ===
def calculate_similarity_scores(predicted_answer, reference_answer):
    # 1. Tính ROUGE scores
    rouge_scores = scorer.score(predicted_answer, reference_answer)
    
    # 2. Tính Cosine similarity
    # Sử dụng embedding model đã có sẵn
    pred_embedding = embedding_function([predicted_answer])
    ref_embedding = embedding_function([reference_answer])
    
    # Chuyển đổi sang numpy array và tính cosine similarity
    pred_embedding_np = np.array(pred_embedding)
    ref_embedding_np = np.array(ref_embedding)
    
    cosine_sim = cosine_similarity(pred_embedding_np, ref_embedding_np)[0][0]
    
    # Tổng hợp kết quả
    result = {
        "rouge1_f1": rouge_scores["rouge1"].fmeasure,
        "rouge2_f1": rouge_scores["rouge2"].fmeasure,
        "rougeL_f1": rouge_scores["rougeL"].fmeasure,
        "cosine_similarity": float(cosine_sim)
    }
    
    return result

# === ENDPOINT NGƯỜI DÙNG ===
@app.post("/users/register")
async def register_user(user: UserCreate):
    try:
        # Kiểm tra xem người dùng đã tồn tại chưa
        existing_user = get_user_by_username(user.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Tên người dùng đã tồn tại")
        
        # Kiểm tra email đã tồn tại chưa
        existing_email = users_collection.find_one({"email": user.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email đã được sử dụng")
        
        # Tạo người dùng mới
        user_data = user.dict()
        
        # Lưu vào MongoDB và lấy ID
        user_id = save_user(user_data)
        
        return {
            "message": "Đăng ký thành công",
            "user_id": user_id
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in /users/register endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/login")
async def login_user(user_login: UserLogin):
    try:
        # Tìm user trong database
        user = get_user_by_username(user_login.username)
        if not user:
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
        
        # Kiểm tra mật khẩu
        if not verify_password(user_login.password, user["password"]):
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
        
        # Tạo token đơn giản (trong thực tế nên dùng JWT)
        token = str(uuid4())
        
        # Lưu token vào user (hoặc trong bảng sessions riêng)
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"token": token, "last_login": datetime.now()}}
        )
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": str(user["_id"])
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in /users/login endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}")
async def get_user_info(user_id: str):
    try:
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        # Tạo đối tượng trả về (loại bỏ password)
        user_data = {
            "id": str(user["_id"]),
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "fullName": user.get("fullName", ""),
            "phoneNumber": user.get("phoneNumber", ""),
            "created_at": user.get("created_at", datetime.now())
        }
        
        return user_data
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in get_user_info endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === ENDPOINT KIỂM TRA TRẠNG THÁI ===
@app.get("/status")
async def status():
    try:
        collection_count = collection.count()
        mongodb_status = "connected"
        
        try:
            # Kiểm tra kết nối MongoDB
            mongodb_client.admin.command('ping')
        except Exception as e:
            mongodb_status = f"disconnected: {str(e)}"
        
        return {
            "status": "ok", 
            "message": "API đang hoạt động bình thường",
            "database": {
                "chromadb": {
                    "status": "connected",
                    "collection": COLLECTION_NAME,
                    "documents_count": collection_count
                },
                "mongodb": {
                    "status": mongodb_status
                }
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"API gặp sự cố: {str(e)}",
            "database": {
                "chromadb": {"status": "disconnected"},
                "mongodb": {"status": "disconnected"}
            }
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)