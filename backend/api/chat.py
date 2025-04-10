"""
API endpoints cho chức năng chat
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
import time
import uuid
from bson.objectid import ObjectId

# Import services
from services.generation_service import generation_service
from services.retrieval_service import retrieval_service
from database.mongodb_client import mongodb_client

router = APIRouter(
    prefix="",
    tags=["chat"],
)

# === MODELS ===
class QueryInput(BaseModel):
    """Input model cho việc gửi câu hỏi"""
    query: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    client_info: Optional[Dict[str, str]] = None

class ChatMessage(BaseModel):
    """Model cho tin nhắn trong chat"""
    sender: str  # 'user' hoặc 'bot'
    text: str
    timestamp: Optional[datetime] = None

class ChatCreate(BaseModel):
    """Model cho việc tạo chat mới"""
    user_id: str
    title: str = "Cuộc trò chuyện mới"

class UserFeedback(BaseModel):
    """Model cho phản hồi người dùng"""
    chat_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    is_accurate: Optional[bool] = None
    is_helpful: Optional[bool] = None

# === ENDPOINTS ===
@router.post("/ask")
async def ask(input: QueryInput):
    """Endpoint chính xử lý câu hỏi"""
    try:
        start_time = time.time()
        print(f"Processing query: '{input.query}' with session_id: {input.session_id}")
        
        # 1. Retrieval
        retrieval_result = retrieval_service.retrieve(input.query)
        context_items = retrieval_result['context_items']
        retrieved_chunks = retrieval_result['retrieved_chunks']
        retrieval_time = retrieval_result.get('execution_time', 0)
        
        # 2. Generation
        if context_items:
            generation_result = generation_service.generate_answer(input.query)
            answer = generation_result['answer']
            generation_time = generation_result.get('generation_time', 0)
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
            
            db = mongodb_client.get_database()
            
            # Nếu có session_id, thêm tin nhắn vào cuộc trò chuyện đó
            if input.session_id:
                print(f"Adding message to existing chat: {input.session_id}")
                
                # Kiểm tra xem cuộc trò chuyện có tồn tại không
                try:
                    existing_chat = db.chats.find_one({"_id": ObjectId(input.session_id)})
                except:
                    existing_chat = None
                
                if existing_chat:
                    # Thêm cặp tin nhắn mới (kết hợp thành một exchange)
                    success = db.chats.update_one(
                        {"_id": ObjectId(input.session_id)},
                        {
                            "$push": {
                                "exchanges": {
                                    "exchangeId": str(uuid.uuid4()),
                                    "question": input.query,
                                    "answer": answer,
                                    "timestamp": datetime.now(),
                                    "sourceDocuments": retrieved_chunks,
                                    "processingTime": total_time,
                                    "clientInfo": input.client_info
                                }
                            },
                            "$set": {"updated_at": datetime.now()}
                        }
                    )
                    if success.modified_count == 0:
                        print(f"Failed to add message to chat: {input.session_id}")
                        # Tạo mới nếu không thành công
                        chat_data = {
                            "user_id": input.user_id,
                            "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                            "created_at": datetime.now(),
                            "updated_at": datetime.now(),
                            "status": "active",
                            "exchanges": []
                        }
                        result = db.chats.insert_one(chat_data)
                        chat_id = str(result.inserted_id)
                else:
                    # Tạo mới nếu không tồn tại
                    chat_data = {
                        "user_id": input.user_id,
                        "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                        "created_at": datetime.now(),
                        "updated_at": datetime.now(),
                        "status": "active",
                        "exchanges": [{
                            "exchangeId": str(uuid.uuid4()),
                            "question": input.query,
                            "answer": answer,
                            "timestamp": datetime.now(),
                            "sourceDocuments": retrieved_chunks,
                            "processingTime": total_time,
                            "clientInfo": input.client_info
                        }]
                    }
                    result = db.chats.insert_one(chat_data)
                    chat_id = str(result.inserted_id)
            else:
                # Tạo chat mới nếu không có session_id
                print("Creating new chat")
                chat_data = {
                    "user_id": input.user_id,
                    "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                    "created_at": datetime.now(),
                    "updated_at": datetime.now(),
                    "status": "active",
                    "exchanges": [{
                        "exchangeId": str(uuid.uuid4()),
                        "question": input.query,
                        "answer": answer,
                        "timestamp": datetime.now(),
                        "sourceDocuments": retrieved_chunks,
                        "processingTime": total_time,
                        "clientInfo": input.client_info
                    }]
                }
                result = db.chats.insert_one(chat_data)
                chat_id = str(result.inserted_id)
        
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

@router.post("/retrieve")
async def retrieve(input: QueryInput):
    """Endpoint riêng để truy xuất ngữ cảnh từ các văn bản"""
    try:
        retrieval_result = retrieval_service.retrieve(input.query, use_cache=False)
        
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

@router.post("/feedback")
async def submit_feedback(feedback: UserFeedback):
    """Gửi phản hồi về chất lượng câu trả lời"""
    try:
        db = mongodb_client.get_database()
        
        feedback_data = feedback.dict()
        feedback_data["timestamp"] = datetime.now()
        
        result = db.feedback.insert_one(feedback_data)
        
        return {
            "message": "Cảm ơn bạn đã gửi phản hồi",
            "feedback_id": str(result.inserted_id)
        }
    except Exception as e:
        print(f"Error in /feedback endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chats/create")
async def create_chat(chat: ChatCreate):
    """Tạo cuộc trò chuyện mới"""
    try:
        db = mongodb_client.get_database()
        
        new_chat = {
            "user_id": chat.user_id,
            "title": chat.title,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "status": "active",
            "exchanges": []
        }
        
        result = db.chats.insert_one(new_chat)
        
        return {
            "id": str(result.inserted_id),
            "message": "Tạo cuộc trò chuyện mới thành công"
        }
    except Exception as e:
        print(f"Error in /chats/create endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: str):
    """Lấy tin nhắn của một cuộc trò chuyện cụ thể"""
    try:
        db = mongodb_client.get_database()
        
        try:
            chat = db.chats.find_one({"_id": ObjectId(chat_id)})
        except:
            print(f"Invalid chat_id format: {chat_id}")
            raise HTTPException(status_code=404, detail="ID cuộc trò chuyện không hợp lệ")
        
        if not chat:
            print(f"Chat with id {chat_id} not found")
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")
        
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

@router.post("/chats/{chat_id}/messages")
async def add_chat_message(chat_id: str, message: ChatMessage):
    """Thêm tin nhắn vào cuộc trò chuyện"""
    try:
        db = mongodb_client.get_database()
        
        # Kiểm tra chat tồn tại
        try:
            chat = db.chats.find_one({"_id": ObjectId(chat_id)})
        except:
            raise HTTPException(status_code=404, detail="ID cuộc hội thoại không hợp lệ")
        
        if not chat:
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")
        
        # Thêm tin nhắn dựa vào loại (user hoặc bot)
        success = False
        
        if message.sender == "user":
            # Tạo exchange mới với câu hỏi, chưa có câu trả lời
            exchange_id = str(uuid.uuid4())
            result = db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {
                    "$push": {
                        "exchanges": {
                            "exchangeId": exchange_id,
                            "question": message.text,
                            "answer": "",
                            "timestamp": datetime.now() if not message.timestamp else message.timestamp
                        }
                    },
                    "$set": {"updated_at": datetime.now()}
                }
            )
            success = result.modified_count > 0
            
        elif message.sender == "bot":
            # Tìm exchange cuối cùng và cập nhật câu trả lời
            exchanges = chat.get("exchanges", [])
            if not exchanges:
                raise HTTPException(status_code=400, detail="Không có tin nhắn user trước đó để trả lời")
                
            last_exchange = exchanges[-1]
            result = db.chats.update_one(
                {"_id": ObjectId(chat_id), "exchanges.exchangeId": last_exchange.get("exchangeId")},
                {
                    "$set": {
                        "exchanges.$.answer": message.text,
                        "exchanges.$.timestamp": datetime.now() if not message.timestamp else message.timestamp,
                        "updated_at": datetime.now()
                    }
                }
            )
            success = result.modified_count > 0
            
        if not success:
            raise HTTPException(status_code=500, detail="Không thể thêm tin nhắn vào cuộc trò chuyện")
        
        return {
            "message": "Thêm tin nhắn thành công",
            "chat_id": chat_id
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in add message endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chats/{user_id}")
async def get_chats(user_id: str, limit: int = 20):
    """Lấy danh sách cuộc trò chuyện của người dùng"""
    try:
        db = mongodb_client.get_database()
        
        chats = list(db.chats.find(
            {"user_id": user_id, "status": "active"},
            {"title": 1, "created_at": 1, "updated_at": 1}
        ).sort("updated_at", -1).limit(limit))
        
        # Chuyển đổi ObjectId sang string
        for chat in chats:
            chat["id"] = str(chat.pop("_id"))
        
        return chats
    except Exception as e:
        print(f"Error in /chats endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.put("/chats/{chat_id}/title")
async def update_chat_title(chat_id: str, title_data: dict = Body(...)):
    """Cập nhật tiêu đề cuộc trò chuyện"""
    try:
        db = mongodb_client.get_database()
        
        title = title_data.get("title", "")
        if not title:
            raise HTTPException(status_code=400, detail="Tiêu đề không được để trống")
        
        result = db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {"title": title, "updated_at": datetime.now()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Không thể cập nhật tiêu đề cuộc trò chuyện")
        
        return {
            "message": "Cập nhật tiêu đề thành công",
            "chat_id": chat_id
        }
    except Exception as e:
        print(f"Error in update title endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))