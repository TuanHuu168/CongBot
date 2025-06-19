from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Optional, Any
import bcrypt
from datetime import datetime
from uuid import uuid4
from bson.objectid import ObjectId

# Import database client
from database.mongodb_client import mongodb_client

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

# === MODELS ===
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str  # Password gốc, sẽ được hash trước khi lưu
    fullName: str
    phoneNumber: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str

# === UTILITY FUNCTIONS ===
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def save_user(user_data: dict) -> str:
    # Hash password trước khi lưu
    if 'password' in user_data:
        user_data['password'] = hash_password(user_data['password'])
    
    user_data["created_at"] = datetime.now()
    
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

# === ENDPOINTS ===
@router.post("/register", response_model=dict)
async def register_user(user: UserCreate):
    try:
        db = mongodb_client.get_database()
        
        # Kiểm tra xem người dùng đã tồn tại chưa
        existing_user = get_user_by_username(user.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Tên người dùng đã tồn tại")
        
        # Kiểm tra email đã tồn tại chưa
        existing_email = db.users.find_one({"email": user.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email đã được sử dụng")
        
        # Tạo người dùng mới
        user_data = user.dict()
        
        # Lưu vào MongoDB và lấy ID
        user_id = save_user(user_data)
        
        return {
            "message": "Đăng ký thành công",
            "user_id": user_id
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in /users/register endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
async def login_user(user_login: UserLogin):
    try:
        # Tìm user trong database
        user = get_user_by_username(user_login.username)
        if not user:
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
        
        # Kiểm tra mật khẩu
        if not verify_password(user_login.password, user["password"]):
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
        
        # Tạo token đơn giản (trong thực tế nên dùng JWT)
        token = str(uuid4())
        
        # Lưu token vào user (hoặc trong bảng sessions riêng)
        db = mongodb_client.get_database()
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"token": token, "last_login": datetime.now()}}
        )
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": str(user["_id"])
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in /users/login endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}", response_model=dict)
async def get_user_info(user_id: str):
    try:
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
        # Tạo đối tượng trả về (loại bỏ password)
        user_data = {
            "id": str(user["_id"]),
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "fullName": user.get("fullName", ""),
            "phoneNumber": user.get("phoneNumber", ""),
            "role": user.get("role", "user"),
            "created_at": user.get("created_at", datetime.now())
        }
        
        return user_data
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in get_user_info endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
# @router.put("/{user_id}", response_model=dict)
# async def update_user(user_id: str, user_update: UserUpdate):
#     try:
#         # Kiểm tra người dùng tồn tại
#         user = get_user_by_id(user_id)
#         if not user:
#             raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
#         # Tạo dictionary chứa các trường cần cập nhật
#         update_data = {}
#         if user_update.fullName is not None:
#             update_data["fullName"] = user_update.fullName
#         if user_update.email is not None:
#             update_data["email"] = user_update.email
#         if user_update.phoneNumber is not None:
#             update_data["phoneNumber"] = user_update.phoneNumber
        
#         # Thêm thời gian cập nhật
#         update_data["updatedAt"] = datetime.now()
        
#         # Cập nhật vào database
#         db = mongodb_client.get_database()
#         result = db.users.update_one(
#             {"_id": ObjectId(user_id)},
#             {"$set": update_data}
#         )
        
#         if result.modified_count == 0:
#             raise HTTPException(status_code=400, detail="Không có thông tin nào được cập nhật")
        
#         return {
#             "message": "Cập nhật thông tin người dùng thành công",
#             "user_id": user_id
#         }
#     except HTTPException as he:
#         raise he
#     except Exception as e:
#         print(f"Error in update_user endpoint: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @router.put("/{user_id}/password", response_model=dict)
# async def change_password(user_id: str, password_change: dict = Body(...)):
#     try:
#         # Kiểm tra dữ liệu đầu vào
#         current_password = password_change.get("currentPassword")
#         new_password = password_change.get("newPassword")
        
#         if not current_password or not new_password:
#             raise HTTPException(status_code=400, detail="Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới")
        
#         # Kiểm tra người dùng tồn tại
#         user = get_user_by_id(user_id)
#         if not user:
#             raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
#         # Kiểm tra mật khẩu hiện tại
#         if not verify_password(current_password, user["password"]):
#             raise HTTPException(status_code=401, detail="Mật khẩu hiện tại không đúng")
        
#         # Hash mật khẩu mới
#         hashed_new_password = hash_password(new_password)
        
#         # Cập nhật mật khẩu vào database
#         db = mongodb_client.get_database()
#         result = db.users.update_one(
#             {"_id": ObjectId(user_id)},
#             {
#                 "$set": {
#                     "password": hashed_new_password,
#                     "updatedAt": datetime.now()
#                 }
#             }
#         )
        
#         if result.modified_count == 0:
#             raise HTTPException(status_code=400, detail="Không thể cập nhật mật khẩu")
        
#         return {
#             "message": "Cập nhật mật khẩu thành công",
#             "user_id": user_id
#         }
#     except HTTPException as he:
#         raise he
#     except Exception as e:
#         print(f"Error in change_password endpoint: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))