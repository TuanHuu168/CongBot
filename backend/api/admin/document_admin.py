from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from typing import List, Dict, Any
from pydantic import BaseModel
import os
import json
import shutil
from pathlib import Path

from config import DATA_DIR
from services.retrieval_service import retrieval_service
from services.activity_service import ActivityType
from .shared_utils import handle_admin_error, log_admin_success, now_utc, validate_admin_request

router = APIRouter()

class DocumentUpload(BaseModel):
    doc_id: str
    doc_type: str
    doc_title: str
    effective_date: str
    status: str = "active"
    document_scope: str = "Quốc gia"

class DocumentInfo(BaseModel):
    doc_id: str
    doc_type: str
    doc_title: str
    effective_date: str
    status: str
    chunks_count: int

class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]

@router.get("/documents", response_model=DocumentListResponse)
async def list_all_documents():
    """Lấy danh sách tất cả documents"""
    try:
        if not os.path.exists(DATA_DIR):
            return DocumentListResponse(documents=[])
        
        documents = []
        for doc_dir in os.listdir(DATA_DIR):
            doc_path = os.path.join(DATA_DIR, doc_dir)
            metadata_path = os.path.join(doc_path, "metadata.json")
            
            if os.path.isdir(doc_path) and os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                        
                    chunks_count = len(metadata.get("chunks", []))
                    
                    doc_info = DocumentInfo(
                        doc_id=metadata.get("doc_id", doc_dir),
                        doc_type=metadata.get("doc_type", "Unknown"),
                        doc_title=metadata.get("doc_title", "Unknown"),
                        effective_date=metadata.get("effective_date", "Unknown"),
                        status=metadata.get("status", "active"),
                        chunks_count=chunks_count
                    )
                    
                    documents.append(doc_info)
                except Exception as e:
                    print(f"Lỗi khi đọc metadata của {doc_dir}: {str(e)}")
        
        documents.sort(key=lambda x: x.doc_id)
        
        return DocumentListResponse(documents=documents)
    except Exception as e:
        handle_admin_error("liệt kê documents", e, ActivityType.DOCUMENT_DELETE)

@router.get("/documents/{doc_id}")
async def get_document_details(doc_id: str):
    """Lấy chi tiết document theo ID"""
    doc_dir = os.path.join(DATA_DIR, doc_id)
    metadata_path = os.path.join(doc_dir, "metadata.json")
    
    if not os.path.exists(doc_dir) or not os.path.exists(metadata_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy văn bản: {doc_id}")
    
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        chunks = []
        for chunk_info in metadata.get("chunks", []):
            chunk_path = os.path.join(DATA_DIR, chunk_info.get("file_path", "").replace("/data/", ""))
            if os.path.exists(chunk_path):
                with open(chunk_path, 'r', encoding='utf-8') as f:
                    chunk_content = f.read()
                
                chunks.append({
                    "chunk_id": chunk_info.get("chunk_id"),
                    "chunk_type": chunk_info.get("chunk_type"),
                    "content_summary": chunk_info.get("content_summary"),
                    "content": chunk_content[:500] + "..." if len(chunk_content) > 500 else chunk_content
                })
        
        metadata["chunks"] = chunks
        
        return metadata
    except Exception as e:
        handle_admin_error("lấy chi tiết document", e)

@router.post("/upload-document")
async def upload_new_document(
    metadata: str = Body(...),
    chunks: List[UploadFile] = File(...)
):
    """Upload document mới với metadata và chunks"""
    try:
        # Parse metadata từ JSON string
        try:
            doc_metadata = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Metadata JSON không hợp lệ")
        
        # Validate required fields
        validate_admin_request(doc_metadata, ["doc_id", "doc_type", "doc_title", "effective_date"])
        
        doc_upload = DocumentUpload(**doc_metadata)
        
        doc_dir = os.path.join(DATA_DIR, doc_upload.doc_id)
        os.makedirs(doc_dir, exist_ok=True)
        
        saved_chunks = []
        for i, chunk in enumerate(chunks):
            file_name = f"chunk_{i+1}.md"
            file_path = os.path.join(doc_dir, file_name)
            
            with open(file_path, "wb") as f:
                f.write(await chunk.read())
            
            saved_chunks.append({
                "chunk_id": f"{doc_upload.doc_id}_chunk_{i+1}",
                "chunk_type": "content",
                "file_path": f"/data/{doc_upload.doc_id}/{file_name}",
                "content_summary": f"Phần {i+1} của {doc_upload.doc_type} {doc_upload.doc_id}"
            })
        
        full_metadata = {
            "doc_id": doc_upload.doc_id,
            "doc_type": doc_upload.doc_type,
            "doc_title": doc_upload.doc_title,
            "issue_date": now_utc().strftime("%d-%m-%Y"),
            "effective_date": doc_upload.effective_date,
            "expiry_date": None,
            "status": doc_upload.status,
            "document_scope": doc_upload.document_scope,
            "replaces": [],
            "replaced_by": None,
            "amends": None,
            "amended_by": None,
            "retroactive": False,
            "retroactive_date": None,
            "chunks": saved_chunks
        }
        
        with open(os.path.join(doc_dir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(full_metadata, f, ensure_ascii=False, indent=2)
        
        log_admin_success(
            "upload document",
            f"Admin upload văn bản {doc_upload.doc_id} với {len(saved_chunks)} chunks",
            ActivityType.DOCUMENT_UPLOAD,
            {
                "doc_id": doc_upload.doc_id,
                "doc_type": doc_upload.doc_type,
                "chunks_count": len(saved_chunks)
            }
        )
        
        return {
            "message": f"Đã tải lên văn bản {doc_upload.doc_id} thành công với {len(saved_chunks)} chunks",
            "doc_id": doc_upload.doc_id
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        # Cleanup nếu có lỗi
        if 'doc_dir' in locals() and os.path.exists(doc_dir):
            shutil.rmtree(doc_dir)
        handle_admin_error("upload document", e, ActivityType.DOCUMENT_UPLOAD)

@router.delete("/documents/{doc_id}")
async def delete_document_by_id(doc_id: str, confirm: bool = False):
    """Xóa document theo ID"""
    if not confirm:
        return {"message": f"Vui lòng xác nhận việc xóa văn bản {doc_id} bằng cách gửi 'confirm: true'"}
    
    doc_dir = os.path.join(DATA_DIR, doc_id)
    
    if not os.path.exists(doc_dir):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy văn bản: {doc_id}")
    
    try:
        # Vô hiệu hóa cache trước khi xóa
        try:
            retrieval_service.invalidate_document_cache(doc_id)
        except Exception as e:
            print(f"Cảnh báo: Không thể vô hiệu hóa cache cho {doc_id}: {str(e)}")
        
        # Xóa thư mục document
        shutil.rmtree(doc_dir)
        
        log_admin_success(
            "xóa document",
            f"Admin xóa văn bản {doc_id}",
            ActivityType.DOCUMENT_DELETE,
            {"doc_id": doc_id}
        )
        
        return {"message": f"Đã xóa văn bản {doc_id} thành công"}
    except Exception as e:
        handle_admin_error("xóa document", e, ActivityType.DOCUMENT_DELETE)