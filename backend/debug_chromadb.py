import os
import sys
import shutil
import chromadb
from pathlib import Path

# Thêm đường dẫn để import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from config import CHROMA_PERSIST_DIRECTORY, CHROMA_COLLECTION, EMBEDDING_MODEL_NAME, USE_GPU
except ImportError:
    # Fallback values nếu không import được config
    CHROMA_PERSIST_DIRECTORY = "chroma_db"
    CHROMA_COLLECTION = "legal_documents"
    EMBEDDING_MODEL_NAME = "keepitreal/vietnamese-sbert"
    USE_GPU = False

def debug_chromadb():
    """Debug ChromaDB và sửa lỗi"""
    print("=== ChromaDB Debug Tool ===")
    
    # 1. Kiểm tra thư mục
    print(f"1. Kiểm tra thư mục persist: {CHROMA_PERSIST_DIRECTORY}")
    if os.path.exists(CHROMA_PERSIST_DIRECTORY):
        print(f"   ✓ Thư mục tồn tại")
        files = os.listdir(CHROMA_PERSIST_DIRECTORY)
        print(f"   Files: {files}")
    else:
        print(f"   ✗ Thư mục không tồn tại")
        os.makedirs(CHROMA_PERSIST_DIRECTORY, exist_ok=True)
        print(f"   ✓ Đã tạo thư mục")
    
    # 2. Thử kết nối ChromaDB
    print("\n2. Thử kết nối ChromaDB...")
    try:
        client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIRECTORY)
        print("   ✓ Kết nối thành công")
        
        # Liệt kê collections
        collections = client.list_collections()
        print(f"   Collections hiện có: {[col.name for col in collections]}")
        
        # 3. Kiểm tra collection cụ thể
        print(f"\n3. Kiểm tra collection '{CHROMA_COLLECTION}'...")
        collection_exists = any(col.name == CHROMA_COLLECTION for col in collections)
        
        if collection_exists:
            print("   ✓ Collection tồn tại")
            try:
                collection = client.get_collection(name=CHROMA_COLLECTION)
                count = collection.count()
                print(f"   Documents: {count}")
                
                # Kiểm tra metadata của một vài documents
                if count > 0:
                    sample = collection.get(limit=3, include=["metadatas"])
                    print("   Sample metadata:")
                    for i, (doc_id, metadata) in enumerate(zip(sample["ids"], sample["metadatas"])):
                        print(f"     {i+1}. {doc_id}: {list(metadata.keys())}")
                        
            except Exception as e:
                print(f"   ✗ Lỗi khi truy cập collection: {e}")
                return fix_chromadb_collection(client)
        else:
            print("   ✗ Collection không tồn tại")
            return create_new_collection(client)
            
    except Exception as e:
        print(f"   ✗ Lỗi kết nối: {e}")
        return reset_chromadb()
    
    return True

def fix_chromadb_collection(client):
    """Sửa lỗi collection"""
    print("\n=== Sửa lỗi collection ===")
    
    try:
        # Xóa collection có lỗi
        print("Đang xóa collection có lỗi...")
        client.delete_collection(name=CHROMA_COLLECTION)
        print("✓ Đã xóa collection có lỗi")
        
        # Tạo collection mới
        return create_new_collection(client)
        
    except Exception as e:
        print(f"✗ Lỗi khi sửa collection: {e}")
        return reset_chromadb()

def create_new_collection(client):
    """Tạo collection mới"""
    print("\n=== Tạo collection mới ===")
    
    try:
        # Import embedding function
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
        import torch
        
        device = "cuda" if USE_GPU and torch.cuda.is_available() else "cpu"
        embedding_function = SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL_NAME,
            device=device
        )
        
        # Tạo collection
        collection = client.create_collection(
            name=CHROMA_COLLECTION,
            embedding_function=embedding_function
        )
        
        print(f"✓ Đã tạo collection '{CHROMA_COLLECTION}' thành công")
        return True
        
    except Exception as e:
        print(f"✗ Lỗi khi tạo collection: {e}")
        import traceback
        traceback.print_exc()
        return False

def reset_chromadb():
    """Reset hoàn toàn ChromaDB"""
    print("\n=== Reset ChromaDB ===")
    
    try:
        # Xóa thư mục cũ
        if os.path.exists(CHROMA_PERSIST_DIRECTORY):
            shutil.rmtree(CHROMA_PERSIST_DIRECTORY)
            print("✓ Đã xóa thư mục cũ")
        
        # Tạo thư mục mới
        os.makedirs(CHROMA_PERSIST_DIRECTORY, exist_ok=True)
        print("✓ Đã tạo thư mục mới")
        
        # Tạo client và collection mới
        client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIRECTORY)
        return create_new_collection(client)
        
    except Exception as e:
        print(f"✗ Lỗi khi reset: {e}")
        return False

def test_chromadb_operations():
    """Test các thao tác cơ bản với ChromaDB"""
    print("\n=== Test ChromaDB Operations ===")
    
    try:
        from database.chroma_client import get_chroma_client
        
        client = get_chroma_client()
        collection = client.get_collection()
        
        if not collection:
            print("✗ Không thể lấy collection")
            return False
        
        # Test thêm document
        test_ids = ["test_doc_1"]
        test_documents = ["passage: Đây là document test"]
        test_metadatas = [{"doc_id": "test", "chunk_type": "test"}]
        
        print("Testing add documents...")
        success = client.add_documents(
            ids=test_ids,
            documents=test_documents,
            metadatas=test_metadatas
        )
        
        if success:
            print("✓ Thêm document thành công")
            
            # Test search
            print("Testing search...")
            results = client.search("test", n_results=1)
            if results and len(results["ids"][0]) > 0:
                print("✓ Search thành công")
                
                # Xóa test document
                collection.delete(ids=test_ids)
                print("✓ Xóa test document thành công")
                
                return True
            else:
                print("✗ Search thất bại")
        else:
            print("✗ Thêm document thất bại")
            
    except Exception as e:
        print(f"✗ Lỗi test: {e}")
        import traceback
        traceback.print_exc()
    
    return False

def main():
    """Hàm main"""
    print("ChromaDB Debug và Repair Tool")
    print("=" * 50)
    
    # Debug ChromaDB
    success = debug_chromadb()
    
    if success:
        print("\n✓ ChromaDB debug thành công")
        
        # Test operations
        if test_chromadb_operations():
            print("\n✓ Tất cả test đều thành công")
            print("ChromaDB đã sẵn sàng sử dụng!")
        else:
            print("\n✗ Một số test thất bại")
    else:
        print("\n✗ ChromaDB debug thất bại")
        print("Vui lòng kiểm tra lại cấu hình hoặc thư mục quyền truy cập")

if __name__ == "__main__":
    main()