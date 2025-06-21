import os
import json
import sys
from typing import List, Dict, Any
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DATA_DIR, CHROMA_PERSIST_DIRECTORY, CHROMA_COLLECTION
from database.chroma_client import chroma_client

class DataLoader:
    def __init__(self):
        self.chroma_client = chroma_client
        self.collection = None
        self.loaded_documents = 0
        self.total_chunks = 0
        
    def initialize(self):
        """Khởi tạo ChromaDB collection"""
        try:
            self.collection = self.chroma_client.get_collection()
            if self.collection:
                print(f"Đã kết nối tới collection '{self.collection.name}'")
                current_count = self.collection.count()
                print(f"Collection hiện có {current_count} documents")
                return True
            else:
                print("Không thể kết nối tới ChromaDB collection")
                return False
        except Exception as e:
            print(f"Lỗi khởi tạo: {str(e)}")
            return False
    
    def read_chunk_content(self, file_path: str, doc_folder: str) -> str:
        """Đọc nội dung từ file chunk"""
        try:
            print(f"    Đang đọc file: {file_path}")
            
            # Sử dụng đường dẫn từ metadata
            if file_path.startswith("/data/"):
                # Bỏ dấu / đầu
                relative_path = file_path[1:]
                full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), relative_path)
            elif file_path.startswith("data/"):
                full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), file_path)
            else:
                # Nếu chỉ là tên file, tạo đường dẫn từ doc_folder
                full_path = os.path.join(doc_folder, file_path)
            
            print(f"    Đường dẫn đầy đủ: {full_path}")
            
            # Kiểm tra file tồn tại
            if os.path.exists(full_path):
                with open(full_path, 'r', encoding='utf-8-sig') as f:
                    content = f.read().strip()
                    print(f"    Đọc thành công, độ dài: {len(content)} ký tự")
                    return content
            else:
                print(f"    Không tìm thấy file: {full_path}")
                return ""
            
        except Exception as e:
            print(f"    Lỗi đọc file {file_path}: {str(e)}")
            return ""
    
    def safe_join_list(self, value, default_value=""):
        """An toàn join list, xử lý trường hợp None hoặc không phải list"""
        if value is None:
            return default_value
        elif isinstance(value, list):
            return ", ".join(str(item) for item in value if item is not None)
        elif isinstance(value, str):
            return value
        else:
            return str(value) if value is not None else default_value
    
    def create_chunk_metadata(self, doc_metadata: Dict[str, Any], chunk_info: Dict[str, Any], chunk_index: int) -> Dict[str, Any]:
        """Tạo metadata đầy đủ cho chunk với xử lý an toàn"""
        chunks_list = doc_metadata.get("chunks", [])
        
        # Tính toán chunk trước và sau
        previous_chunk = chunks_list[chunk_index - 1]["chunk_id"] if chunk_index > 0 else None
        next_chunk = chunks_list[chunk_index + 1]["chunk_id"] if chunk_index < len(chunks_list) - 1 else None
        
        # Chuẩn bị related documents
        related_docs = []
        related_documents = doc_metadata.get("related_documents", [])
        if related_documents and isinstance(related_documents, list):
            for rel_doc in related_documents:
                if isinstance(rel_doc, dict):
                    doc_id = rel_doc.get('doc_id', '')
                    relationship = rel_doc.get('relationship', '')
                    if doc_id:
                        related_docs.append(f"{doc_id} ({relationship})")
        
        metadata = {
            # Thông tin document - sử dụng safe_join_list
            "doc_id": str(doc_metadata.get("doc_id", "")),
            "doc_type": str(doc_metadata.get("doc_type", "")),
            "doc_title": str(doc_metadata.get("doc_title", "")),
            "issue_date": str(doc_metadata.get("issue_date", "")),
            "effective_date": str(doc_metadata.get("effective_date", "")),
            "expiry_date": str(doc_metadata.get("expiry_date", "") if doc_metadata.get("expiry_date") else ""),
            "status": str(doc_metadata.get("status", "")),
            "document_scope": str(doc_metadata.get("document_scope", "")),
            "replaces": self.safe_join_list(doc_metadata.get("replaces")),
            "replaced_by": str(doc_metadata.get("replaced_by", "") if doc_metadata.get("replaced_by") else ""),
            "amends": self.safe_join_list(doc_metadata.get("amends")),
            "amended_by": str(doc_metadata.get("amended_by", "") if doc_metadata.get("amended_by") else ""),
            "retroactive": str(doc_metadata.get("retroactive", False)),
            "retroactive_date": str(doc_metadata.get("retroactive_date", "") if doc_metadata.get("retroactive_date") else ""),
            
            # Thông tin chunk
            "chunk_id": str(chunk_info.get("chunk_id", "")),
            "chunk_type": str(chunk_info.get("chunk_type", "")),
            "content_summary": str(chunk_info.get("content_summary", "")),
            "chunk_index": str(chunk_index),
            "total_chunks": str(len(chunks_list)),
            
            # Thông tin vị trí chunk
            "previous_chunk": str(previous_chunk) if previous_chunk else "",
            "next_chunk": str(next_chunk) if next_chunk else "",
            
            # Related documents
            "related_documents": "; ".join(related_docs),
            "related_docs_count": str(len(related_docs))
        }
        
        return metadata
    
    def process_document(self, doc_folder: str) -> bool:
        """Xử lý một document folder"""
        try:
            metadata_path = os.path.join(doc_folder, "metadata.json")
            
            if not os.path.exists(metadata_path):
                print(f"Không tìm thấy metadata.json trong {doc_folder}")
                return False
            
            # Đọc metadata
            with open(metadata_path, 'r', encoding='utf-8-sig') as f:
                doc_metadata = json.load(f)
            
            doc_id = doc_metadata.get("doc_id", os.path.basename(doc_folder))
            print(f"Đang xử lý document: {doc_id}")
            
            chunks_to_add = []
            documents_to_add = []
            metadatas_to_add = []
            ids_to_add = []
            
            chunks_list = doc_metadata.get("chunks", [])
            for chunk_index, chunk_info in enumerate(chunks_list):
                chunk_id = chunk_info.get("chunk_id", "")
                file_path = chunk_info.get("file_path", "")
                
                if not chunk_id:
                    print(f"  Cảnh báo: Chunk không có chunk_id, bỏ qua")
                    continue
                
                # Đọc nội dung chunk với doc_folder
                content = self.read_chunk_content(file_path, doc_folder)
                if not content:
                    print(f"  Cảnh báo: Chunk {chunk_id} không có nội dung, bỏ qua")
                    continue
                
                # Tạo document text với prefix cho embedding
                document_text = f"passage: {content}"
                
                # Tạo metadata đầy đủ
                chunk_metadata = self.create_chunk_metadata(doc_metadata, chunk_info, chunk_index)
                
                # Thêm vào danh sách
                ids_to_add.append(chunk_id)
                documents_to_add.append(document_text)
                metadatas_to_add.append(chunk_metadata)
                
                print(f"  - Chunk {chunk_index + 1}/{len(chunks_list)}: {chunk_id}")
            
            # Thêm tất cả chunks của document này vào ChromaDB
            if ids_to_add:
                try:
                    self.collection.add(
                        ids=ids_to_add,
                        documents=documents_to_add,
                        metadatas=metadatas_to_add
                    )
                    print(f"Đã thêm {len(ids_to_add)} chunks cho document {doc_id}")
                    self.total_chunks += len(ids_to_add)
                    return True
                except Exception as e:
                    print(f"Lỗi khi thêm chunks vào ChromaDB: {str(e)}")
                    return False
            else:
                print(f"Không có chunk nào hợp lệ cho document {doc_id}")
                return False
                
        except Exception as e:
            print(f"Lỗi xử lý document {doc_folder}: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def load_all_data(self):
        """Load tất cả data từ thư mục data"""
        if not self.initialize():
            return False
        
        if not os.path.exists(DATA_DIR):
            print(f"Thư mục data không tồn tại: {DATA_DIR}")
            return False
        
        print(f"Bắt đầu load data từ: {DATA_DIR}")
        print("=" * 60)
        
        # Lấy danh sách tất cả các thư mục document
        doc_folders = []
        for item in os.listdir(DATA_DIR):
            item_path = os.path.join(DATA_DIR, item)
            if os.path.isdir(item_path):
                doc_folders.append(item_path)
        
        if not doc_folders:
            print("Không tìm thấy thư mục document nào trong data")
            return False
        
        print(f"Tìm thấy {len(doc_folders)} documents")
        
        # Xử lý từng document
        successful_docs = 0
        for doc_folder in sorted(doc_folders):
            if self.process_document(doc_folder):
                successful_docs += 1
                self.loaded_documents += 1
            print("-" * 40)
        
        print("=" * 60)
        print(f"Hoàn thành load data:")
        print(f"  - Documents thành công: {successful_docs}/{len(doc_folders)}")
        print(f"  - Tổng chunks đã thêm: {self.total_chunks}")
        
        # Kiểm tra kết quả cuối cùng
        final_count = self.collection.count()
        print(f"  - Tổng documents trong ChromaDB: {final_count}")
        
        return successful_docs > 0
    
    def check_existing_data(self):
        """Kiểm tra data hiện có trong ChromaDB"""
        if not self.initialize():
            return
        
        try:
            total_count = self.collection.count()
            print(f"ChromaDB hiện có {total_count} documents")
            
            if total_count > 0:
                # Lấy một số sample để kiểm tra
                sample_results = self.collection.get(
                    limit=5,
                    include=["documents", "metadatas"]
                )
                
                print("\nSample documents:")
                for i, (doc_id, metadata) in enumerate(zip(sample_results["ids"], sample_results["metadatas"])):
                    print(f"{i+1}. {doc_id}")
                    print(f"   Doc: {metadata.get('doc_id', 'N/A')}")
                    print(f"   Type: {metadata.get('doc_type', 'N/A')}")
                    print(f"   Chunk: {metadata.get('chunk_type', 'N/A')}")
            
        except Exception as e:
            print(f"Lỗi kiểm tra data: {str(e)}")
    
    def clear_all_data(self):
        """Xóa tất cả data trong ChromaDB bằng cách xóa và tạo lại collection"""
        print("Đang xóa tất cả data...")
        
        try:
            client = self.chroma_client.get_client()
            if client:
                # Xóa collection hiện tại
                try:
                    client.delete_collection(name=CHROMA_COLLECTION)
                    print(f"Đã xóa collection '{CHROMA_COLLECTION}'")
                except Exception as e:
                    print(f"Lỗi xóa collection: {str(e)}")
                
                # Tạo lại collection
                try:
                    new_collection = client.create_collection(
                        name=CHROMA_COLLECTION,
                        embedding_function=self.chroma_client.embedding_function
                    )
                    print(f"Đã tạo lại collection '{CHROMA_COLLECTION}'")
                    
                    # Cập nhật instance collection
                    self.chroma_client.collection = new_collection
                    
                    final_count = new_collection.count()
                    print(f"Collection mới có {final_count} documents")
                    return True
                    
                except Exception as e:
                    print(f"Lỗi tạo lại collection: {str(e)}")
        
        except Exception as e:
            print(f"Lỗi xóa data: {str(e)}")
        
        return False

def main():
    """Hàm main để chạy data loading"""
    print("=== ChromaDB Data Loader ===")
    print("1. Load all data")
    print("2. Check existing data")
    print("3. Clear all data")
    
    choice = input("Chọn option (1-3): ").strip()
    
    loader = DataLoader()
    
    if choice == "1":
        print("\nBắt đầu load data...")
        success = loader.load_all_data()
        if success:
            print("\nLoad data thành công!")
        else:
            print("\nLoad data thất bại!")
    
    elif choice == "2":
        print("\nKiểm tra data hiện có...")
        loader.check_existing_data()
    
    elif choice == "3":
        confirm = input("Bạn có chắc muốn xóa tất cả data? (yes/no): ").strip().lower()
        if confirm == "yes":
            success = loader.clear_all_data()
            if success:
                print("Xóa data thành công!")
            else:
                print("Xóa data thất bại!")
        else:
            print("Hủy thao tác xóa data")
    
    else:
        print("Option không hợp lệ!")

if __name__ == "__main__":
    main()