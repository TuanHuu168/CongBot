import json
import os
from pathlib import Path

def process_chunks_and_metadata():
    # Đọc file test_data.json
    with open('test_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Lấy thông tin chunks
    chunks = data.get('chunks', [])
    
    # Tạo thư mục gốc cho các chunks
    base_dir = None
    
    # Xử lý từng chunk
    for chunk in chunks:
        chunk_id = chunk.get('chunk_id', '')
        file_path = chunk.get('file_path', '')
        content = chunk.get('content', '')
        
        # Tạo đường dẫn file đầy đủ
        # Loại bỏ dấu / đầu nếu có
        if file_path.startswith('/'):
            file_path = file_path[1:]
        
        # Tạo thư mục nếu chưa tồn tại
        file_dir = os.path.dirname(file_path)
        if file_dir:
            os.makedirs(file_dir, exist_ok=True)
            if base_dir is None:
                base_dir = file_dir.split('/')[0] if '/' in file_dir else file_dir
        
        # Tạo nội dung file với format yêu cầu
        file_content = f"# {chunk_id}\n{content}"
        
        # Ghi file chunk
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(file_content)
        
        print(f"Đã tạo file: {file_path}")
    
    # Tạo metadata.json (bỏ phần content trong chunks)
    metadata = data.copy()
    
    # Loại bỏ content từ các chunks
    if 'chunks' in metadata:
        for chunk in metadata['chunks']:
            if 'content' in chunk:
                del chunk['content']
    
    # Xác định thư mục để lưu metadata.json
    metadata_dir = base_dir if base_dir else 'data'
    metadata_path = os.path.join(metadata_dir, 'metadata.json')
    
    # Tạo thư mục nếu cần
    os.makedirs(metadata_dir, exist_ok=True)
    
    # Ghi file metadata.json
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=4)
    
    print(f"Đã tạo file metadata: {metadata_path}")
    print(f"Tổng cộng đã xử lý {len(chunks)} chunks")

if __name__ == "__main__":
    try:
        process_chunks_and_metadata()
        print("Hoàn thành xử lý!")
    except FileNotFoundError:
        print("Không tìm thấy file test_data.json")
    except Exception as e:
        print(f"Lỗi: {e}")