from google.cloud import storage
from google.cloud import documentai
import pandas as pd
from tabulate import tabulate

def read_and_display_from_gcs(bucket_name: str, json_blob_path: str):
    """
    Đọc và hiển thị bảng từ file JSON trong Google Cloud Storage
    
    Args:
        bucket_name: Tên của bucket
        json_blob_path: Đường dẫn đến file JSON trong bucket
    """
    # Khởi tạo GCS client
    storage_client = storage.Client()
    
    # Lấy bucket và blob
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(json_blob_path)
    
    # Đọc nội dung JSON
    json_content = blob.download_as_bytes()
    
    # Parse JSON thành Document AI object
    document = documentai.Document.from_json(json_content, ignore_unknown_fields=True)
    
    # Duyệt qua từng trang và bảng
    for page_num, page in enumerate(document.pages, 1):
        print(f"\nTrang {page_num}:")
        
        for table_num, table in enumerate(page.tables, 1):
            print(f"\nBảng {table_num}:")
            
            # Lấy dữ liệu từ các hàng
            table_data = []
            
            # Xử lý header (nếu có)
            headers = []
            if table.header_rows:
                header_row = table.header_rows[0]
                for cell in header_row.cells:
                    text = ""
                    for segment in cell.layout.text_anchor.text_segments:
                        text += document.text[segment.start_index:segment.end_index]
                    headers.append(text.strip())
            
            # Xử lý body rows
            for row in table.body_rows:
                row_data = []
                for cell in row.cells:
                    text = ""
                    for segment in cell.layout.text_anchor.text_segments:
                        text += document.text[segment.start_index:segment.end_index]
                    row_data.append(text.strip())
                table_data.append(row_data)
            
            # Tạo DataFrame và hiển thị
            if not headers:  # Nếu không có header
                headers = [f'Cột {i+1}' for i in range(len(table_data[0]))]
            
            df = pd.DataFrame(table_data, columns=headers)
            print(tabulate(df, headers='keys', tablefmt='grid', showindex=False))
            
            # Tùy chọn: Lưu ra Excel
            excel_file = f'table_page_{page_num}_table_{table_num}.xlsx'
            df.to_excel(excel_file, index=False)
            print(f"Đã lưu bảng vào file: {excel_file}")

# Thông tin của bạn
bucket_name = "output_ocr_doc_ai"  # Thay bằng tên bucket của bạn
json_blob_path = "output/batch_1_to_20.pdf/11531582440181709984/0/batch_1_to_20-0.json"  # Thay bằng đường dẫn file JSON của bạn

read_and_display_from_gcs(bucket_name, json_blob_path)