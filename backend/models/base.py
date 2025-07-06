from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)
    
    @classmethod
    def __get_pydantic_json_schema__(cls, schema_generator):
        return {"type": "string"}

class BaseModelWithId(BaseModel):
    # Base model với các trường chung cho tất cả collections
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={
            ObjectId: str,
            datetime: lambda dt: dt.isoformat(),
        }
    )
   
    id = Field(default_factory=PyObjectId, alias="_id")
    created_at = Field(default_factory=datetime.now)
    updated_at = Field(default_factory=datetime.now)

class BaseResponse(BaseModel):
    # Base response model cho API responses
    model_config = ConfigDict(
        json_encoders={datetime: lambda dt: dt.isoformat()}
    )
   
    success = True
    message = ""
    data = None
    error = None