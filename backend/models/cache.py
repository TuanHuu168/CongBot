from datetime import datetime, timedelta
from enum import Enum
from pydantic import BaseModel, Field
from .base import BaseModelWithId, PyObjectId, BaseResponse

# Import config để lấy cache TTL
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import PERF_CONFIG

class CacheStatus(str, Enum):
    # Trạng thái của cache entry
    # - VALID: Cache còn hợp lệ, có thể sử dụng
    # - INVALID: Cache đã bị invalidate, cần refresh
    # - EXPIRED: Cache đã hết hạn, sẽ bị xóa tự động
    VALID = "valid"
    INVALID = "invalid"
    EXPIRED = "expired"

class CacheType(str, Enum):
    # Loại cache trong hệ thống
    # - TEXT: Cache cho text queries và responses
    # - VECTOR: Cache cho vector embeddings  
    # - METADATA: Cache cho document metadata
    # - SESSION: Cache cho session data
    TEXT = "text"
    VECTOR = "vector"
    METADATA = "metadata"
    SESSION = "session"

class RelevantDocument(BaseModel):
    # Thông tin về tài liệu liên quan được cache
    chunk_id = Field(..., description="ID của chunk document")
    score = Field(..., description="Điểm relevance (0-1)")
    doc_id = Field(..., description="ID của document gốc")
    doc_type = Field(None, description="Loại document (Luật, Nghị định, etc.)")
    position = Field(..., description="Vị trí trong kết quả search")

class CacheMetrics(BaseModel):
    # Metrics để đánh giá hiệu quả của cache entry
    hit_count = Field(default=0, description="Số lần cache được sử dụng")
    miss_count = Field(default=0, description="Số lần cache miss")
    last_used = Field(default_factory=datetime.now, description="Lần sử dụng cuối")
    average_response_time = Field(default=0.0, description="Thời gian phản hồi trung bình khi dùng cache")
    cache_size_bytes = Field(default=0, description="Kích thước cache entry (bytes)")

class CacheModel(BaseModelWithId):
    # Model chính cho cache entries
    
    # Identifiers
    cache_id = Field(..., description="ID duy nhất để liên kết với ChromaDB")
    cache_type = Field(default=CacheType.TEXT, description="Loại cache")
    
    # Content data
    question_text = Field(..., description="Câu hỏi gốc")
    normalized_question = Field(..., description="Câu hỏi đã chuẩn hóa để so sánh")
    answer = Field(..., description="Câu trả lời được cache")
    
    # Context và retrieval info
    relevant_documents = Field(default=[], description="Documents liên quan")
    context_items = Field(default=[], description="Context text items")
    
    # Cache management
    validity_status = Field(default=CacheStatus.VALID, description="Trạng thái cache")
    expires_at = Field(
        default_factory=lambda: datetime.now() + timedelta(days=PERF_CONFIG.CACHE_TTL_DAYS),
        description="Thời gian hết hạn cache"
    )
    
    # Analytics và optimization
    related_doc_ids = Field(default=[], description="IDs của documents liên quan")
    keywords = Field(default=[], description="Keywords để tìm kiếm cache")
    language = Field(default="vi", description="Ngôn ngữ của cache entry")
    
    # Metrics
    metrics = Field(default_factory=CacheMetrics, description="Metrics của cache entry")
    
    # Metadata bổ sung
    user_id = Field(None, description="User tạo cache (nếu có)")
    source_model = Field(default="unknown", description="Model đã tạo cache này")
    confidence_score = Field(None, description="Độ tin cậy của cached answer")
    tags = Field(default=[], description="Tags để phân loại cache")

class CacheCreate(BaseModel):
    # Model cho việc tạo cache entry mới
    cache_id = Field(..., description="ID duy nhất cho cache")
    cache_type = Field(default=CacheType.TEXT)
    question_text = Field(...)
    normalized_question = Field(...)
    answer = Field(...)
    relevant_documents = Field(default=[])
    context_items = Field(default=[])
    related_doc_ids = Field(default=[])
    keywords = Field(default=[])
    user_id = None
    source_model = Field(default="gemini")
    confidence_score = Field(None)
    expires_at = None

class CacheUpdate(BaseModel):
    # Model cho việc cập nhật cache entry
    validity_status = None
    answer = None
    expires_at = None
    confidence_score = Field(None)
    tags = None
    
    # Update metrics
    increment_hit_count = Field(default=False, description="Có tăng hit count không")
    new_response_time = Field(None, description="Response time mới để cập nhật average")

class CacheQuery(BaseModel):
    # Model cho việc query cache
    query_text = Field(..., description="Text cần tìm trong cache")
    cache_type = Field(default=CacheType.TEXT)
    similarity_threshold = Field(default=0.85, description="Ngưỡng similarity")
    max_results = Field(default=5, description="Số kết quả tối đa")
    include_expired = Field(default=False, description="Có bao gồm cache đã hết hạn không")

class CacheResponse(BaseResponse):
    # Model phản hồi khi truy vấn cache
    data = Field(None, description="Cache data")
    cache_hit = Field(default=False, description="Có cache hit không")
    similarity_score = Field(default=0.0, description="Điểm similarity nếu có")
    
    @classmethod
    def from_cache_model(cls, cache, similarity_score=1.0, message="Cache hit"):
        # Tạo CacheResponse từ CacheModel
        cache_dict = cache.dict()
        cache_dict['id'] = str(cache_dict.get('id', ''))
        
        return cls(
            success=True,
            message=message,
            data=cache_dict,
            cache_hit=True,
            similarity_score=similarity_score
        )

class CacheStats(BaseModel):
    # Model thống kê tổng thể của cache system
    total_entries = Field(default=0, description="Tổng số cache entries")
    valid_entries = Field(default=0, description="Số cache entries hợp lệ")
    invalid_entries = Field(default=0, description="Số cache entries không hợp lệ")
    expired_entries = Field(default=0, description="Số cache entries đã hết hạn")
    
    # Performance metrics
    total_hits = Field(default=0, description="Tổng số cache hits")
    total_misses = Field(default=0, description="Tổng số cache misses")
    hit_rate = Field(default=0.0, description="Tỷ lệ cache hit")
    average_response_time = Field(default=0.0, description="Thời gian phản hồi trung bình")
    
    # Storage metrics
    total_size_bytes = Field(default=0, description="Tổng kích thước cache")
    average_size_per_entry = Field(default=0.0, description="Kích thước trung bình per entry")
    
    # Type breakdown
    cache_by_type = Field(default={}, description="Số lượng cache theo từng loại")
    
    # Time-based metrics
    entries_created_today = Field(default=0, description="Số entries tạo hôm nay")
    entries_used_today = Field(default=0, description="Số entries được dùng hôm nay")
    most_popular_keywords = Field(default=[], description="Keywords phổ biến nhất")

class CacheBatchOperation(BaseModel):
    # Model cho các thao tác batch trên cache
    operation = Field(..., description="Loại operation: delete, invalidate, refresh")
    cache_ids = Field(default=[], description="Danh sách cache IDs")
    doc_ids = Field(default=[], description="Danh sách document IDs để invalidate")
    criteria = Field(None, description="Criteria để filter cache")
    dry_run = Field(default=False, description="Chỉ simulate, không thực hiện")

class CacheBatchResponse(BaseResponse):
    # Response cho batch operations
    affected_count = Field(default=0, description="Số entries bị ảnh hưởng")
    operations_performed = Field(default=[], description="Danh sách operations đã thực hiện")
    errors = Field(default=[], description="Danh sách lỗi nếu có")
    execution_time = Field(default=0.0, description="Thời gian thực hiện")