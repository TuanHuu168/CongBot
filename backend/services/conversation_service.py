"""
Dịch vụ quản lý cuộc hội thoại và context
"""
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
from bson import ObjectId

import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.mongodb_client import mongodb_client
from models.conservation import ConversationModel, Exchange, ConversationStatus

class ConversationService:
    """Dịch vụ quản lý cuộc hội thoại"""
    
    def __init__(self):
        """Khởi tạo dịch vụ conversation"""
        self.db = mongodb_client.get_database()
        self.conversations_collection = self.db.conversations
    
    def create_conversation(self, user_id: str, title: str = "Cuộc hội thoại mới") -> str:
        """Tạo cuộc hội thoại mới"""
        try:
            # Chuyển đổi user_id thành ObjectId
            user_id_obj = ObjectId(user_id)
            
            # Tạo bản ghi mới
            conversation = ConversationModel(
                userId=user_id_obj,
                summary=title,
                createdAt=datetime.now(),
                updatedAt=datetime.now(),
                status=ConversationStatus.ACTIVE,
                totalTokens=0,
                exchanges=[]
            )
            
            # Chuyển thành dict và lưu vào MongoDB
            conversation_dict = conversation.dict(by_alias=True)
            result = self.conversations_collection.insert_one(conversation_dict)
            
            # Trả về ID cuộc hội thoại mới
            return str(result.inserted_id)
        except Exception as e:
            print(f"Lỗi khi tạo cuộc hội thoại: {str(e)}")
            raise e
    
    def add_exchange(self, conversation_id: str, question: str, answer: str, 
                    source_documents: List[str], tokens: int = 0, 
                    processing_time: float = 0, client_info: Dict = None) -> bool:
        """Thêm một cặp hỏi-đáp vào cuộc hội thoại"""
        try:
            # Chuyển đổi conversation_id thành ObjectId
            conversation_id_obj = ObjectId(conversation_id)
            
            # Tạo một exchange mới
            exchange = Exchange(
                exchangeId=f"ex_{int(time.time() * 1000)}",
                question=question,
                answer=answer,
                timestamp=datetime.now(),
                tokensInExchange=tokens,
                sourceDocuments=source_documents,
                processingTime=processing_time,
                clientInfo=client_info
            )
            
            # Chuyển thành dict
            exchange_dict = exchange.dict()
            
            # Cập nhật vào MongoDB
            result = self.conversations_collection.update_one(
                {"_id": conversation_id_obj},
                {
                    "$push": {"exchanges": exchange_dict},
                    "$inc": {"totalTokens": tokens},
                    "$set": {"updatedAt": datetime.now()}
                }
            )
            
            return result.modified_count > 0
        except Exception as e:
            print(f"Lỗi khi thêm exchange: {str(e)}")
            return False
    
    def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        """Lấy thông tin cuộc hội thoại"""
        try:
            conversation_id_obj = ObjectId(conversation_id)
            result = self.conversations_collection.find_one({"_id": conversation_id_obj})
            return result
        except Exception as e:
            print(f"Lỗi khi lấy thông tin cuộc hội thoại: {str(e)}")
            return None
    
    def get_recent_exchanges(self, conversation_id: str, limit: int = 3) -> List[Dict]:
        """Lấy các exchange gần đây nhất của cuộc hội thoại"""
        try:
            conversation_id_obj = ObjectId(conversation_id)
            conversation = self.conversations_collection.find_one(
                {"_id": conversation_id_obj},
                {"exchanges": {"$slice": -limit}}  # Lấy 'limit' exchanges cuối cùng
            )
            
            if conversation and "exchanges" in conversation:
                return conversation["exchanges"]
            return []
        except Exception as e:
            print(f"Lỗi khi lấy exchanges gần đây: {str(e)}")
            return []
    
    def build_context_from_history(self, conversation_id: str, limit: int = 3) -> str:
        """Xây dựng context từ lịch sử hội thoại"""
        recent_exchanges = self.get_recent_exchanges(conversation_id, limit)
        
        if not recent_exchanges:
            return ""
        
        context_text = "### LỊCH SỬ HỘI THOẠI GẦN ĐÂY\n"
        
        for i, exchange in enumerate(recent_exchanges):
            context_text += f"[Câu hỏi {i+1}] {exchange.get('question', '')}\n"
            context_text += f"[Câu trả lời {i+1}] {exchange.get('answer', '')}\n\n"
        
        return context_text
    
    def update_conversation_title(self, conversation_id: str, title: str) -> bool:
        """Cập nhật tiêu đề cuộc hội thoại"""
        try:
            conversation_id_obj = ObjectId(conversation_id)
            result = self.conversations_collection.update_one(
                {"_id": conversation_id_obj},
                {"$set": {"summary": title, "updatedAt": datetime.now()}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Lỗi khi cập nhật tiêu đề: {str(e)}")
            return False
    
    def archive_conversation(self, conversation_id: str) -> bool:
        """Lưu trữ cuộc hội thoại (không xóa)"""
        try:
            conversation_id_obj = ObjectId(conversation_id)
            result = self.conversations_collection.update_one(
                {"_id": conversation_id_obj},
                {"$set": {"status": ConversationStatus.ARCHIVED, "updatedAt": datetime.now()}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Lỗi khi lưu trữ cuộc hội thoại: {str(e)}")
            return False
    
    def delete_conversation(self, conversation_id: str) -> bool:
        """Đánh dấu xóa cuộc hội thoại"""
        try:
            conversation_id_obj = ObjectId(conversation_id)
            result = self.conversations_collection.update_one(
                {"_id": conversation_id_obj},
                {"$set": {"status": ConversationStatus.DELETED, "updatedAt": datetime.now()}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Lỗi khi xóa cuộc hội thoại: {str(e)}")
            return False
    
    def get_user_conversations(self, user_id: str, limit: int = 20, skip: int = 0) -> List[Dict]:
        """Lấy danh sách cuộc hội thoại của người dùng"""
        try:
            user_id_obj = ObjectId(user_id)
            
            # Lấy danh sách các cuộc hội thoại không bị xóa
            conversations = self.conversations_collection.find(
                {"userId": user_id_obj, "status": {"$ne": ConversationStatus.DELETED}},
                {"summary": 1, "createdAt": 1, "updatedAt": 1, "status": 1}
            ).sort("updatedAt", -1).skip(skip).limit(limit)
            
            return list(conversations)
        except Exception as e:
            print(f"Lỗi khi lấy danh sách cuộc hội thoại: {str(e)}")
            return []

# Singleton instance
conversation_service = ConversationService()