import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.chroma_client import chroma_client

def init_chromadb():
    """Khởi tạo ChromaDB và kiểm tra kết nối"""
    try:
        print("Khởi tạo ChromaDB Local...")
        
        client = chroma_client.get_client()
        main_collection = chroma_client.get_main_collection()
        cache_collection = chroma_client.get_cache_collection()
        
        if client and main_collection and cache_collection:
            print(f"ChromaDB đã khởi tạo thành công!")
            
            stats = chroma_client.get_collection_stats()
            print(f"Main collection: {stats['main_collection']['name']} ({stats['main_collection']['count']} documents)")
            print(f"Cache collection: {stats['cache_collection']['name']} ({stats['cache_collection']['count']} documents)")
            print(f"Storage path: {chroma_client.persist_directory}")
            
            try:
                collections_info = chroma_client.list_collections()
                print(f"Tất cả collections: {collections_info}")
            except Exception as e:
                print(f"Lỗi khi liệt kê collections: {str(e)}")
            
            return True
        else:
            print("Lỗi khởi tạo ChromaDB")
            return False
            
    except Exception as e:
        print(f"Lỗi: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    init_chromadb()