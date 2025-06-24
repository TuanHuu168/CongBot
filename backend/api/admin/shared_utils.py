from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from services.activity_service import activity_service, ActivityType

VN_TZ = timezone(timedelta(hours=7))

def now_utc():
    """Lấy thời gian hiện tại theo UTC"""
    return datetime.now(timezone.utc)

def handle_admin_error(operation: str, error: Exception, activity_type: ActivityType = None, metadata: Dict = None):
    """Xử lý lỗi chung cho admin operations"""
    error_msg = str(error)
    print(f"Lỗi trong {operation}: {error_msg}")
    
    if activity_type:
        activity_service.log_activity(
            activity_type,
            f"Lỗi {operation}: {error_msg}",
            metadata={**(metadata or {}), "error": error_msg, "success": False}
        )
    
    raise HTTPException(status_code=500, detail=error_msg)

def log_admin_success(operation: str, message: str, activity_type: ActivityType, metadata: Dict = None):
    """Log thành công cho admin operations"""
    print(f"Thành công {operation}: {message}")
    activity_service.log_activity(
        activity_type,
        message,
        metadata=metadata or {}
    )

def validate_admin_request(data: Dict, required_fields: list) -> None:
    """Validate dữ liệu đầu vào cho admin requests"""
    missing_fields = [field for field in required_fields if not data.get(field)]
    if missing_fields:
        raise HTTPException(
            status_code=400, 
            detail=f"Thiếu các trường bắt buộc: {', '.join(missing_fields)}"
        )