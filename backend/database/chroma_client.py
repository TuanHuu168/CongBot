import chromadb
import torch
import sys
import os
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import CHROMA_PERSIST_DIRECTORY, CHROMA_COLLECTION, EMBEDDING_MODEL_NAME, USE_GPU

class ChromaDBClient:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChromaDBClient, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.client = None
            self.collection = None
            self.embedding_function = None
            self.persist_directory = None
            self._initialized = True
            self.initialize()

    def initialize(self):
        """Khởi tạo ChromaDB client và collection"""
        if self.client is not None:
            return  # Đã khởi tạo rồi
            
        try:
            # Tạo thư mục persist nếu chưa tồn tại
            os.makedirs(CHROMA_PERSIST_DIRECTORY, exist_ok=True)
            self.persist_directory = CHROMA_PERSIST_DIRECTORY
            print(f"ChromaDB persist directory: {self.persist_directory}")

            # Khởi tạo embedding function
            device = "cuda" if USE_GPU and torch.cuda.is_available() else "cpu"
            self.embedding_function = SentenceTransformerEmbeddingFunction(
                model_name=EMBEDDING_MODEL_NAME,
                device=device
            )
            print(f"Embedding function initialized on device: {device}")

            # Kết nối tới ChromaDB Local với PersistentClient
            self.client = chromadb.PersistentClient(path=self.persist_directory)
            print(f"ChromaDB PersistentClient initialized at: {self.persist_directory}")
            
            # Tạo hoặc lấy collection
            self._get_or_create_collection()
                
        except Exception as e:
            print(f"Lỗi kết nối ChromaDB: {str(e)}")
            import traceback
            traceback.print_exc()
            self.client = None
            self.collection = None
    
    def _get_or_create_collection(self):
        """Tạo hoặc lấy collection một cách an toàn"""
        if not self.client:
            return
            
        try:
            # Kiểm tra collection đã tồn tại
            try:
                self.collection = self.client.get_collection(
                    name=CHROMA_COLLECTION
                )
                collection_count = self.collection.count()
                print(f"Đã kết nối tới ChromaDB collection '{CHROMA_COLLECTION}', có {collection_count} documents")
                
            except Exception as get_error:
                # Collection chưa tồn tại, tạo mới
                print(f"Collection '{CHROMA_COLLECTION}' chưa tồn tại, đang tạo mới...")
                self.collection = self.client.create_collection(
                    name=CHROMA_COLLECTION,
                    embedding_function=self.embedding_function
                )
                print(f"Đã tạo collection mới '{CHROMA_COLLECTION}'")
                
        except Exception as e:
            print(f"Lỗi khi xử lý collection: {str(e)}")
            import traceback
            traceback.print_exc()
            self.collection = None
    
    def get_client(self):
        """Lấy ChromaDB client"""
        if not self.client:
            self.initialize()
        return self.client
    
    def get_collection(self):
        """Lấy collection"""
        if not self.collection:
            self.initialize()
        return self.collection
    
    def add_documents(self, ids, documents, metadatas=None):
        """Thêm documents vào collection"""
        collection = self.get_collection()
        if not collection:
            print("Không thể lấy collection để thêm documents")
            return False
        
        try:
            collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            return True
        except Exception as e:
            print(f"Lỗi khi thêm documents vào ChromaDB: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def search(self, query_text, n_results=5, include=None):
        """Tìm kiếm documents"""
        collection = self.get_collection()
        if not collection:
            print("Không thể lấy collection để tìm kiếm")
            return None
        
        try:
            # Chuẩn bị prefix cho query
            if not query_text.startswith("query:"):
                query_text = f"query: {query_text}"
                
            # Thực hiện truy vấn
            if include is None:
                include = ["documents", "metadatas", "distances"]
                
            results = collection.query(
                query_texts=[query_text],
                n_results=n_results,
                include=include
            )
            return results
        except Exception as e:
            print(f"Lỗi khi truy vấn ChromaDB: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def delete_collection(self, name=None):
        """Xóa collection"""
        client = self.get_client()
        if not client:
            return False
        
        try:
            if name is None:
                name = CHROMA_COLLECTION
                
            client.delete_collection(name=name)
            if name == CHROMA_COLLECTION:
                self.collection = None
            print(f"Đã xóa collection '{name}'")
            return True
        except Exception as e:
            print(f"Lỗi khi xóa collection {name}: {str(e)}")
            return False
    
    def list_collections(self):
        """Liệt kê tất cả collections"""
        client = self.get_client()
        if not client:
            return []
            
        try:
            collections = client.list_collections()
            return [{"name": col.name, "count": col.count()} for col in collections]
        except Exception as e:
            print(f"Lỗi khi liệt kê collections: {str(e)}")
            return []
    
    def reset_database(self):
        """Reset toàn bộ ChromaDB"""
        try:
            if self.client:
                # Xóa collection hiện tại
                self.delete_collection()
                
                # Tạo lại collection
                self._get_or_create_collection()
                print("Đã reset ChromaDB database")
            return True
        except Exception as e:
            print(f"Lỗi khi reset database: {str(e)}")
            return False
    
    def recreate_collection(self):
        """Tạo lại collection từ đầu"""
        try:
            # Xóa collection cũ nếu tồn tại
            try:
                self.delete_collection()
            except:
                pass
            
            # Tạo collection mới
            self._get_or_create_collection()
            return True
        except Exception as e:
            print(f"Lỗi khi tạo lại collection: {str(e)}")
            return False

# Khởi tạo singleton instance
chroma_client = ChromaDBClient()

# Export để sử dụng ở nơi khác
def get_chroma_client():
    """Hàm helper để lấy ChromaDB client"""
    return chroma_client

def get_collection():
    """Hàm helper để lấy collection"""
    return chroma_client.get_collection()