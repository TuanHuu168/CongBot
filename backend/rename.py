import json
import os
import glob

def update_file_paths_in_folder(folder_path):
    """Cập nhật file_path trong metadata.json của một folder"""
    metadata_file = os.path.join(folder_path, 'metadata.json')
    
    if not os.path.exists(metadata_file):
        print(f"⚠️  Không tìm thấy metadata.json trong {folder_path}")
        return False
    
    try:
        # Đọc file JSON
        with open(metadata_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Lấy tên folder để làm doc_id
        folder_name = os.path.basename(folder_path)
        
        # Sửa file_path cho từng chunk
        for chunk in data['chunks']:
            chunk_id = chunk['chunk_id']
            directory = f"/data/{folder_name}"
            new_path = f"{directory}/{chunk_id}.md"
            
            old_path = chunk['file_path']
            chunk['file_path'] = new_path
            
            print(f"  📝 {os.path.basename(old_path)} -> {chunk_id}.md")
        
        # Lưu lại file
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Đã cập nhật: {folder_path}")
        return True
        
    except Exception as e:
        print(f"❌ Lỗi khi xử lý {folder_path}: {e}")
        return False

def process_all_folders(data_directory):
    """Xử lý tất cả các folder trong thư mục data"""
    
    # Tìm tất cả các folder con
    folders = [f for f in os.listdir(data_directory) 
              if os.path.isdir(os.path.join(data_directory, f))]
    
    print(f"🔍 Tìm thấy {len(folders)} folders cần xử lý...")
    print("-" * 50)
    
    success_count = 0
    
    for folder_name in sorted(folders):
        folder_path = os.path.join(data_directory, folder_name)
        print(f"\n📁 Đang xử lý: {folder_name}")
        
        if update_file_paths_in_folder(folder_path):
            success_count += 1
    
    print("\n" + "="*50)
    print(f"🎉 Hoàn thành! Đã xử lý thành công {success_count}/{len(folders)} folders")

# Sử dụng
data_directory = "data"  # Thay bằng đường dẫn thư mục data của bạn
process_all_folders(data_directory)