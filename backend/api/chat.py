from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import time
import uuid
from bson.objectid import ObjectId

# Import các service
from services.generation_service import generation_service
from services.retrieval_service import retrieval_service
from database.mongodb_client import mongodb_client

router = APIRouter(prefix="", tags=["chat"])

def now_utc():
    # Lấy thời gian hiện tại theo UTC
    return datetime.now(timezone.utc)

# Các model
class QueryInput(BaseModel):
    query: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    client_info: Optional[Dict[str, str]] = None

class ChatMessage(BaseModel):
    sender: str
    text: str
    timestamp: Optional[datetime] = None

class ChatCreate(BaseModel):
    user_id: str
    title: str = "Cuộc trò chuyện mới"

class UserFeedback(BaseModel):
    chat_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    is_accurate: Optional[bool] = None
    is_helpful: Optional[bool] = None

class DeleteChatRequest(BaseModel):
    user_id: str

class BatchDeleteRequest(BaseModel):
    user_id: str
    chat_ids: List[str]

@router.post("/ask")
async def ask(input: QueryInput):
    try:
        start_time = time.time()
        print(f"Đang xử lý câu hỏi: '{input.query}' với session_id: {input.session_id}")
        
        # Lấy lịch sử cuộc trò chuyện
        conversation_context = []
        if input.session_id:
            try:
                context_load_start = time.time()
                db = mongodb_client.get_database()
                chat = db.chats.find_one({"_id": ObjectId(input.session_id)})
                if chat and "exchanges" in chat:
                    recent_exchanges = chat["exchanges"][-5:] if len(chat["exchanges"]) > 5 else chat["exchanges"]
                    for exchange in recent_exchanges:
                        conversation_context.append({
                            "question": exchange.get("question", ""),
                            "answer": exchange.get("answer", "")
                        })
                    print(f"Đã tải {len(conversation_context)} trao đổi trước đó")
                context_load_end = time.time()
                print(f"Tải context mất: {context_load_end - context_load_start:.3f} giây")
            except Exception as e:
                print(f"Lỗi khi tải lịch sử cuộc trò chuyện: {str(e)}")
                conversation_context = []
        
        # Tìm kiếm thông tin
        retrieval_start = time.time()
        retrieval_result = retrieval_service.retrieve(input.query, use_cache=True)
        retrieval_end = time.time()
        print(f"Tìm kiếm mất: {retrieval_end - retrieval_start:.3f} giây")
        source = retrieval_result.get("source", "unknown")
        context_items = retrieval_result.get("context_items", [])
        retrieved_chunks = retrieval_result.get("retrieved_chunks", [])
        retrieval_time = retrieval_result.get("execution_time", 0)
        
        # Xử lý câu trả lời
        generation_time = 0
        
        if source == "cache":
            answer = retrieval_result.get("answer", "")
            print(f"Sử dụng câu trả lời từ cache")
        else:
            print(f"Gọi generation_service với lịch sử cuộc trò chuyện")
            if context_items:
                generation_result = generation_service.generate_answer_with_context(
                    input.query, context_items, conversation_context, use_cache=False
                )
                answer = generation_result.get("answer", "")
                generation_time = generation_result.get("generation_time", 0)
                print(f"Tạo câu trả lời mất: {generation_time:.3f} giây")
                if "retrieved_chunks" in generation_result:
                    retrieved_chunks = generation_result.get("retrieved_chunks", retrieved_chunks)
            else:
                answer = "Tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu."
        
        # Lưu trữ tin nhắn với UTC timestamp
        chat_id = input.session_id
        
        if input.user_id:
            current_time = now_utc()
            
            db = mongodb_client.get_database()
            
            if input.session_id:
                print(f"Thêm tin nhắn vào cuộc trò chuyện hiện tại: {input.session_id}")
                
                try:
                    existing_chat = db.chats.find_one({"_id": ObjectId(input.session_id)})
                except:
                    existing_chat = None
                
                if existing_chat:
                    success = db.chats.update_one(
                        {"_id": ObjectId(input.session_id)},
                        {
                            "$push": {
                                "exchanges": {
                                    "exchangeId": str(uuid.uuid4()),
                                    "question": input.query,
                                    "answer": answer,
                                    "timestamp": current_time,
                                    "sourceDocuments": retrieved_chunks,
                                    "processingTime": retrieval_time + generation_time,
                                    "clientInfo": input.client_info
                                }
                            },
                            "$set": {"updated_at": current_time}
                        }
                    )
                    if success.modified_count == 0:
                        print(f"Thất bại khi thêm tin nhắn vào cuộc trò chuyện: {input.session_id}")
                        chat_data = {
                            "user_id": input.user_id,
                            "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                            "created_at": current_time,
                            "updated_at": current_time,
                            "status": "active",
                            "exchanges": [{
                                "exchangeId": str(uuid.uuid4()),
                                "question": input.query,
                                "answer": answer,
                                "timestamp": current_time,
                                "sourceDocuments": retrieved_chunks,
                                "processingTime": retrieval_time + generation_time,
                                "clientInfo": input.client_info
                            }]
                        }
                        result = db.chats.insert_one(chat_data)
                        chat_id = str(result.inserted_id)
                else:
                    chat_data = {
                        "user_id": input.user_id,
                        "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                        "created_at": current_time,
                        "updated_at": current_time,
                        "status": "active",
                        "exchanges": [{
                            "exchangeId": str(uuid.uuid4()),
                            "question": input.query,
                            "answer": answer,
                            "timestamp": current_time,
                            "sourceDocuments": retrieved_chunks,
                            "processingTime": retrieval_time + generation_time,
                            "clientInfo": input.client_info
                        }]
                    }
                    result = db.chats.insert_one(chat_data)
                    chat_id = str(result.inserted_id)
            else:
                print("Tạo cuộc trò chuyện mới")
                chat_data = {
                    "user_id": input.user_id,
                    "title": input.query[:30] + "..." if len(input.query) > 30 else input.query,
                    "created_at": current_time,
                    "updated_at": current_time,
                    "status": "active",
                    "exchanges": [{
                        "exchangeId": str(uuid.uuid4()),
                        "question": input.query,
                        "answer": answer,
                        "timestamp": current_time,
                        "sourceDocuments": retrieved_chunks,
                        "processingTime": retrieval_time + generation_time,
                        "clientInfo": input.client_info
                    }]
                }
                result = db.chats.insert_one(chat_data)
                chat_id = str(result.inserted_id)
        
        total_time = time.time() - start_time
        
        print(f"TÓM TẮT THỜI GIAN XỬ LÝ:")
        print(f" - Tìm kiếm: {retrieval_time:.3f}s (nguồn: {source})")
        print(f" - Tạo câu trả lời: {generation_time:.3f}s")  
        print(f" - Tổng thời gian xử lý: {total_time:.3f}s")
        print(f" - Sử dụng cache: {'Có' if source == 'cache' else 'Không'}")
        
        return {
            "id": chat_id,
            "query": input.query,
            "answer": answer,
            "top_chunks": context_items[:5],
            "retrieval_time": retrieval_time,
            "generation_time": generation_time,
            "total_time": total_time
        }
    except Exception as e:
        print(f"Lỗi trong endpoint /ask: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retrieve")
