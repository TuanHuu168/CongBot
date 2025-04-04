from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from bson import ObjectId

class PyObjectId(ObjectId):
    """Lớp chuyển đổi ObjectId cho Pydantic"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

class ConversationStatus(str, Enum):
    """Trạng thái của cuộc hội thoại"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"

class ClientInfo(BaseModel):
    """Thông tin về thiết bị của người dùng"""
    platform: str  # web, mobile, desktop
    deviceType: str  # desktop, mobile, tablet

class Exchange(BaseModel):
    """Mô hình lưu trữ một cặp câu hỏi-trả lời"""
    exchangeId: str
    question: str
    answer: str
    timestamp: datetime = Field(default_factory=datetime.now)
    tokensInExchange: int
    sourceDocuments: List[str] = []
    processingTime: float = 0
    clientInfo: Optional[ClientInfo] = None

class ConversationModel(BaseModel):
    """Model cho cuộc hội thoại"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    userId: PyObjectId
    summary: str  # Tiêu đề/tóm tắt cuộc hội thoại
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
    status: ConversationStatus = ConversationStatus.ACTIVE
    totalTokens: int = 0
    exchanges: List[Exchange] = []

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat(),
        }

class ConversationCreate(BaseModel):
    """Model cho việc tạo cuộc hội thoại mới"""
    userId: str
    summary: str = "Cuộc hội thoại mới"

class ConversationUpdate(BaseModel):
    """Model cho việc cập nhật thông tin cuộc hội thoại"""
    summary: Optional[str] = None
    status: Optional[ConversationStatus] = None

class ExchangeCreate(BaseModel):
    """Model cho việc tạo một cặp hỏi-đáp mới"""
    question: str
    clientInfo: Optional[Dict[str, str]] = None

class ConversationResponse(BaseModel):
    """Model phản hồi khi truy vấn thông tin cuộc hội thoại"""
    id: str = Field(..., alias="_id")
    userId: str
    summary: str
    createdAt: datetime
    updatedAt: datetime
    status: str
    totalTokens: int
    exchanges: List[Dict[str, Any]]

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }