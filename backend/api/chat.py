"""
API endpoints cho chức năng chat
"""
from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
import time
import uuid
from bson.objectid import ObjectId
import functools

# Import services
from services.generation_service import generation_service
from services.retrieval_service import retrieval_service
from database.mongodb_client import mongodb_client
from database.chroma_client import chroma_client

# Import models
from models.conversation import ConversationModel, ConversationCreate, Exchange, ClientInfo

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}},
)

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

# === MODELS ===
class QueryInput(BaseModel):
    """Input model cho việc gửi câu hỏi"""
    query: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    use_cache: bool = True
    client_info: Optional[Dict[str, str]] = None

class RetrievalResult(BaseModel):
    """Model kết quả truy xuất văn bản"""
    query: str
    contexts: List[str]
    retrieved_chunks: List[str]
    count: int
    retrieval_time: float

class ChatResponse(BaseModel):
    """Model phản hồi cho API chat"""
    id: Optional[str] = None
    query: str
    answer: str
    top_chunks: Optional[List[str]] = None
    retrieval_time: Optional[float] = None
    generation_time: Optional[float] = None
    total_time: Optional[float] = None

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

class UserFeedback(BaseModel):
    chat_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    is_accurate: Optional[bool] = None
    is_helpful: Optional[bool] = None

# === HÀM TRUY XUẤT DỮ LIỆU TỪ CHROMADB ===
@benchmark
def retrieve_from_chroma(query: str, top_k: int = 5):
    try:
        collection = chroma_client.get_collection()
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
    # Import client từ main module
    from google import genai
    import os
    
    # Lấy API key từ biến môi trường
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_API_KEY")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    
    # Khởi tạo client
    client = genai.Client(api_key=GEMINI_API_KEY)
    
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

# === CHAT DATABASE FUNCTIONS ===
def create_new_chat(chat_data: dict) -> str:
    """Tạo cuộc trò chuyện mới trong MongoDB"""
    db = mongodb_client.get_database()
    chat_data["created_at"] = datetime.now()
    chat_data["updated_at"] = datetime.now()
    
    # Đảm bảo title hợp lệ
    if "title" not in chat_data or not chat_data["title"] or len(chat_data["title"].strip()) == 0:
        chat_data["title"] = "Cuộc trò chuyện mới"
        
    if "messages" in chat_data:
        # Chuyển đổi từ messages sang exchanges nếu cần
        messages = chat_data.pop("messages", [])
        if len(messages) >= 2 and messages[0].get("sender") == "user" and messages[1].get("sender") == "bot":
            chat_data["exchanges"] = [{
                "exchangeId": str(uuid.uuid4()),
                "question": messages[0].get("text", ""),
                "answer": messages[1].get("text", ""),
                "timestamp": messages[1].get("timestamp", datetime.now()),
                "sourceDocuments": messages[1].get("retrieved_chunks", []),
                "processingTime": messages[1].get("processingTime", 0),
                "clientInfo": {
                    "platform": "web",
                    "deviceType": "desktop"
                }
            }]
        else:
            chat_data["exchanges"] = []
    else:
        chat_data["exchanges"] = []
    
    result = db["chats"].insert_one(chat_data)
    chat_id = str(result.inserted_id)
    
    # Kiểm tra xem title có trùng với ID không
    if chat_data["title"] == chat_id:
        db["chats"].update_one(
            {"_id": result.inserted_id},
            {"$set": {"title": "Cuộc trò chuyện mới"}}
        )
    
    return chat_id

def get_chat_by_id(chat_id: str):
    """Lấy thông tin cuộc trò chuyện theo ID"""
    db = mongodb_client.get_database()
    try:
        return db["chats"].find_one({"_id": ObjectId(chat_id)})
    except:
        return None

