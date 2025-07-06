from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from .base import BaseModelWithId, PyObjectId, BaseResponse

class ConversationStatus(str, Enum):
    # Trạng thái của cuộc hội thoại
    ACTIVE = "active"
    ARCHIVED = "archived" 
    DELETED = "deleted"

class ClientInfo(BaseModel):
    # Thông tin về thiết bị/client của người dùng khi tạo tin nhắn
    platform = Field(..., description="Nền tảng: web, mobile, desktop")
    device_type = Field(..., description="Loại thiết bị: desktop, mobile, tablet")
    user_agent = Field(None, description="User agent string từ browser")
    ip_address = Field(None, description="IP address (cho security)")
    screen_resolution = Field(None, description="Độ phân giải màn hình")

class Exchange(BaseModel):
    # Mô hình lưu trữ một cặp câu hỏi-trả lời trong cuộc hội thoại
    exchange_id = Field(..., description="ID duy nhất của exchange")
    question = Field(..., description="Câu hỏi của người dùng")
    answer = Field(..., description="Câu trả lời của chatbot")
    timestamp = Field(default_factory=datetime.now, description="Thời gian tạo exchange")
    
    # Metadata về performance và context
    tokens_in_exchange = Field(default=0, description="Số tokens sử dụng trong exchange này")
    processing_time = Field(default=0.0, description="Thời gian xử lý (seconds)")
    source_documents = Field(default=[], description="Danh sách chunk IDs được sử dụng")
    
    # Context và quality metrics  
    retrieval_score = Field(None, description="Điểm số relevance của retrieval")
    confidence_score = Field(None, description="Độ tin cậy của câu trả lời")
    user_feedback = Field(None, description="Feedback từ người dùng")
    
    # Client information
    client_info = Field(None, description="Thông tin thiết bị client")

class ConversationModel(BaseModelWithId):
    # Model chính cho cuộc hội thoại
    user_id = Field(..., description="ID của người dùng sở hữu cuộc trò chuyện")
    title = Field(default="Cuộc trò chuyện mới", description="Tiêu đề cuộc trò chuyện")
    summary = Field(None, description="Tóm tắt nội dung cuộc trò chuyện")
    
    # Trạng thái và metadata
    status = Field(default=ConversationStatus.ACTIVE, description="Trạng thái cuộc trò chuyện")
    total_tokens = Field(default=0, description="Tổng số tokens đã sử dụng")
    total_exchanges = Field(default=0, description="Tổng số cặp hỏi-đáp")
    
    # Danh sách các exchanges
    exchanges = Field(default=[], description="Danh sách các cặp hỏi-đáp")
    
    # Thống kê và analytics
    average_response_time = Field(default=0.0, description="Thời gian phản hồi trung bình")
    topics_discussed = Field(default=[], description="Các chủ đề đã thảo luận")
    language = Field(default="vi", description="Ngôn ngữ chính của cuộc trò chuyện")
    
    # Metadata bổ sung
    tags = Field(default=[], description="Tags để phân loại cuộc trò chuyện")
    is_favorite = Field(default=False, description="Người dùng có đánh dấu yêu thích không")
    last_activity_at = Field(None, description="Thời gian hoạt động cuối")

class ConversationCreate(BaseModel):
    # Model cho việc tạo cuộc hội thoại mới
    user_id = Field(..., description="ID của người dùng")
    title = Field(default="Cuộc trò chuyện mới")
    summary = Field(None)
    tags = Field(default=[], description="Tags ban đầu")

class ConversationUpdate(BaseModel):
    # Model cho việc cập nhật thông tin cuộc hội thoại
    title = Field(None)
    summary = Field(None)
    status = None
    tags = None
    is_favorite = None

class ExchangeCreate(BaseModel):
    # Model cho việc tạo một cặp hỏi-đáp mới
    question = Field(..., description="Câu hỏi của người dùng")
    client_info = Field(None, description="Thông tin client")
    context_data = Field(None, description="Dữ liệu context bổ sung")

class ExchangeResponse(BaseModel):
    # Model response khi tạo exchange thành công
    exchange_id = Field(..., description="ID của exchange vừa tạo")
    question = Field(..., description="Câu hỏi")
    answer = Field(..., description="Câu trả lời")
    processing_time = Field(..., description="Thời gian xử lý")
    source_documents = Field(default=[], description="Documents được sử dụng")
    confidence_score = Field(None, description="Độ tin cậy")

class ConversationResponse(BaseResponse):
    # Model phản hồi khi truy vấn thông tin cuộc hội thoại
    data = Field(None, description="Dữ liệu cuộc trò chuyện")
    
    @classmethod
    def from_conversation_model(cls, conversation, message="Lấy cuộc trò chuyện thành công"):
        # Tạo ConversationResponse từ ConversationModel
        conv_dict = conversation.dict()
        conv_dict['id'] = str(conv_dict.get('id', ''))
        conv_dict['user_id'] = str(conv_dict.get('user_id', ''))
        
        return cls(
            success=True,
            message=message,
            data=conv_dict
        )

class ConversationListResponse(BaseResponse):
    # Model response cho danh sách cuộc trò chuyện
    data = Field(default=[], description="Danh sách cuộc trò chuyện")
    total_count = Field(default=0, description="Tổng số cuộc trò chuyện")
    page = Field(default=1, description="Trang hiện tại")
    page_size = Field(default=20, description="Số items per page")
    total_pages = Field(default=0, description="Tổng số trang")

class ConversationStats(BaseModel):
    # Model thống kê cho cuộc trò chuyện
    total_conversations = Field(default=0, description="Tổng số cuộc trò chuyện")
    active_conversations = Field(default=0, description="Cuộc trò chuyện đang hoạt động")
    total_exchanges = Field(default=0, description="Tổng số exchanges")
    average_exchanges_per_conversation = Field(default=0.0, description="Số exchanges trung bình")
    total_tokens_used = Field(default=0, description="Tổng tokens đã sử dụng")
    most_discussed_topics = Field(default=[], description="Chủ đề được thảo luận nhiều nhất")