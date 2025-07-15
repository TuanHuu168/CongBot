from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Import các router
from api.chat import router as chat_router
from api.admin import router as admin_router
from api.user import router as user_router
from database.mongodb_client import mongodb_client

# Import cho Elasticsearch integration
from database.elasticsearch_client import elasticsearch_client

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
    allow_origins=["http://localhost:5173"],
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
        "status": "running",
        "features": {
            "vector_search": True,
            "elasticsearch": True,
            "hybrid_search": True,
            "cache_system": True
        }
    }

# Endpoint kiểm tra trạng thái hệ thống
@app.get("/status")
async def status():
    try:
        from database.chroma_client import get_chroma_client
        from database.mongodb_client import mongodb_client
       
        # Kiểm tra ChromaDB
        chroma_client = get_chroma_client()
        collection = chroma_client.get_collection()
       
        if collection:
            collection_count = collection.count()
            chroma_status = "connected"
            collection_name = collection.name
        else:
            collection_count = 0
            chroma_status = "disconnected"
            collection_name = "none"
       
        # Kiểm tra MongoDB
        db = mongodb_client.get_database()
        try:
            db.command('ping')
            mongodb_status = "connected"
        except Exception as e:
            mongodb_status = f"disconnected: {str(e)}"
        
        # Kiểm tra Elasticsearch
        es_health = elasticsearch_client.health_check()
        es_status = es_health.get("status", "disconnected")
        
        # Kiểm tra Hybrid Service
        try:
            hybrid_stats = retrieval_service.get_stats()
            hybrid_status = "connected"
        except Exception as e:
            hybrid_stats = {"error": str(e)}
            hybrid_status = "error"
        
        # Xác định overall status
        all_systems_ok = all([
            chroma_status == "connected",
            mongodb_status == "connected", 
            es_status == "connected"
        ])
        
        overall_status = "ok" if all_systems_ok else "warning"
        if chroma_status == "error" or mongodb_status.startswith("disconnected") or es_status == "error":
            overall_status = "error"
       
        return {
            "status": overall_status,
            "message": "API đang hoạt động bình thường" if all_systems_ok else "API hoạt động nhưng có vấn đề với một số hệ thống",
            "database": {
                "chromadb": {
                    "status": chroma_status,
                    "collection": collection_name,
                    "documents_count": collection_count,
                    "storage_type": "local_persistent"
                },
                "mongodb": {
                    "status": mongodb_status
                },
                "elasticsearch": {
                    "status": es_status,
                    "cluster_status": es_health.get("cluster_status", "unknown"),
                    "cluster_name": es_health.get("cluster_name", "unknown"),
                    "number_of_nodes": es_health.get("number_of_nodes", 0),
                    "index_stats": es_health.get("index_stats", {})
                },
                "hybrid_search": {
                    "status": hybrid_status,
                    "stats": hybrid_stats
                }
            },
            "search_capabilities": {
                "vector_search": chroma_status == "connected",
                "elasticsearch_search": es_status == "connected",
                "hybrid_search": all_systems_ok,
                "cache_system": mongodb_status == "connected"
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"API gặp sự cố: {str(e)}",
            "database": {
                "chromadb": {"status": "error", "error": str(e)},
                "mongodb": {"status": "disconnected"},
                "elasticsearch": {"status": "error", "error": str(e)},
                "hybrid_search": {"status": "error", "error": str(e)}
            },
            "search_capabilities": {
                "vector_search": False,
                "elasticsearch_search": False,
                "hybrid_search": False,
                "cache_system": False
            }
        }

# Endpoint health check đơn giản
@app.get("/health")
async def health_check():
    try:
        # Kiểm tra nhanh các service chính
        mongo_ok = mongodb_client.get_database() is not None
        es_ping = elasticsearch_client.get_client() and elasticsearch_client.get_client().ping()
        
        return {
            "status": "healthy" if (mongo_ok and es_ping) else "unhealthy",
            "mongodb": mongo_ok,
            "elasticsearch": es_ping,
            "timestamp": os.popen('date').read().strip()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": os.popen('date').read().strip()
        }

# Endpoint thông tin hệ thống
@app.get("/info")
async def system_info():
    try:
        from config import EMBEDDING_MODEL_NAME, GEMINI_MODEL, ES_CONFIG
        
        return {
            "application": {
                "name": "CongBot API",
                "version": "1.0.0",
                "description": "API cho chatbot tư vấn chính sách người có công"
            },
            "models": {
                "embedding_model": EMBEDDING_MODEL_NAME,
                "generation_model": GEMINI_MODEL
            },
            "search_config": {
                "elasticsearch_weight": ES_CONFIG.ELASTIC_WEIGHT,
                "vector_weight": ES_CONFIG.VECTOR_WEIGHT,
                "index_name": ES_CONFIG.INDEX_NAME,
                "bulk_size": ES_CONFIG.BULK_SIZE
            },
            "endpoints": {
                "chat": "/ask",
                "hybrid_search": "/hybrid-retrieve",
                "admin": "/status",
                "elasticsearch_admin": "/elasticsearch/status"
            }
        }
    except Exception as e:
        return {
            "error": f"Cannot load system info: {str(e)}"
        }

if __name__ == "__main__":
    print("Starting CongBot API with Elasticsearch integration...")
    
    # Tạo indexes cho MongoDB khi khởi động
    try:
        print("Initializing MongoDB indexes...")
        mongodb_client.create_indexes()
        print("MongoDB indexes created successfully")
    except Exception as e:
        print(f"Warning: MongoDB index creation failed: {str(e)}")
    
    # Khởi tạo Elasticsearch
    try:
        print("Initializing Elasticsearch connection...")
        elasticsearch_client.initialize()
        if elasticsearch_client.get_client() and elasticsearch_client.get_client().ping():
            print("Elasticsearch connected successfully")
        else:
            print("Warning: Elasticsearch connection failed")
    except Exception as e:
        print(f"Warning: Elasticsearch initialization failed: {str(e)}")
    
    print("All services initialized. Starting API server...")
   
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)