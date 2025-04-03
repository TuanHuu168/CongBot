import requests
from bs4 import BeautifulSoup

# URL của văn bản cần lấy dữ liệu
url = "https://thuvienphapluat.vn/van-ban/Tai-chinh-nha-nuoc/Nghi-dinh-77-2024-ND-CP-sua-doi-Nghi-dinh-75-2021-ND-CP-muc-tro-cap-nguoi-co-cong-cach-mang-614759.aspx"

# Gửi request lấy dữ liệu HTML
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
}
response = requests.get(url, headers=headers)

if response.status_code != 200:
    print(f"Lỗi khi gửi request: {response.status_code}")
else:
    # Phân tích HTML bằng BeautifulSoup
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Lấy tiêu đề của văn bản
    title = soup.find("h1").text.strip() if soup.find("h1") else "Không tìm thấy tiêu đề"
    
    # Lấy nội dung trong thẻ div có class "content1"
    content = soup.find("div", class_="content1")
    content_text = content.text.strip() if content else "Không tìm thấy nội dung"
    
    # Lưu kết quả vào dictionary
    document_info = {
        "Title": title,
        "Content": content_text
    }
    
    print(document_info)
