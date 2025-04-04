import os
import json
import chromadb
import torch
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

def load_documents_metadata(data_folder):
    """Đọc file metadata.json từ thư mục dữ liệu"""
    documents = []
    
    # Duyệt qua các thư mục văn bản
    for doc_folder in os.listdir(data_folder):
        doc_path = os.path.join(data_folder, doc_folder)
        
        # Kiểm tra nếu là thư mục
        if os.path.isdir(doc_path):
            metadata_path = os.path.join(doc_path, "metadata.json")
            
            # Kiểm tra file metadata tồn tại
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    try:
                        doc_metadata = json.load(f)
                        documents.append(doc_metadata)
                    except json.JSONDecodeError:
                        print(f"Lỗi: Không thể đọc file metadata {metadata_path}")
    
    return documents

def load_chunk_content(file_path):
    """Đọc nội dung chunk từ file"""
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    return None

def save_documents_to_chroma(data_folder, documents, embedding_model_name="intfloat/multilingual-e5-base", collection_name="law_data"):
    """Lưu tất cả các chunks từ các văn bản vào ChromaDB"""
    # Khởi tạo embedding function
    embedding_function = SentenceTransformerEmbeddingFunction(
        model_name=embedding_model_name,
        device="cuda" if torch.cuda.is_available() else "cpu"
    )

    # Kết nối tới ChromaDB
    client = chromadb.HttpClient(host="localhost", port=8000)

    # Tạo hoặc lấy collection
    collection = client.get_or_create_collection(
        name=collection_name,
        embedding_function=embedding_function
    )
    
    # Lấy danh sách các chunk_id đã lưu trong collection để kiểm tra trùng lặp
    existing_chunks = set()
    try:
        # Nếu collection đã có dữ liệu
        if collection.count() > 0:
            # Lấy tất cả các ID hiện có
            results = collection.get(include=["metadatas"])
            for metadata in results["metadatas"]:
                if "chunk_id" in metadata:
                    existing_chunks.add(metadata["chunk_id"])
    except Exception as e:
        print(f"Lỗi khi truy vấn collection: {e}")
    
    print(f"Đã tìm thấy {len(existing_chunks)} chunks trong cơ sở dữ liệu")
    
    # Duyệt qua từng văn bản và xử lý các chunks
    total_added = 0
    total_skipped = 0
    
    for doc in documents:
        doc_id = doc["doc_id"]
        print(f"Đang xử lý văn bản: {doc_id}")
        
        # Xử lý từng chunk trong văn bản
        for chunk_info in doc["chunks"]:
            chunk_id = chunk_info["chunk_id"]
            
            # Kiểm tra nếu chunk đã tồn tại trong DB
            if chunk_id in existing_chunks:
                print(f"  - Bỏ qua chunk {chunk_id} (đã tồn tại)")
                total_skipped += 1
                continue
            
            # Đọc nội dung chunk từ file
            file_path = chunk_info["file_path"].replace("/data/", data_folder + "/")
            content = load_chunk_content(file_path)
            
            if content is None:
                print(f"  - Không thể đọc nội dung chunk từ {file_path}")
                continue
            
            # Chuẩn bị dữ liệu để lưu vào ChromaDB
            # Gắn tiền tố "passage: " theo yêu cầu của một số mô hình embedding
            document = f"passage: {content}"
            
            # Chuẩn bị metadata
            metadata = {
                "chunk_id": chunk_id,
                "chunk_type": chunk_info["chunk_type"],
                "content_summary": chunk_info["content_summary"],
                "doc_id": doc_id,
                "doc_type": doc["doc_type"],
                "doc_title": doc["doc_title"],
                "issue_date": doc["issue_date"],
                "effective_date": doc["effective_date"],
                "status": doc["status"],
                "document_scope": doc["document_scope"]
            }
            
            # Nếu có thêm trường không null trong metadata gốc, thêm vào
            for field in ["expiry_date", "replaces", "replaced_by", "amends", "amended_by"]:
                if field in doc and doc[field] is not None:
                    metadata[field] = json.dumps(doc[field]) if isinstance(doc[field], (list, dict)) else doc[field]
            
            # Lưu vào ChromaDB
            collection.add(
                ids=[chunk_id],
                documents=[document],
                metadatas=[metadata]
            )
            
            print(f"  + Đã thêm chunk {chunk_id}")
            total_added += 1
    
    print(f"Kết quả: Đã thêm {total_added} chunks mới, bỏ qua {total_skipped} chunks đã tồn tại")
    print(f"Tổng số chunks hiện có trong collection: {collection.count()}")

# Sử dụng hàm
data_folder = "data"
documents = load_documents_metadata(data_folder)
save_documents_to_chroma(data_folder, documents)