from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Optional, Any
import bcrypt
from datetime import datetime, timezone
from uuid import uuid4
from bson.objectid import ObjectId

from database.mongodb_client import mongodb_client
from services.activity_service import activity_service, ActivityType

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    fullName: str
    phoneNumber: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    fullName: Optional[str] = None
    email: Optional[EmailStr] = None
    phoneNumber: Optional[str] = None
    personalInfo: Optional[str] = None
    avatarUrl: Optional[str] = None

class PasswordChange(BaseModel):
    currentPassword: str
    newPassword: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def save_user(user_data: dict) -> str:
    if 'password' in user_data:
        user_data['password'] = hash_password(user_data['password'])
    
    user_data["created_at"] = datetime.now(timezone.utc)
    user_data["updated_at"] = datetime.now(timezone.utc)
    
    db = mongodb_client.get_database()
    result = db.users.insert_one(user_data)
    return str(result.inserted_id)

def get_user_by_username(username: str):
    db = mongodb_client.get_database()
    return db.users.find_one({"username": username})

def get_user_by_id(user_id: str):
    db = mongodb_client.get_database()
    try:
        return db.users.find_one({"_id": ObjectId(user_id)})
    except:
        return None

@router.post("/register", response_model=dict)
async def register_user(user: UserCreate):
    try:
        db = mongodb_client.get_database()
        
        existing_user = get_user_by_username(user.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Tên người dùng đã tồn tại")
        
        existing_email = db.users.find_one({"email": user.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email đã được sử dụng")
        
        user_data = {
            "username": user.username,
            "email": user.email,
            "password": user.password,
            "fullName": user.fullName,
            "phoneNumber": user.phoneNumber or "",
            "personalInfo": "",
            "avatarUrl": "",
            "role": "user",
            "status": "active"
        }
        
        user_id = save_user(user_data)
        
        activity_service.log_activity(
            ActivityType.LOGIN,
            f"User registered: {user.username}",
            user_id=user_id,
            user_email=user.email,
            metadata={"action": "register", "username": user.username}
        )
        
        return {
            "message": "Đăng ký thành công",
            "user_id": user_id
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
async def login_user(user_login: UserLogin):
    try:
        user = get_user_by_username(user_login.username)
        if not user:
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
        
        if not verify_password(user_login.password, user["password"]):
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
        
        token = str(uuid4())
        
        db = mongodb_client.get_database()
        db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "token": token, 
                    "last_login": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        activity_service.log_activity(
            ActivityType.LOGIN,
            f"User login: {user_login.username}",
            user_id=str(user["_id"]),
            user_email=user.get("email"),
            metadata={
                "action": "login", 
                "username": user_login.username,
                "role": user.get("role", "user")
            }
        )
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": str(user["_id"])
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}", response_model=dict)
async def get_user_info(user_id: str):
    try:
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        user_data = {
            "id": str(user["_id"]),
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "fullName": user.get("fullName", ""),
            "phoneNumber": user.get("phoneNumber", ""),
            "personalInfo": user.get("personalInfo", ""),
            "avatarUrl": user.get("avatarUrl", ""),
            "role": user.get("role", "user"),
            "status": user.get("status", "active"),
            "created_at": user.get("created_at", datetime.now(timezone.utc)).isoformat(),
            "updated_at": user.get("updated_at", datetime.now(timezone.utc)).isoformat(),
            "last_login": user.get("last_login", "")
        }
        
        if user_data["last_login"] and hasattr(user_data["last_login"], 'isoformat'):
            user_data["last_login"] = user_data["last_login"].isoformat()
        elif not user_data["last_login"]:
            user_data["last_login"] = None
        
        return user_data
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}")
async def update_user(user_id: str, user_update: UserUpdate):
    try:
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        db = mongodb_client.get_database()
        
        update_data = {}
        for field, value in user_update.dict(exclude_unset=True).items():
            if value is not None:
                update_data[field] = value
        
        if not update_data:
            raise HTTPException(status_code=400, detail="Không có dữ liệu để cập nhật")
        
        if "email" in update_data:
            existing_email = db.users.find_one({
                "email": update_data["email"],
                "_id": {"$ne": ObjectId(user_id)}
            })
            if existing_email:
                raise HTTPException(status_code=400, detail="Email đã được sử dụng")
        
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Không thể cập nhật thông tin người dùng")
        
        activity_service.log_activity(
            ActivityType.LOGIN,
            f"User updated profile: {user.get('username')}",
            user_id=user_id,
            user_email=user.get("email"),
            metadata={"action": "update_profile", "fields": list(update_data.keys())}
        )
        
        return {"message": "Cập nhật thông tin thành công"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}/change-password")
async def change_password(user_id: str, password_change: PasswordChange):
    try:
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        if not verify_password(password_change.currentPassword, user["password"]):
            raise HTTPException(status_code=401, detail="Mật khẩu hiện tại không đúng")
        
        if len(password_change.newPassword) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
        
        new_password_hash = hash_password(password_change.newPassword)
        
        db = mongodb_client.get_database()
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "password": new_password_hash,
                    "updated_at": datetime.now(timezone.utc)
                },
                "$unset": {"token": ""}
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Không thể thay đổi mật khẩu")
        
        activity_service.log_activity(
            ActivityType.LOGIN,
            f"User changed password: {user.get('username')}",
            user_id=user_id,
            user_email=user.get("email"),
            metadata={"action": "change_password"}
        )
        
        return {"message": "Đổi mật khẩu thành công"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{user_id}")
async def delete_user(user_id: str, confirm: bool = False):
    try:
        if not confirm:
            raise HTTPException(status_code=400, detail="Vui lòng xác nhận việc xóa người dùng")
        
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        db = mongodb_client.get_database()
        
        db.chats.update_many(
            {"user_id": user_id},
            {"$set": {"status": "deleted", "updated_at": datetime.now(timezone.utc)}}
        )
        
        result = db.users.delete_one({"_id": ObjectId(user_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=400, detail="Không thể xóa người dùng")
        
        activity_service.log_activity(
            ActivityType.LOGIN,
            f"User deleted: {user.get('username')}",
            user_id=user_id,
            user_email=user.get("email"),
            metadata={"action": "delete_user"}
        )
        
        return {"message": f"Đã xóa người dùng {user.get('username')} thành công"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{user_id}/reset-password")
async def reset_user_password(user_id: str, password_data: dict = Body(...)):
    try:
        new_password = password_data.get("new_password")
        if not new_password or len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
        
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        hashed_password = hash_password(new_password)
        
        db = mongodb_client.get_database()
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "password": hashed_password,
                    "updated_at": datetime.now(timezone.utc)
                },
                "$unset": {"token": ""}
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Không thể reset mật khẩu")
        
        activity_service.log_activity(
            ActivityType.LOGIN,
            f"Admin reset password for user: {user.get('username')}",
            user_id=user_id,
            user_email=user.get("email"),
            metadata={"action": "admin_reset_password"}
        )
        
        return {"message": f"Đã reset mật khẩu cho người dùng {user.get('username')} thành công"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{user_id}/toggle-status")
async def toggle_user_status(user_id: str):
    try:
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        current_status = user.get("status", "active")
        new_status = "inactive" if current_status == "active" else "active"
        
        db = mongodb_client.get_database()
        
        if user.get("role") == "admin" and new_status == "inactive":
            active_admin_count = db.users.count_documents({
                "role": "admin",
                "status": "active"
            })
            if active_admin_count <= 1:
                raise HTTPException(status_code=400, detail="Không thể vô hiệu hóa admin cuối cùng")
        
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "status": new_status,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Không thể thay đổi trạng thái người dùng")
        
        activity_service.log_activity(
            ActivityType.LOGIN,
            f"Admin changed user status: {user.get('username')} to {new_status}",
            user_id=user_id,
            user_email=user.get("email"),
            metadata={"action": "toggle_status", "old_status": current_status, "new_status": new_status}
        )
        
        return {
            "message": f"Đã {new_status} người dùng {user.get('username')}",
            "new_status": new_status
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))