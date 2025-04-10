from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Import các router
from api.chat import router as chat_router
from api.admin import router as admin_router
from api.user import router as user_router

# Load .env file
load_dotenv()

# Tạo ứng dụng FastAPI
app = FastAPI(
    title="CongBot API",
    description="API cho chatbot tư vấn chính sách người có công",
    version="1.0.0"
)

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
app.include_router(user_router)

# Endpoint gốc
@app.get("/")
async def root():
    return {
        "message": "CongBot API - Chatbot tư vấn chính sách người có công",
        "version": "1.0.0",
        "status": "running"
    }

# Endpoint kiểm tra trạng thái
@app.get("/status")
async def status():
    """Kiểm tra trạng thái hệ thống"""
    try:
        from database.chroma_client import chroma_client
        from database.mongodb_client import mongodb_client
        
        # Kiểm tra ChromaDB
        collection = chroma_client.get_collection()
        collection_count = collection.count()
        chroma_status = "connected"
        
        # Kiểm tra MongoDB
        db = mongodb_client.get_database()
        try:
            db.command('ping')
            mongodb_status = "connected"
        except Exception as e:
            mongodb_status = f"disconnected: {str(e)}"
        
        return {
            "status": "ok", 
            "message": "API đang hoạt động bình thường",
            "database": {
                "chromadb": {
                    "status": chroma_status,
                    "collection": collection.name,
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
    # Đảm bảo indexes được tạo khi khởi động ứng dụng
    from database.mongodb_client import mongodb_client
    mongodb_client.create_indexes()
    
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)