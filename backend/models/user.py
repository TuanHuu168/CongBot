"""
Model định nghĩa cấu trúc dữ liệu cho người dùng trong MongoDB
"""
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, EmailStr
from pydantic.json_schema import JsonSchemaValue
from typing import Optional
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
    def __get_pydantic_json_schema__(cls, core_schema, handler) -> JsonSchemaValue:
        schema = handler(core_schema)
        schema.update(type="string")
        return schema

class UserStatus(str, Enum):
    """Trạng thái người dùng"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    BANNED = "banned"

class UserRole(str, Enum):
    """Vai trò người dùng"""
    USER = "user"
    ADMIN = "admin"
    MODERATOR = "moderator"

class UserModel(BaseModel):
    """Model cho người dùng"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    username: str
    email: EmailStr
    password: str  # Đã hash
    fullName: str
    phoneNumber: Optional[str] = None
    role: UserRole = UserRole.USER
    lastLoginAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
    status: UserStatus = UserStatus.ACTIVE

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat(),
        }
        schema_extra = {
            "example": {
                "username": "username123",
                "email": "user@example.com",
                "password": "hashed_password",
                "fullName": "Nguyễn Văn A",
                "phoneNumber": "0123456789",
                "role": "user",
                "status": "active"
            }
        }

class UserCreate(BaseModel):
    """Model cho việc tạo người dùng mới"""
    username: str
    email: EmailStr
    password: str  # Password gốc, sẽ được hash trước khi lưu
    fullName: str
    phoneNumber: Optional[str] = None

class UserUpdate(BaseModel):
    """Model cho việc cập nhật thông tin người dùng"""
    fullName: Optional[str] = None
    phoneNumber: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[UserStatus] = None
    role: Optional[UserRole] = None

class UserInDB(UserModel):
    """Model người dùng với thông tin bổ sung từ database"""
    pass

class UserResponse(BaseModel):
    """Model phản hồi khi truy vấn thông tin người dùng (không bao gồm password)"""
    id: str = Field(..., alias="_id")
    username: str
    email: EmailStr
    fullName: str
    phoneNumber: Optional[str] = None
    role: UserRole
    lastLoginAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime
    status: UserStatus

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }