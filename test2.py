import os
import json

def process_chunks_in_folder(data_folder="data"):
    """
    Xử lý tất cả các folder trong thư mục data để kiểm tra và thêm chunk_id vào đầu file
    """
    
    # Lấy tất cả các subfolder trong data
    subfolders = [f for f in os.listdir(data_folder) if os.path.isdir(os.path.join(data_folder, f))]
    
    for subfolder in subfolders:
        subfolder_path = os.path.join(data_folder, subfolder)
        metadata_path = os.path.join(subfolder_path, "metadata.json")
        
        # Kiểm tra xem có file metadata.json không
        if not os.path.exists(metadata_path):
            print(f"Không tìm thấy metadata.json trong {subfolder}")
            continue
            
        try:
            # Đọc file metadata.json
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            print(f"\n--- Xử lý folder: {subfolder} ---")
            
            # Lấy thông tin chunks
            chunks = metadata.get('chunks', [])
            
            for chunk in chunks:
                chunk_id = chunk.get('chunk_id', '')
                file_path = chunk.get('file_path', '')
                
                if not chunk_id or not file_path:
                    print(f"Thiếu thông tin chunk_id hoặc file_path cho chunk: {chunk}")
                    continue
                
                # XỬ LÝ ĐƯỜNG DẪN - ĐÂY LÀ PHẦN SỬA LỖI
                # file_path trong metadata có dạng: "/data/12_2012_QĐ_UBND/chunk_1.md"
                # Ta cần lấy phần sau "/data/" và ghép với subfolder_path
                if file_path.startswith('/data/'):
                    # Lấy phần sau /data/
                    relative_path = file_path[6:]  # Bỏ "/data/" đi
                    # Lấy tên file (phần cuối cùng)
                    filename = os.path.basename(relative_path)
                    # Tạo đường dẫn đầy đủ
                    full_file_path = os.path.join(subfolder_path, filename)
                else:
                    # Nếu không có /data/ ở đầu, lấy basename
                    filename = os.path.basename(file_path)
                    full_file_path = os.path.join(subfolder_path, filename)
                
                # Chuẩn hóa đường dẫn
                full_file_path = os.path.normpath(full_file_path)
                
                # Kiểm tra file có tồn tại không
                if not os.path.exists(full_file_path):
                    print(f"File không tồn tại: {full_file_path}")
                    continue
                
                # Đọc nội dung file
                try:
                    with open(full_file_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    
                    # Kiểm tra dòng đầu tiên
                    expected_header = f"# {chunk_id}"
                    
                    if lines and lines[0].strip() == expected_header:
                        print(f"✓ File {os.path.basename(full_file_path)} đã có chunk_id")
                    else:
                        # Thêm chunk_id vào đầu file
                        print(f"+ Thêm chunk_id vào file {os.path.basename(full_file_path)}")
                        
                        # Tạo backup trước khi sửa đổi
                        backup_path = full_file_path + ".backup"
                        with open(backup_path, 'w', encoding='utf-8') as f:
                            f.writelines(lines)
                        
                        # Ghi lại file với chunk_id ở đầu
                        with open(full_file_path, 'w', encoding='utf-8') as f:
                            f.write(f"# {chunk_id}\n\n")
                            # Nếu dòng đầu tiên đã là header khác, thay thế
                            if lines and lines[0].startswith('# '):
                                f.writelines(lines[1:])
                            else:
                                f.writelines(lines)
                        
                        print(f"  → Đã tạo backup: {os.path.basename(backup_path)}")
                
                except Exception as e:
                    print(f"Lỗi khi xử lý file {full_file_path}: {e}")
                    
        except Exception as e:
            print(f"Lỗi khi xử lý folder {subfolder}: {e}")

def verify_chunks(data_folder="data"):
    """
    Kiểm tra lại tất cả các file chunk xem đã có chunk_id chưa
    """
    print("\n=== KIỂM TRA LẠI ===")
    
    subfolders = [f for f in os.listdir(data_folder) if os.path.isdir(os.path.join(data_folder, f))]
    
    for subfolder in subfolders:
        subfolder_path = os.path.join(data_folder, subfolder)
        metadata_path = os.path.join(subfolder_path, "metadata.json")
        
        if not os.path.exists(metadata_path):
            continue
            
        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            chunks = metadata.get('chunks', [])
            print(f"\n{subfolder}:")
            
            for chunk in chunks:
                chunk_id = chunk.get('chunk_id', '')
                file_path = chunk.get('file_path', '')
                
                if not chunk_id or not file_path:
                    continue
                
                # Sử dụng cùng logic xử lý đường dẫn
                if file_path.startswith('/data/'):
                    filename = os.path.basename(file_path)
                    full_file_path = os.path.join(subfolder_path, filename)
                else:
                    filename = os.path.basename(file_path)
                    full_file_path = os.path.join(subfolder_path, filename)
                
                full_file_path = os.path.normpath(full_file_path)
                
                if os.path.exists(full_file_path):
                    with open(full_file_path, 'r', encoding='utf-8') as f:
                        first_line = f.readline().strip()
                    
                    if first_line == f"# {chunk_id}":
                        print(f"  ✓ {os.path.basename(full_file_path)}: {first_line}")
                    else:
                        print(f"  ✗ {os.path.basename(full_file_path)}: {first_line}")
                else:
                    print(f"  ⚠ File không tồn tại: {os.path.basename(full_file_path)}")
                        
        except Exception as e:
            print(f"Lỗi khi kiểm tra folder {subfolder}: {e}")

# Hàm debug để kiểm tra cấu trúc thư mục
def debug_folder_structure(data_folder="data"):
    """
    Debug để xem cấu trúc thư mục và file thực tế
    """
    print("=== DEBUG: Cấu trúc thư mục ===")
    
    for root, dirs, files in os.walk(data_folder):
        level = root.replace(data_folder, '').count(os.sep)
        indent = ' ' * 2 * level
        print(f"{indent}{os.path.basename(root)}/")
        subindent = ' ' * 2 * (level + 1)
        for file in files:
            print(f"{subindent}{file}")

if __name__ == "__main__":
    # Debug trước để xem cấu trúc
    debug_folder_structure()
    
    # Chạy xử lý
    process_chunks_in_folder()
    
    # Kiểm tra lại kết quả
    verify_chunks()