def get_user_chats(user_id: str, limit: int = 20):
    """Lấy danh sách cuộc trò chuyện của người dùng"""
    db = mongodb_client.get_database()
    return list(db["chats"].find(
        {"user_id": user_id},
        {"title": 1, "created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1).limit(limit))

def add_message_to_chat(chat_id: str, user_message: dict, bot_message: dict = None) -> bool:
    """Thêm cặp tin nhắn vào cuộc trò chuyện"""
    db = mongodb_client.get_database()
    try:
        # Tạo một exchange thay vì thêm riêng lẻ tin nhắn
        exchange = {
            "exchangeId": str(uuid.uuid4()),
            "question": user_message.get("text", ""),
            "answer": bot_message.get("text", "") if bot_message else "",
            "timestamp": datetime.now(),
            "sourceDocuments": bot_message.get("retrieved_chunks", []) if bot_message else [],
            "processingTime": bot_message.get("processingTime", 0) if bot_message else 0,
            "clientInfo": {
                "platform": "web",
                "deviceType": "desktop"
            }
        }
        
        # Cập nhật DB bằng cách thêm vào mảng exchanges
        result = db["chats"].update_one(
            {"_id": ObjectId(chat_id)},
            {
                "$push": {"exchanges": exchange},
                "$set": {"updated_at": datetime.now()}
            }
        )
        
        return result.modified_count > 0
    except Exception as e:
        print(f"Error adding exchange to chat: {str(e)}")
        return False

def update_chat_title(chat_id: str, title: str) -> bool:
    """Cập nhật tiêu đề cuộc trò chuyện"""
    db = mongodb_client.get_database()
    try:
        result = db["chats"].update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {"title": title, "updated_at": datetime.now()}}
        )
        return result.modified_count > 0
    except:
        return False

def save_user_feedback(chat_id, feedback_data):
    """Lưu phản hồi của người dùng về câu trả lời"""
    db = mongodb_client.get_database()
    feedback_collection = db["feedback"]
    
    feedback_data["chat_id"] = chat_id
    feedback_data["timestamp"] = datetime.now()
    
    result = feedback_collection.insert_one(feedback_data)
    return str(result.inserted_id)

def get_user_chat_history(user_id, limit=20):
    """Lấy lịch sử chat của người dùng"""
    db = mongodb_client.get_database()
    chat_history_collection = db["chat_history"]
    
    try:
        user_id_obj = ObjectId(user_id)
    except:
        return []
    
    return list(chat_history_collection.find(
        {"user_id": user_id},
        {"query": 1, "answer": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(limit))

# === ENDPOINTS ===
@router.post("/ask", response_model=ChatResponse)
async def ask(input: QueryInput):
    """Endpoint chính xử lý câu hỏi"""
    try:
        start_time = time.time()
        print(f"Processing query: '{input.query}' with session_id: {input.session_id}")
        
        # 1. Retrieval
        retrieval_result = retrieve_from_chroma(input.query)
        context_items = retrieval_result['context_items']
        retrieved_chunks = retrieval_result['retrieved_chunks']
        retrieval_time = retrieval_result.get('execution_time', 0)
        
        # 2. Generation
        if context_items:
            generation_result = generate_response_with_gemini(input.query, context_items)
            answer = generation_result['answer']
            generation_time = generation_result.get('execution_time', 0)
        else:
            answer = "Tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu."
            generation_time = 0
        
        # 3. Tính tổng thời gian
        total_time = time.time() - start_time
        
        # 4. Xử lý lưu trữ tin nhắn
        chat_id = input.session_id
        
        if input.user_id:
            # Chuẩn bị tin nhắn user và bot
            user_message = {
                "text": input.query,
                "timestamp": datetime.now()
            }
            
            bot_message = {
                "text": answer,
                "retrieved_chunks": retrieved_chunks,
                "context": context_items,
                "processingTime": total_time,
                "timestamp": datetime.now()
            }
            
            # Nếu có session_id, thêm tin nhắn vào cuộc trò chuyện đó
            if input.session_id:
                print(f"Adding message to existing chat: {input.session_id}")
                success = add_message_to_chat(input.session_id, user_message, bot_message)
                if not success:
                    print(f"Failed to add message to chat: {input.session_id}")
                    # Nếu không thành công, có thể chat không tồn tại, tạo mới
                    chat_data = {
                        "user_id": input.user_id,
                        "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                        "exchanges": []
                    }
                    chat_id = create_new_chat(chat_data)
                    add_message_to_chat(chat_id, user_message, bot_message)
            else:
                # Tạo chat mới nếu không có session_id
                print("Creating new chat")
                chat_data = {
                    "user_id": input.user_id,
                    "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                    "exchanges": []
                }
                chat_id = create_new_chat(chat_data)
                add_message_to_chat(chat_id, user_message, bot_message)
        
        # 5. Trả về kết quả
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retrieve", response_model=RetrievalResult)
async def retrieve(input: QueryInput):
    """Endpoint riêng để truy xuất ngữ cảnh từ các văn bản"""
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

@router.post("/benchmark")
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

@router.post("/chats/create", response_model=dict)
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

@router.get("/chats/{user_id}", response_model=List[dict])
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

@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Lấy thông tin của một cuộc hội thoại"""
    try:
        db = mongodb_client.get_database()
        conversation = db.conversations.find_one({"_id": ObjectId(conversation_id)})
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc hội thoại")
        
        # Chuyển ObjectId thành string
        conversation["_id"] = str(conversation["_id"])
        
        return conversation
    except Exception as e:
        print(f"Error in get_conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conversations")
async def list_conversations(limit: int = 10, skip: int = 0, user_id: Optional[str] = None):
    """Lấy danh sách các cuộc hội thoại"""
    try:
        db = mongodb_client.get_database()
        
        # Tạo query filter
        query = {}
        if user_id:
            query["userId"] = user_id
        
        # Thực hiện truy vấn
        conversations = list(db.conversations.find(
            query,
            {"exchanges": {"$slice": 1}}  # Chỉ lấy exchange đầu tiên để giảm kích thước dữ liệu
        ).sort("updatedAt", -1).skip(skip).limit(limit))
        
        # Chuyển ObjectId thành string
        for conv in conversations:
            conv["_id"] = str(conv["_id"])
        
        return conversations
    except Exception as e:
        print(f"Error in list_conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chats/{chat_id}/messages", response_model=dict)
async def get_chat_messages(chat_id: str):
    try:
        print(f"Fetching messages for chat_id: {chat_id}")
        chat = get_chat_by_id(chat_id)
        
        if not chat:
            print(f"Chat with id {chat_id} not found")
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")
        
        # Log cấu trúc dữ liệu để debug
        print(f"Chat structure: {chat.keys()}")
        if "exchanges" in chat:
            print(f"Found {len(chat['exchanges'])} exchanges")
        elif "messages" in chat:
            print(f"Found {len(chat['messages'])} messages")
        else:
            print("No messages or exchanges found in chat")
        
        # Xử lý dữ liệu để trả về theo định dạng mong muốn
        exchanges = chat.get("exchanges", [])
        messages = []
        
        # Chuyển đổi từ exchanges sang messages phù hợp với giao diện
        for exchange in exchanges:
            # Thêm tin nhắn user
            messages.append({
                "sender": "user",
                "text": exchange.get("question", ""),
                "timestamp": exchange.get("timestamp")
            })
            
            # Thêm tin nhắn bot
            messages.append({
                "sender": "bot",
                "text": exchange.get("answer", ""),
                "processingTime": exchange.get("processingTime", 0),
                "sourceDocuments": exchange.get("sourceDocuments", []),
                "timestamp": exchange.get("timestamp")
            })
        
        # Chuyển đổi ObjectId sang string
        chat_data = {
            "id": str(chat["_id"]),
            "title": chat.get("title", "Cuộc trò chuyện"),
            "messages": messages,
            "created_at": chat.get("created_at", datetime.now()),
            "updated_at": chat.get("updated_at", datetime.now())
        }
        
        return chat_data
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in /chats/{chat_id}/messages endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chats/{chat_id}/messages", response_model=dict)
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

@router.put("/chats/{chat_id}/title", response_model=dict)
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

@router.post("/feedback")
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

@router.get("/history/{user_id}")
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