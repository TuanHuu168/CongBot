import os
import sys
from pathlib import Path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.chroma_client import chroma_client
def main():
    print("=== ChromaDB Data Loader ===")
    print("1. Load all data")
    print("2. Check existing data")
    print("3. Clear main collection data")
    print("4. Clear cache collection data")
    print("5. Reset entire database")
    choice = input("Chọn option (1-5): ").strip()
    if choice == "1":
        print("\nBắt đầu load data...")
        success = chroma_client.load_all_data()
        if success:
            print("\nLoad data thành công!")
            progress = chroma_client.get_load_progress()
            print(f"Đã load: {progress['loaded_documents']} documents, {progress['total_chunks']} chunks")
        else:
            print("\nLoad data thất bại!")
    elif choice == "2":
        print("\nKiểm tra data hiện có...")
        chroma_client.check_existing_data()
    elif choice == "3":
        confirm = input("Bạn có chắc muốn xóa tất cả data trong main collection? (yes/no): ").strip().lower()
        if confirm == "yes":
            success = chroma_client.clear_main_collection()
            if success:
                print("Xóa main collection data thành công!")
            else:
                print("Xóa main collection data thất bại!")
        else:
            print("Hủy thao tác xóa main collection data")
    elif choice == "4":
        confirm = input("Bạn có chắc muốn xóa tất cả data trong cache collection? (yes/no): ").strip().lower()
        if confirm == "yes":
            success = chroma_client.clear_cache_collection()
            if success:
                print("Xóa cache collection data thành công!")
            else:
                print("Xóa cache collection data thất bại!")
        else:
            print("Hủy thao tác xóa cache collection data")
    elif choice == "5":
        confirm = input("Bạn có chắc muốn reset toàn bộ database? (yes/no): ").strip().lower()
        if confirm == "yes":
            success = chroma_client.reset_database()
            if success:
                print("Reset database thành công!")
            else:
                print("Reset database thất bại!")
        else:
            print("Hủy thao tác reset database")
    else:
        print("Option không hợp lệ!")

if __name__ == "__main__":

    main()