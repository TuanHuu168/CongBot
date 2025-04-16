import chromadb
import torch
import sys
import os
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import CHROMA_HOST, CHROMA_PORT, CHROMA_COLLECTION, EMBEDDING_MODEL_NAME, USE_GPU

class ChromaDBClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChromaDBClient, cls).__new__(cls)
            cls._instance.client = None
            cls._instance.collection = None
            cls._instance.embedding_function = None
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        try:
            # Khởi tạo embedding function
            device = "cuda" if USE_GPU and torch.cuda.is_available() else "cpu"
            self.embedding_function = SentenceTransformerEmbeddingFunction(
                model_name=EMBEDDING_MODEL_NAME,
                device=device
            )

            # Kết nối tới ChromaDB
            self.client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
            
            # Kiểm tra hoặc tạo collection
            try:
                self.collection = self.client.get_collection(
                    name=CHROMA_COLLECTION,
                    embedding_function=self.embedding_function
                )
                collection_count = self.collection.count()
                print(f"Đã kết nối tới ChromaDB collection '{CHROMA_COLLECTION}', có {collection_count} documents")
            except Exception as e:
                print(f"Collection '{CHROMA_COLLECTION}' chưa tồn tại, đang tạo mới: {str(e)}")
                self.collection = self.client.create_collection(
                    name=CHROMA_COLLECTION,
                    embedding_function=self.embedding_function
                )
                print(f"Đã tạo collection mới '{CHROMA_COLLECTION}'")
        except Exception as e:
            print(f"Lỗi kết nối ChromaDB: {str(e)}")
            self.client = None
            self.collection = None
    
    def get_client(self):
        if not self.client:
            self.initialize()
        return self.client
    
    def get_collection(self):
        if not self.collection:
            self.initialize()
        return self.collection
    
    def add_documents(self, ids, documents, metadatas=None):
        if not self.collection:
            self.initialize()
        
        try:
            self.collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            return True
        except Exception as e:
            print(f"Lỗi khi thêm documents vào ChromaDB: {str(e)}")
            return False
    
    def search(self, query_text, n_results=5, include=None):
        if not self.collection:
            self.initialize()
        
        try:
            # Chuẩn bị prefix cho query
            if not query_text.startswith("query:"):
                query_text = f"query: {query_text}"
                
            # Thực hiện truy vấn
            if include is None:
                include = ["documents", "metadatas", "distances"]
                
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results,
                include=include
            )
            return results
        except Exception as e:
            print(f"Lỗi khi truy vấn ChromaDB: {str(e)}")
            return None
    
    def delete_collection(self, name=None):
        if not self.client:
            self.initialize()
        
        try:
            if name is None:
                name = CHROMA_COLLECTION
                
            self.client.delete_collection(name=name)
            if name == CHROMA_COLLECTION:
                self.collection = None
            return True
        except Exception as e:
            print(f"Lỗi khi xóa collection {name}: {str(e)}")
            return False
    
    def list_collections(self):
        if not self.client:
            self.initialize()
            
        try:
            return self.client.list_collections()
        except Exception as e:
            print(f"Lỗi khi liệt kê collections: {str(e)}")
            return []

chroma_client = ChromaDBClient()

# Lấy collection instance để sử dụng trong các modules khác
collection = chroma_client.get_collection()