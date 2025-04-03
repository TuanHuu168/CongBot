from layoutparser import load_pdf
from pdf2image import convert_from_path
import pytesseract
import layoutparser as lp
import cv2
import pandas as pd
import numpy as np

# Thêm đường dẫn Tesseract (thường là đường dẫn mặc định khi cài đặt)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Chuyển đổi PDF sang hình ảnh
pdf_path = r"D:\University\DATN\PDF\PL QD 1072 ngay 27-2-2024.pdf"
poppler_path = r"C:\Program Files\poppler-24.08.0\Library\bin"
images = convert_from_path(pdf_path, poppler_path=poppler_path)

# Tạo công cụ OCR
ocr_agent = lp.TesseractAgent(languages='vie')  # Sử dụng tiếng Việt

data_list = []

# Duyệt qua từng trang của file PDF
for page_num, img in enumerate(images):
    # Chuyển ảnh thành định dạng OpenCV
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    
    # Dùng LayoutParser để phân tích bố cục
    layout = ocr_agent.detect(img_cv, return_response=True)
    
    # Trích xuất thông tin từ các khối nhận diện
    for block in layout:
        # Sử dụng trực tiếp giá trị của block
        text = block  # block là chuỗi, sử dụng trực tiếp
        data_list.append({
            "Page": page_num + 1,
            "Text": text,
            "Coordinates": None  # Nếu không có tọa độ, đặt là None
        })

# Chuyển dữ liệu thành DataFrame
df = pd.DataFrame(data_list)

# Xuất dữ liệu ra file CSV hoặc Excel
output_path = "test_output.csv"  # Thay bằng đường dẫn lưu trữ
df.to_csv(output_path, index=False)

print("Trích xuất hoàn thành. Dữ liệu đã được lưu.")