async def retrieve(input: QueryInput):
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
        print(f"Lỗi trong endpoint /retrieve: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback")
async def submit_feedback(feedback: UserFeedback):
    try:
        db = mongodb_client.get_database()
        
        feedback_data = feedback.dict()
        feedback_data["timestamp"] = now_utc()
        
        result = db.feedback.insert_one(feedback_data)
        
        return {
            "message": "Cảm ơn bạn đã gửi phản hồi",
            "feedback_id": str(result.inserted_id)
        }
    except Exception as e:
        print(f"Lỗi trong endpoint /feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chats/create")
async def create_chat(chat: ChatCreate):
    try:
        db = mongodb_client.get_database()
        
        current_time = now_utc()
        new_chat = {
            "user_id": chat.user_id,
            "title": chat.title,
            "created_at": current_time,
            "updated_at": current_time,
            "status": "active",
            "exchanges": []
        }
        
        result = db.chats.insert_one(new_chat)
        
        return {
            "id": str(result.inserted_id),
            "message": "Tạo cuộc trò chuyện mới thành công"
        }
    except Exception as e:
        print(f"Lỗi trong endpoint /chats/create: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: str):
    try:
        db = mongodb_client.get_database()
        
        try:
            chat = db.chats.find_one({"_id": ObjectId(chat_id)})
        except:
            print(f"Định dạng chat_id không hợp lệ: {chat_id}")
            raise HTTPException(status_code=404, detail="ID cuộc trò chuyện không hợp lệ")
        
        if not chat:
            print(f"Không tìm thấy cuộc trò chuyện với id {chat_id}")
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")
        
        exchanges = chat.get("exchanges", [])
        messages = []
        
        for exchange in exchanges:
            messages.append({
                "sender": "user",
                "text": exchange.get("question", ""),
                "timestamp": exchange.get("timestamp")
            })
            
            messages.append({
                "sender": "bot",
                "text": exchange.get("answer", ""),
                "processingTime": exchange.get("processingTime", 0),
                "sourceDocuments": exchange.get("sourceDocuments", []),
                "timestamp": exchange.get("timestamp")
            })
        
        chat_data = {
            "id": str(chat["_id"]),
            "title": chat.get("title", "Cuộc trò chuyện"),
            "messages": messages,
            "created_at": chat.get("created_at", now_utc()),
            "updated_at": chat.get("updated_at", now_utc())
        }
        
        return chat_data
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Lỗi trong endpoint /chats/{chat_id}/messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chats/{chat_id}/messages")
async def add_chat_message(chat_id: str, message: ChatMessage):
    try:
        db = mongodb_client.get_database()
        
        try:
            chat = db.chats.find_one({"_id": ObjectId(chat_id)})
        except:
            raise HTTPException(status_code=404, detail="ID cuộc hội thoại không hợp lệ")
        
        if not chat:
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")
        
        current_time = now_utc()
        success = False
        
        if message.sender == "user":
            exchange_id = str(uuid.uuid4())
            result = db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {
                    "$push": {
                        "exchanges": {
                            "exchangeId": exchange_id,
                            "question": message.text,
                            "answer": "",
                            "timestamp": current_time if not message.timestamp else message.timestamp
                        }
                    },
                    "$set": {"updated_at": current_time}
                }
            )
            success = result.modified_count > 0
            
        elif message.sender == "bot":
            exchanges = chat.get("exchanges", [])
            if not exchanges:
                raise HTTPException(status_code=400, detail="Không có tin nhắn user trước đó để trả lời")
                
            last_exchange = exchanges[-1]
            result = db.chats.update_one(
                {"_id": ObjectId(chat_id), "exchanges.exchangeId": last_exchange.get("exchangeId")},
                {
                    "$set": {
                        "exchanges.$.answer": message.text,
                        "exchanges.$.timestamp": current_time if not message.timestamp else message.timestamp,
                        "updated_at": current_time
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
        print(f"Lỗi trong endpoint thêm tin nhắn: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chats/{user_id}")
async def get_chats(user_id: str, limit: int = None):
    try:
        db = mongodb_client.get_database()
        
        query = {"user_id": user_id, "status": "active"}
        projection = {"title": 1, "created_at": 1, "updated_at": 1}
        
        if limit:
            chats = list(db.chats.find(query, projection).sort("updated_at", -1).limit(limit))
        else:
            chats = list(db.chats.find(query, projection).sort("updated_at", -1))
        
        for chat in chats:
            chat["id"] = str(chat.pop("_id"))
        
        return chats
    except Exception as e:
        print(f"Lỗi trong endpoint /chats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.put("/chats/{chat_id}/title")
async def update_chat_title(chat_id: str, title_data: dict = Body(...)):
    try:
        db = mongodb_client.get_database()
        
        title = title_data.get("title", "")
        if not title:
            raise HTTPException(status_code=400, detail="Tiêu đề không được để trống")
        
        result = db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {"title": title, "updated_at": now_utc()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Không thể cập nhật tiêu đề cuộc trò chuyện")
        
        return {
            "message": "Cập nhật tiêu đề thành công",
            "chat_id": chat_id
        }
    except Exception as e:
        print(f"Lỗi trong endpoint cập nhật tiêu đề: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, request: DeleteChatRequest):
    try:
        db = mongodb_client.get_database()
        
        chat = db.chats.find_one({"_id": ObjectId(chat_id)})
        if not chat:
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")
            
        if chat.get("user_id") != request.user_id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xóa cuộc trò chuyện này")
        
        result = db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {"status": "deleted", "updated_at": now_utc()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Không thể xóa cuộc trò chuyện")
        
        return {
            "message": "Xóa cuộc trò chuyện thành công",
            "chat_id": chat_id
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Lỗi trong endpoint delete_chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chats/delete-batch")
async def delete_chats_batch(request: BatchDeleteRequest):
    try:
        db = mongodb_client.get_database()
        
        if not request.chat_ids or len(request.chat_ids) == 0:
            raise HTTPException(status_code=400, detail="Danh sách chat_ids không được để trống")
        
        chat_object_ids = []
        for chat_id in request.chat_ids:
            try:
                chat_object_ids.append(ObjectId(chat_id))
            except:
                continue
        
        if len(chat_object_ids) == 0:
            raise HTTPException(status_code=400, detail="Không có chat_id hợp lệ trong danh sách")
        
        user_chats = list(db.chats.find(
            {"user_id": request.user_id, "_id": {"$in": chat_object_ids}},
            {"_id": 1}
        ))
        
        user_chat_ids = [chat["_id"] for chat in user_chats]
        
        if len(user_chat_ids) == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện nào thuộc về người dùng này")
        
        result = db.chats.update_many(
            {"_id": {"$in": user_chat_ids}},
            {"$set": {"status": "deleted", "updated_at": now_utc()}}
        )
        
        return {
            "message": f"Đã xóa {result.modified_count} cuộc trò chuyện",
            "deleted_count": result.modified_count
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Lỗi trong endpoint delete_chats_batch: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))