import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.chroma_client import chroma_client

def init_chromadb():
    """Khởi tạo ChromaDB và kiểm tra kết nối"""
    try:
        print("Khởi tạo ChromaDB Local...")
        
        # Lấy client và collection
        client = chroma_client.get_client()
        collection = chroma_client.get_collection()
        
        if client and collection:
            print(f"ChromaDB đã khởi tạo thành công!")
            print(f"Collection: {collection.name}")
            print(f"Số documents: {collection.count()}")
            print(f"Storage path: {chroma_client.persist_directory}")
            
            # Kiểm tra danh sách collections
            collections = chroma_client.list_collections()
            print(f"Tất cả collections: {[c.name for c in collections]}")
            
            return True
        else:
            print("Lỗi khởi tạo ChromaDB")
            return False
            
    except Exception as e:
        print(f"Lỗi: {str(e)}")
        return False

if __name__ == "__main__":
    init_chromadb()