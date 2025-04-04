"""
API endpoints cho chức năng chat
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
import time
import uuid

# Import services
from services.generation_service import generation_service
from services.retrieval_service import retrieval_service
from database.mongodb_client import mongodb_client

# Import models
from models.conversation import ConversationModel, ConversationCreate, Exchange, ClientInfo

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}},
)

# === MODELS ===
class QueryInput(BaseModel):
    """Input model cho việc gửi câu hỏi"""
    query: str
    use_cache: bool = True
    conversation_id: Optional[str] = None
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
    query: str
    answer: str
    conversation_id: str
    exchange_id: str
    retrieval_time: Optional[float] = None
    generation_time: Optional[float] = None
    total_time: Optional[float] = None
    
# === ENDPOINTS ===
@router.post("/ask", response_model=ChatResponse)
async def ask(input: QueryInput):
    """Endpoint chính xử lý câu hỏi"""
    try:
        start_time = time.time()
        
        # Lấy hoặc tạo conversation
        conversation_id = input.conversation_id
        conversation = None
        db = mongodb_client.get_database()
        
        if conversation_id:
            # Tìm conversation hiện có
            conversation = db.conversations.find_one({"_id": conversation_id})
            if not conversation:
                raise HTTPException(status_code=404, detail="Không tìm thấy cuộc hội thoại")
        
        # Tạo thông tin client nếu có
        client_info = None
        if input.client_info:
            client_info = ClientInfo(
                platform=input.client_info.get("platform", "unknown"),
                deviceType=input.client_info.get("deviceType", "unknown")
            )
        
        # Gọi service để lấy câu trả lời
        result = generation_service.generate_answer(input.query, use_cache=input.use_cache)
        
        answer = result.get("answer", "")
        retrieval_time = result.get("retrieval_time", 0)
        generation_time = result.get("generation_time", 0)
        total_time = time.time() - start_time
        source_chunks = result.get("retrieved_chunks", [])
        
        # Tạo ID cho exchange
        exchange_id = f"ex_{uuid.uuid4().hex[:8]}"
        
        # Tạo exchange mới
        new_exchange = Exchange(
            exchangeId=exchange_id,
            question=input.query,
            answer=answer,
            timestamp=datetime.now(),
            tokensInExchange=len(input.query.split()) + len(answer.split()),  # Ước tính số token
            sourceDocuments=source_chunks,
            processingTime=total_time,
            clientInfo=client_info
        )
        
        # Cập nhật hoặc tạo mới conversation
        if conversation:
            # Cập nhật conversation hiện có
            db.conversations.update_one(
                {"_id": conversation_id},
                {
                    "$push": {"exchanges": new_exchange.dict()},
                    "$inc": {"totalTokens": new_exchange.tokensInExchange},
                    "$set": {"updatedAt": datetime.now()}
                }
            )
        else:
            # Tạo conversation mới
            new_conversation = ConversationModel(
                userId="anonymous",  # Cần thay đổi nếu có hệ thống xác thực
                summary=input.query[:50] + "..." if len(input.query) > 50 else input.query,
                exchanges=[new_exchange],
                totalTokens=new_exchange.tokensInExchange
            )
            
            insert_result = db.conversations.insert_one(new_conversation.dict(by_alias=True))
            conversation_id = str(insert_result.inserted_id)
        
        # Trả về kết quả
        return {
            "query": input.query,
            "answer": answer,
            "conversation_id": conversation_id,
            "exchange_id": exchange_id,
            "retrieval_time": retrieval_time,
            "generation_time": generation_time,
            "total_time": total_time
        }
        
    except Exception as e:
        print(f"Error in /ask endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retrieve", response_model=RetrievalResult)
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

@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Lấy thông tin của một cuộc hội thoại"""
    try:
        db = mongodb_client.get_database()
        conversation = db.conversations.find_one({"_id": conversation_id})
        
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