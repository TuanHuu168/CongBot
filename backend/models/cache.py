from datetime import datetime, timedelta
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional, Any
from bson import ObjectId
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import CACHE_TTL_DAYS

class PyObjectId(ObjectId):
    """Lớp chuyển đổi ObjectId cho Pydantic v2"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, _schema_generator):
        return {"type": "string"}

class CacheStatus(str, Enum):
    """Trạng thái của cache"""
    VALID = "valid"
    INVALID = "invalid"

class RelevantDocument(BaseModel):
    """Thông tin về tài liệu liên quan"""
    chunkId: str
    score: float
    
    model_config = ConfigDict(populate_by_name=True)

class CacheModel(BaseModel):
    """Model cho cache"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    cacheId: str  # ID để liên kết với ChromaDB
    questionText: str  # Câu hỏi gốc
    normalizedQuestion: str  # Câu hỏi chuẩn hóa
    answer: str  # Câu trả lời
    relevantDocuments: List[RelevantDocument] = []
    validityStatus: CacheStatus = CacheStatus.VALID
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
    hitCount: int = 0
    lastUsed: datetime = Field(default_factory=datetime.now)
    expiresAt: datetime = Field(default_factory=lambda: datetime.now() + timedelta(days=CACHE_TTL_DAYS))
    relatedDocIds: List[str] = []
    keywords: List[str] = []

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={
            ObjectId: str,
            datetime: lambda dt: dt.isoformat(),
        }
    )

class CacheCreate(BaseModel):
    """Model cho việc tạo cache mới"""
    cacheId: str
    questionText: str
    normalizedQuestion: str
    answer: str
    relevantDocuments: List[Dict[str, Any]]
    relatedDocIds: List[str]
    keywords: List[str]
    expiresAt: Optional[datetime] = None
    
    model_config = ConfigDict(populate_by_name=True)

class CacheUpdate(BaseModel):
    """Model cho việc cập nhật cache"""
    validityStatus: Optional[CacheStatus] = None
    hitCount: Optional[int] = None
    lastUsed: Optional[datetime] = None
    answer: Optional[str] = None
    expiresAt: Optional[datetime] = None
    
    model_config = ConfigDict(populate_by_name=True)

class CacheResponse(BaseModel):
    """Model phản hồi khi truy vấn thông tin cache"""
    id: str = Field(..., alias="_id")
    cacheId: str
    questionText: str
    answer: str
    validityStatus: str
    createdAt: datetime
    updatedAt: datetime
    hitCount: int
    lastUsed: datetime
    expiresAt: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={
            datetime: lambda dt: dt.isoformat()
        }
    )