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
from uuid import uuid4, UUID
from pymongo import MongoClient
from dotenv import load_dotenv
import bcrypt

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
    chat_history_collection = db["chat_history"]
    feedback_collection = db["feedback"]
    
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

class ChatUser(BaseModel):
    user_id: Optional[str] = None
    session_id: Optional[str] = None

class QueryInput(BaseModel):
    query: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None

class UserFeedback(BaseModel):
    chat_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    is_accurate: Optional[bool] = None
    is_helpful: Optional[bool] = None

class SearchResult(BaseModel):
    id: Optional[str] = None
    query: str
    answer: str
    retrieval_time: Optional[float] = None
    generation_time: Optional[float] = None
    total_time: Optional[float] = None

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

def save_chat_message(user_id, query, answer, context_items=None, retrieved_chunks=None, performance_metrics=None):
    """Lưu tin nhắn chat vào MongoDB"""
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
    return str(result.inserted_id)

def get_user_chat_history(user_id, limit=20):
    """Lấy lịch sử chat của người dùng"""
    from bson.objectid import ObjectId
    
    try:
        user_id_obj = ObjectId(user_id)
    except:
        return []
    
    return list(chat_history_collection.find(
        {"user_id": user_id},
        {"query": 1, "answer": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(limit))

def save_user_feedback(chat_id, feedback_data):
    """Lưu phản hồi của người dùng về câu trả lời"""
    feedback_data["chat_id"] = chat_id
    feedback_data["timestamp"] = datetime.now()
    
    result = feedback_collection.insert_one(feedback_data)
    return str(result.inserted_id)

# === HÀM ĐÁNH GIÁ ĐỘ TƯƠNG ĐỒNG ===
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

# === HÀM TRUY XUẤT DỮ LIỆU TỪ CHROMADB ===
@benchmark
def retrieve_from_chroma(query: str, top_k: int = TOP_K):
    try:
        # Chuẩn bị query
        query_text = f"query: {query}"
        
        # Thực hiện truy vấn
        results = collection.query(
            query_texts=[query_text],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        
        # Xử lý kết quả
        context_items = []
        retrieved_chunks = []
        
        if results["documents"] and len(results["documents"]) > 0:
            documents = results["documents"][0]  # Lấy kết quả của query đầu tiên
            metadatas = results["metadatas"][0]
            
            for i, (doc, meta) in enumerate(zip(documents, metadatas)):
                # Bỏ tiền tố "passage: " nếu có
                if doc.startswith("passage: "):
                    doc = doc[9:]
                
                # Xây dựng thông tin nguồn dựa trên metadata
                source_info = f"(Nguồn: {meta.get('doc_type', '')} {meta.get('doc_id', '')}"
                if "effective_date" in meta:
                    source_info += f", có hiệu lực từ {meta.get('effective_date', '')}"
                source_info += ")"
                
                # Lưu chunk_id
                if 'chunk_id' in meta:
                    retrieved_chunks.append(meta['chunk_id'])
                
                # Tạo một mục context với nội dung và nguồn
                context_item = f"{doc} {source_info}"
                context_items.append(context_item)
                
        return {
            "context_items": context_items,
            "retrieved_chunks": retrieved_chunks
        }
    except Exception as e:
        print(f"Lỗi khi truy vấn ChromaDB: {str(e)}")
        return {
            "context_items": [],
            "retrieved_chunks": []
        }

# === GỌI GEMINI ===
@benchmark
def generate_response_with_gemini(query: str, context_items: List[str]):
    context_text = "\n\n".join([f"[Đoạn văn bản {i+1}]\n{item}" for i, item in enumerate(context_items)])
    prompt = f"""[SYSTEM INSTRUCTION]
Bạn là trợ lý tư vấn chính sách người có công tại Việt Nam, được phát triển để giải đáp thắc mắc dựa trên văn bản pháp luật chính thức. Nhiệm vụ của bạn là cung cấp thông tin chính xác, đầy đủ, và dễ hiểu dựa trên các đoạn văn bản pháp luật được cung cấp.

### CÁCH XỬ LÝ THÔNG TIN
1. Phân tích kỹ ĐOẠN VĂN BẢN được trích xuất từ cơ sở dữ liệu.
2. Tổng hợp thông tin từ nhiều văn bản, ưu tiên theo nguyên tắc:
   - Văn bản còn hiệu lực > văn bản hết hiệu lực
   - Văn bản mới > văn bản cũ
   - Văn bản cấp cao > văn bản cấp thấp (Nghị định > Thông tư > Công văn)
   - Văn bản chuyên biệt > văn bản chung
3. Khi có mâu thuẫn giữa các văn bản, hãy nêu rõ sự mâu thuẫn và áp dụng các nguyên tắc trên.

### HƯỚNG DẪN TRẢ LỜI
1. Câu trả lời phải DỄ HIỂU với người không có chuyên môn pháp lý.
2. LUÔN trích dẫn số hiệu văn bản, điều khoản cụ thể (VD: \"Theo Điều 3, Quyết định 12/2012/QĐ-UBND\").
3. Nếu thông tin từ đoạn văn bản không đủ, hãy nói rõ những gì bạn biết và những gì bạn không chắc chắn.
4. Sử dụng cấu trúc rõ ràng: câu trả lời ngắn gọn → giải thích chi tiết → trích dẫn → thông tin bổ sung (nếu có).
5. Khi CÂU HỎI KHÔNG LIÊN QUAN đến chính sách người có công, hãy lịch sự giải thích rằng bạn chuyên về lĩnh vực này và đề nghị người dùng đặt câu hỏi liên quan.
6. Bạn nên nhớ là bạn là trợ lý tư vấn về chính sách người có công nói chung, chứ không phải là người có công với cách mạng nhé, vậy nên không được nhắc tới từ người có công với cách mạng. Hai lĩnh vực đó là khác nhau.

### ĐỊNH DẠNG TRẢ LỜI
- Sử dụng ngôn ngữ đơn giản, rõ ràng
- Tổ chức thành đoạn ngắn, dễ đọc
- Có thể sử dụng danh sách đánh số khi liệt kê nhiều điểm
- Sử dụng in đậm cho các THUẬT NGỮ QUAN TRỌNG

[USER QUERY]
{query}

[CONTEXT]
{context_text}"""

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )
        return {
            "answer": response.text
        }
    except Exception as e:
        print(f"Error calling Gemini API: {str(e)}")
        return {
            "answer": "Xin lỗi, tôi đang gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau."
        }

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

# Thêm vào file main.py

# === CHAT SCHEMAS AND MODELS ===
class ChatCreate(BaseModel):
    """Model cho việc tạo chat mới"""
    user_id: str
    title: str = "Cuộc trò chuyện mới"

class ChatMessage(BaseModel):
    """Model cho tin nhắn trong chat"""
    id: Optional[str] = None
    sender: str  # 'user' hoặc 'bot'
    text: str
    timestamp: Optional[datetime] = None

class Chat(BaseModel):
    """Model cho một cuộc trò chuyện hoàn chỉnh"""
    id: Optional[str] = None
    user_id: str
    title: str
    messages: List[ChatMessage] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# === CHAT DATABASE FUNCTIONS ===
def create_new_chat(chat_data: dict) -> str:
    """Tạo cuộc trò chuyện mới trong MongoDB"""
    chat_data["created_at"] = datetime.now()
    chat_data["updated_at"] = datetime.now()
    chat_data["messages"] = []
    
    result = db["chats"].insert_one(chat_data)
    return str(result.inserted_id)

def get_chat_by_id(chat_id: str):
    """Lấy thông tin cuộc trò chuyện theo ID"""
    from bson.objectid import ObjectId
    try:
        return db["chats"].find_one({"_id": ObjectId(chat_id)})
    except:
        return None

def get_user_chats(user_id: str, limit: int = 20):
    """Lấy danh sách cuộc trò chuyện của người dùng"""
    return list(db["chats"].find(
        {"user_id": user_id},
        {"title": 1, "created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1).limit(limit))

def add_message_to_chat(chat_id: str, message: dict) -> bool:
    """Thêm tin nhắn vào cuộc trò chuyện"""
    from bson.objectid import ObjectId
    try:
        message["timestamp"] = datetime.now()
        
        result = db["chats"].update_one(
            {"_id": ObjectId(chat_id)},
            {
                "$push": {"messages": message},
                "$set": {"updated_at": datetime.now()}
            }
        )
        
        return result.modified_count > 0
    except Exception as e:
        print(f"Error adding message to chat: {str(e)}")
        return False

def update_chat_title(chat_id: str, title: str) -> bool:
    """Cập nhật tiêu đề cuộc trò chuyện"""
    from bson.objectid import ObjectId
    try:
        result = db["chats"].update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {"title": title, "updated_at": datetime.now()}}
        )
        return result.modified_count > 0
    except:
        return False

# === CHAT ENDPOINTS ===
@app.post("/chats/create", response_model=dict)
async def create_chat(chat: ChatCreate):
    try:
        chat_id = create_new_chat(chat.dict())
        return {
            "id": chat_id,
            "message": "Tạo cuộc trò chuyện mới thành công"
        }
    except Exception as e:
        print(f"Error in /chats/create endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chats/{user_id}", response_model=List[dict])
async def get_chats(user_id: str, limit: int = 20):
    try:
        chats = get_user_chats(user_id, limit)
        # Chuyển đổi ObjectId sang string
        for chat in chats:
            chat["id"] = str(chat.pop("_id"))
        return chats
    except Exception as e:
        print(f"Error in /chats endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chats/{chat_id}/messages", response_model=dict)
async def get_chat_messages(chat_id: str):
    try:
        chat = get_chat_by_id(chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")
        
        # Chuyển đổi ObjectId sang string
        chat_data = {
            "id": str(chat["_id"]),
            "title": chat.get("title", "Cuộc trò chuyện"),
            "messages": chat.get("messages", []),
            "created_at": chat.get("created_at", datetime.now()),
            "updated_at": chat.get("updated_at", datetime.now())
        }
        
        return chat_data
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in /chats/{chat_id}/messages endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chats/{chat_id}/messages", response_model=dict)
async def add_chat_message(chat_id: str, message: ChatMessage):
    try:
        success = add_message_to_chat(chat_id, message.dict())
        if not success:
            raise HTTPException(status_code=404, detail="Không thể thêm tin nhắn vào cuộc trò chuyện")
        
        return {
            "message": "Thêm tin nhắn thành công",
            "chat_id": chat_id
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in add message endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/chats/{chat_id}/title", response_model=dict)
async def update_chat_title_endpoint(chat_id: str, title_data: dict):
    try:
        title = title_data.get("title", "")
        if not title:
            raise HTTPException(status_code=400, detail="Tiêu đề không được để trống")
        
        success = update_chat_title(chat_id, title)
        if not success:
            raise HTTPException(status_code=404, detail="Không thể cập nhật tiêu đề cuộc trò chuyện")
        
        return {
            "message": "Cập nhật tiêu đề thành công",
            "chat_id": chat_id
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in update title endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === MODIFIED ASK ENDPOINT ===
@app.post("/ask", response_model=SearchResult)
async def ask(input: QueryInput):
    try:
        start_time = time.time()
        
        # 1. Retrieval
        retrieval_result = retrieve_from_chroma(input.query)
        context_items = retrieval_result['context_items']
        retrieved_chunks = retrieval_result['retrieved_chunks']
        retrieval_time = retrieval_result.get('execution_time', 0)
        
        if not context_items:
            answer = "Tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu. Vui lòng thử cách diễn đạt khác hoặc hỏi một câu hỏi khác về chính sách người có công."
            
            # Tạo ID cho cuộc trò chuyện
            chat_id = str(uuid4())
            
            # Lưu vào lịch sử nếu có thông tin người dùng
            if input.user_id:
                # Nếu có session_id (chat_id), thêm tin nhắn vào cuộc trò chuyện đó
                if input.session_id:
                    user_message = {
                        "sender": "user",
                        "text": input.query,
                        "timestamp": datetime.now()
                    }
                    
                    bot_message = {
                        "sender": "bot",
                        "text": answer,
                        "timestamp": datetime.now()
                    }
                    
                    add_message_to_chat(input.session_id, user_message)
                    add_message_to_chat(input.session_id, bot_message)
                    chat_id = input.session_id
                else:
                    # Tạo chat mới nếu không có session_id
                    chat_data = {
                        "user_id": input.user_id,
                        "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                        "messages": [
                            {
                                "sender": "user",
                                "text": input.query,
                                "timestamp": datetime.now()
                            },
                            {
                                "sender": "bot",
                                "text": answer,
                                "timestamp": datetime.now()
                            }
                        ]
                    }
                    chat_id = create_new_chat(chat_data)
            
            return {
                "id": chat_id,
                "query": input.query,
                "answer": answer,
                "retrieval_time": retrieval_time,
                "generation_time": 0,
                "total_time": retrieval_time
            }
        
        # 2. Generation
        generation_result = generate_response_with_gemini(input.query, context_items)
        answer = generation_result['answer']
        generation_time = generation_result.get('execution_time', 0)
        
        # 3. Tính tổng thời gian
        total_time = time.time() - start_time
        
        # 4. Tạo ID cho cuộc trò chuyện
        chat_id = str(uuid4())
        
        # 5. Lưu vào lịch sử nếu có thông tin người dùng
        if input.user_id:
            # Nếu có session_id (chat_id), thêm tin nhắn vào cuộc trò chuyện đó
            if input.session_id:
                user_message = {
                    "sender": "user",
                    "text": input.query,
                    "timestamp": datetime.now()
                }
                
                bot_message = {
                    "sender": "bot",
                    "text": answer,
                    "context": context_items,
                    "retrieved_chunks": retrieved_chunks,
                    "timestamp": datetime.now()
                }
                
                add_message_to_chat(input.session_id, user_message)
                add_message_to_chat(input.session_id, bot_message)
                chat_id = input.session_id
            else:
                # Tạo chat mới nếu không có session_id
                chat_data = {
                    "user_id": input.user_id,
                    "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                    "messages": [
                        {
                            "sender": "user",
                            "text": input.query,
                            "timestamp": datetime.now()
                        },
                        {
                            "sender": "bot",
                            "text": answer,
                            "context": context_items,
                            "retrieved_chunks": retrieved_chunks,
                            "timestamp": datetime.now()
                        }
                    ]
                }
                chat_id = create_new_chat(chat_data)
        
        return {
            "id": chat_id,
            "query": input.query,
            "answer": answer,
            "top_chunks": context_items[:3],  # Trả về 3 đoạn văn bản liên quan nhất
            "retrieval_time": retrieval_time,
            "generation_time": generation_time,
            "total_time": total_time
        }
    except Exception as e:
        print(f"Error in /ask endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
# === ENDPOINT PHẢN HỒI NGƯỜI DÙNG ===
@app.post("/feedback")
async def submit_feedback(feedback: UserFeedback):
    try:
        feedback_id = save_user_feedback(feedback.chat_id, feedback.dict())
        return {
            "message": "Cảm ơn bạn đã gửi phản hồi",
            "feedback_id": feedback_id
        }
    except Exception as e:
        print(f"Error in /feedback endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === ENDPOINT LỊCH SỬ CHAT ===
@app.get("/history/{user_id}")
async def get_chat_history(user_id: str, limit: int = 20):
    try:
        history = get_user_chat_history(user_id, limit)
        return {
            "user_id": user_id,
            "history": history
        }
    except Exception as e:
        print(f"Error in /history endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === ENDPOINT TRUY XUẤT DỮ LIỆU RIÊNG BIỆT ===
@app.post("/retrieve")
async def retrieve(input: QueryInput):
    try:
        retrieval_result = retrieve_from_chroma(input.query)
        
        return {
            "query": input.query,
            "contexts": retrieval_result['context_items'],
            "retrieved_chunks": retrieval_result['retrieved_chunks'],
            "count": len(retrieval_result['context_items']),
            "retrieval_time": retrieval_result.get('execution_time', 0)
        }
    except Exception as e:
        print(f"Error in /retrieve endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === ENDPOINT BENCHMARK ===
@app.post("/benchmark")
async def run_benchmark(input: QueryInput):
    try:
        benchmark_start = time.time()
        
        # 1. Retrieval
        retrieval_result = retrieve_from_chroma(input.query)
        context_items = retrieval_result['context_items']
        retrieved_chunks = retrieval_result['retrieved_chunks']
        retrieval_time = retrieval_result.get('execution_time', 0)
        
        # 2. Generation (nếu có context)
        if context_items:
            generation_result = generate_response_with_gemini(input.query, context_items)
            answer = generation_result['answer']
            generation_time = generation_result.get('execution_time', 0)
        else:
            answer = "Không tìm thấy dữ liệu liên quan."
            generation_time = 0
        
        # 3. Tính tổng thời gian
        total_time = time.time() - benchmark_start
        
        return {
            "query": input.query,
            "answer": answer,
            "retrieved_chunks": retrieved_chunks,
            "retrieval_time": retrieval_time,
            "generation_time": generation_time,
            "total_time": total_time
        }
    except Exception as e:
        print(f"Error in /benchmark endpoint: {str(e)}")
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

# === ENDPOINT CHẠY BENCHMARK VỚI TẬP DỮ LIỆU ===
@app.post("/run-benchmark")
async def run_full_benchmark(file_path: str = "benchmark.json", output_dir: str = "benchmark_results"):
    try:
        # Tạo thư mục kết quả nếu chưa tồn tại
        os.makedirs(output_dir, exist_ok=True)
        
        # Đọc file benchmark
        with open(file_path, 'r', encoding='utf-8') as f:
            benchmark_data = json.load(f)
        
        results = []
        
        # Tạo tên file kết quả với timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = os.path.join(output_dir, f"benchmark_results_{timestamp}.csv")
        
        # Chạy từng câu hỏi trong benchmark
        total_questions = len(benchmark_data.get('benchmark', []))
        print(f"Bắt đầu chạy benchmark với {total_questions} câu hỏi...")
        
        for i, item in enumerate(benchmark_data.get('benchmark', [])):
            question_id = item.get('id', f"q{i+1}")
            question = item.get('question', '')
            expected_answer = item.get('ground_truth', '')
            expected_contexts = item.get('contexts', [])
            
            print(f"Đang xử lý câu hỏi {i+1}/{total_questions}: {question_id}")
            
            # Gọi endpoint benchmark
            try:
                response = await run_benchmark(QueryInput(query=question))
                
                # Xử lý kết quả
                retrieval_time = response.get('retrieval_time', 0)
                generation_time = response.get('generation_time', 0)
                total_time = response.get('total_time', 0)
                answer = response.get('answer', '')
                retrieved_chunks = response.get('retrieved_chunks', [])
                
                # Tính retrieval score
                retrieval_score = 0
                if expected_contexts:
                    matches = set()
                    for retrieved in retrieved_chunks:
                        for expected in expected_contexts:
                            if expected in retrieved:
                                matches.add(expected)
                    print("Chunk tìm được:", retrieved_chunks)
                    print("Chunk mong đợi:", expected_contexts)
                    retrieval_score = len(matches) / len(expected_contexts) if expected_contexts else 0
                
                # Tính similarity scores
                similarity_scores = calculate_similarity_scores(answer, expected_answer)
                
                # Lưu kết quả
                result = {
                    'question_id': question_id,
                    'question': question,
                    'expected_contexts': ','.join(expected_contexts),
                    'retrieved_contexts': ','.join(retrieved_chunks),
                    'retrieval_score': retrieval_score,
                    'retrieval_time': retrieval_time,
                    'generation_time': generation_time,
                    'total_time': total_time,
                    'expected_answer': expected_answer[:500],  # Giới hạn để không quá dài
                    'answer': answer[:500],  # Giới hạn để không quá dài
                    'rouge1_f1': similarity_scores['rouge1_f1'],
                    'rouge2_f1': similarity_scores['rouge2_f1'],
                    'rougeL_f1': similarity_scores['rougeL_f1'],
                    'cosine_similarity': similarity_scores['cosine_similarity'],
                    'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                
                results.append(result)
                
                # Cập nhật file CSV sau mỗi câu hỏi
                df = pd.DataFrame(results)
                df.to_csv(csv_path, index=False, encoding='utf-8-sig')
                
                # In thông tin
                print(f"  - Thời gian: Retrieval={retrieval_time:.2f}s, Generation={generation_time:.2f}s, Total={total_time:.2f}s")
                print(f"  - Retrieval score: {retrieval_score:.2f}")
                print(f"  - Rouge-1 F1: {similarity_scores['rouge1_f1']:.2f}")
                print(f"  - Rouge-L F1: {similarity_scores['rougeL_f1']:.2f}")
                print(f"  - Cosine Similarity: {similarity_scores['cosine_similarity']:.2f}")
                
            except Exception as e:
                print(f"Lỗi khi xử lý câu hỏi {question_id}: {str(e)}")
                continue
        
        # Tính toán thống kê
        if results:
            avg_retrieval_time = sum(r['retrieval_time'] for r in results) / len(results)
            avg_generation_time = sum(r['generation_time'] for r in results) / len(results)
            avg_total_time = sum(r['total_time'] for r in results) / len(results)
            avg_retrieval_score = sum(r['retrieval_score'] for r in results) / len(results)
            avg_rouge1_f1 = sum(r['rouge1_f1'] for r in results) / len(results)
            avg_rouge2_f1 = sum(r['rouge2_f1'] for r in results) / len(results)
            avg_rougeL_f1 = sum(r['rougeL_f1'] for r in results) / len(results)
            avg_cosine_similarity = sum(r['cosine_similarity'] for r in results) / len(results)
            
            # Thêm hàng tổng kết vào DataFrame
            summary = {
                'question_id': 'SUMMARY',
                'question': f'Avg scores for {len(results)} questions',
                'expected_contexts': '',
                'retrieved_contexts': '',
                'retrieval_score': avg_retrieval_score,
                'retrieval_time': avg_retrieval_time,
                'generation_time': avg_generation_time,
                'total_time': avg_total_time,
                'expected_answer': '',
                'answer': '',
                'rouge1_f1': avg_rouge1_f1,
                'rouge2_f1': avg_rouge2_f1,
                'rougeL_f1': avg_rougeL_f1,
                'cosine_similarity': avg_cosine_similarity,
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            results.append(summary)
            
            # Lưu lại file kết quả cuối cùng
            df = pd.DataFrame(results)
            df.to_csv(csv_path, index=False, encoding='utf-8-sig')
        
        return {
            "message": f"Benchmark đã hoàn thành với {len(results)-1} câu hỏi",
            "file_path": csv_path,
            "stats": {
                "avg_retrieval_time": avg_retrieval_time,
                "avg_generation_time": avg_generation_time,
                "avg_total_time": avg_total_time,
                "avg_retrieval_score": avg_retrieval_score,
                "avg_rouge1_f1": avg_rouge1_f1,
                "avg_rouge2_f1": avg_rouge2_f1,
                "avg_rougeL_f1": avg_rougeL_f1,
                "avg_cosine_similarity": avg_cosine_similarity
            }
        }
    
    except Exception as e:
        print(f"Error in /run-benchmark endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)