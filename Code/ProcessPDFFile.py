import re
from typing import Optional, List
from google.api_core.client_options import ClientOptions
from google.api_core.exceptions import InternalServerError, RetryError
from google.cloud import documentai
from google.cloud import storage
from PyPDF2 import PdfReader, PdfWriter
import os
import tempfile

def split_pdf(input_pdf_path: str, pages_per_batch: int = 20) -> List[str]:
    """
    Chia PDF thành nhiều file nhỏ hơn
    
    Args:
        input_pdf_path: Đường dẫn đến file PDF gốc
        pages_per_batch: Số trang trong mỗi batch
    
    Returns:
        List đường dẫn đến các file PDF đã chia
    """
    temp_dir = tempfile.mkdtemp()
    pdf_reader = PdfReader(input_pdf_path)
    total_pages = len(pdf_reader.pages)
    batch_files = []

    for start in range(0, total_pages, pages_per_batch):
        end = min(start + pages_per_batch, total_pages)
        pdf_writer = PdfWriter()
        
        # Thêm các trang vào batch hiện tại
        for page_num in range(start, end):
            pdf_writer.add_page(pdf_reader.pages[page_num])
        
        # Lưu batch
        output_path = os.path.join(temp_dir, f'batch_{start+1}_to_{end}.pdf')
        with open(output_path, 'wb') as output_file:
            pdf_writer.write(output_file)
        batch_files.append(output_path)
        
    return batch_files

def upload_to_gcs(storage_client: storage.Client, local_path: str, bucket_name: str, blob_name: str) -> str:
    """
    Upload file lên Google Cloud Storage
    
    Returns:
        GCS URI của file đã upload
    """
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(local_path)
    return f"gs://{bucket_name}/{blob_name}"

def process_pdf_batch(
    project_id: str,
    location: str,
    processor_id: str,
    storage_client: storage.Client,
    input_bucket: str,
    output_bucket: str,
    batch_file: str,
    timeout: int = 1800,
) -> None:
    """Xử lý một batch PDF"""
    
    # Upload batch lên GCS
    blob_name = os.path.basename(batch_file)
    gcs_input_uri = upload_to_gcs(storage_client, batch_file, input_bucket, f"batches/{blob_name}")
    gcs_output_uri = f"gs://{output_bucket}/output/{blob_name}/"

    # Cấu hình Document AI
    opts = ClientOptions(api_endpoint=f"{location}-documentai.googleapis.com")
    client = documentai.DocumentProcessorServiceClient(client_options=opts)
    
    # Cấu hình input/output
    gcs_document = documentai.GcsDocument(gcs_uri=gcs_input_uri, mime_type="application/pdf")
    gcs_documents = documentai.GcsDocuments(documents=[gcs_document])
    input_config = documentai.BatchDocumentsInputConfig(gcs_documents=gcs_documents)
    
    gcs_output_config = documentai.DocumentOutputConfig.GcsOutputConfig(gcs_uri=gcs_output_uri)
    output_config = documentai.DocumentOutputConfig(gcs_output_config=gcs_output_config)
    
    # Tạo request
    name = client.processor_path(project_id, location, processor_id)
    request = documentai.BatchProcessRequest(
        name=name,
        input_documents=input_config,
        document_output_config=output_config,
    )

    try:
        print(f"Đang xử lý batch {blob_name}...")
        operation = client.batch_process_documents(request)
        result = operation.result(timeout=timeout)
        print(f"Hoàn thành xử lý batch {blob_name}")
        
        # Xử lý kết quả
        blobs = storage_client.list_blobs(
            output_bucket,
            prefix=f"output/{blob_name}"
        )
        
        for blob in blobs:
            if blob.name.endswith(".json"):
                print(f"Đang xử lý kết quả từ: {blob.name}")
                document_json = blob.download_as_bytes()
                document = documentai.Document.from_json(document_json, ignore_unknown_fields=True)
                
                # Xử lý từng trang
                for page in document.pages:
                    for table in page.tables:
                        print(f"Bảng trong trang {page.page_number}:")
                        for row_index, row in enumerate(table.body_rows):
                            # Sửa cách truy cập text từ cell
                            row_data = []
                            for cell in row.cells:
                                # Lấy text từ các text segments trong cell
                                cell_text = ""
                                for segment in cell.layout.text_anchor.text_segments:
                                    start_index = segment.start_index
                                    end_index = segment.end_index
                                    cell_text += document.text[start_index:end_index]
                                row_data.append(cell_text)
                            print(f"Hàng {row_index + 1}: {row_data}")
                            
    except Exception as e:
        print(f"Lỗi khi xử lý batch {blob_name}: {str(e)}")
        raise

def main():
    # Thông tin cấu hình
    project_id = "cobalt-column-447001-j2"
    location = "us"
    processor_id = "ec875a3b5beeb529"
    input_bucket = "ai_for_law"
    output_bucket = "output_ocr_doc_ai"
    local_pdf_path = r"D:\University\DATN\PDF\PL QD 1072 ngay 27-2-2024.pdf"  # Đường dẫn local đến file PDF
    pages_per_batch = 20  # Số trang trong mỗi batch
    
    # Khởi tạo storage client
    storage_client = storage.Client()
    
    # Chia file PDF thành các batch
    print("Đang chia file PDF thành các batch...")
    batch_files = split_pdf(local_pdf_path, pages_per_batch)
    print(f"Đã chia thành {len(batch_files)} batch")
    
    # Xử lý từng batch
    for batch_file in batch_files:
        try:
            process_pdf_batch(
                project_id,
                location,
                processor_id,
                storage_client,
                input_bucket,
                output_bucket,
                batch_file
            )
        except Exception as e:
            print(f"Lỗi khi xử lý {batch_file}: {str(e)}")
            continue

    print("Hoàn thành xử lý tất cả các batch!")


main()