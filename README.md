# Chatbot Tư vấn Chính sách Người có công

Chatbot thông minh tư vấn chính sách người có công ứng dụng công nghệ RAG (Retrieval-Augmented Generation) nhằm cung cấp thông tin chính xác, kịp thời và dễ hiểu cho người dân về các chính sách liên quan đến người có công.

## Mô tả dự án

Chatbot là một hệ thống trí tuệ nhân tạo được xây dựng để:

1. Truy xuất thông tin chính xác từ các văn bản pháp luật về chính sách người có công
2. Tổng hợp và trình bày thông tin một cách dễ hiểu, phù hợp với người dùng không có chuyên môn pháp lý
3. Luôn cung cấp thông tin mới nhất, đảm bảo cập nhật khi có thay đổi về chính sách

Dự án sử dụng công nghệ RAG (Retrieval-Augmented Generation) để kết hợp khả năng truy xuất thông tin chính xác từ cơ sở dữ liệu văn bản pháp luật với khả năng tổng hợp và trả lời tự nhiên của các mô hình ngôn ngữ lớn.

## Tính năng chính

- **Tìm kiếm ngữ nghĩa**: Hiểu ý định câu hỏi của người dùng, không chỉ dựa vào từ khóa
- **Trích dẫn nguồn**: Luôn cung cấp trích dẫn chính xác đến văn bản pháp luật gốc
- **Ngôn ngữ dễ hiểu**: Diễn giải các quy định pháp luật phức tạp bằng ngôn ngữ đơn giản, dễ hiểu
- **Hệ thống cache thông minh**: Trả lời nhanh chóng các câu hỏi thường gặp
- **Tự động cập nhật**: Tự động vô hiệu hóa cache khi có văn bản pháp luật mới

## Kiến trúc hệ thống

Hệ thống được xây dựng với kiến trúc gồm các thành phần chính:

- **Frontend**: Giao diện người dùng trực quan, dễ sử dụng
- **Backend API**: Xử lý các yêu cầu từ người dùng, quản lý luồng dữ liệu
- **Retrieval Engine**: Tìm kiếm và truy xuất thông tin liên quan từ văn bản pháp luật
- **Generation Service**: Tổng hợp thông tin và tạo câu trả lời tự nhiên, dễ hiểu
- **Database**: Lưu trữ thông tin người dùng, lịch sử hội thoại và cache

### Công nghệ sử dụng

- **Embedding**: Multilingual-E5-Base (fine-tuned)
- **Vector Database**: ChromaDB
- **Generation Model**: Gemini API
- **Database**: MongoDB
- **Backend Framework**: FastAPI
- **Frontend Framework**: React (Vite)

## Cấu trúc thư mục

```
CongBot/
│
├── backend/                        # Phần xử lý backend
│   ├── api/                        # API routes
│   │   ├── admin.py                # Các endpoint quản trị
│   │   └── chat.py                 # Các endpoint chat
│   ├── database/                   # Kết nối và quản lý cơ sở dữ liệu
│   │   ├── chroma_client.py        # Client kết nối ChromaDB
│   │   └── mongodb_client.py       # Client kết nối MongoDB
│   ├── models/                     # Định nghĩa models
│   │   ├── cache.py                # Model cache
│   │   ├── conservation.py         # Model cuộc hội thoại
│   │   └── user.py                 # Model người dùng
│   ├── scripts/                    # Scripts chạy các tác vụ
│   │   ├── delete_collection.py    # Xóa collection
│   │   └── load_documents.py       # Tải văn bản
│   ├── services/                   # Các dịch vụ logic nghiệp vụ
│   │   ├── generation_service.py   # Dịch vụ sinh câu trả lời
│   │   └── retrieval_service.py    # Dịch vụ truy xuất thông tin
│   ├── chromaDB.py                 # Quản lý ChromaDB
│   ├── config.py                   # Cấu hình hệ thống
│   ├── main.py                     # Entry point của API
│   ├── mongodb_utils.py            # Các tiện ích MongoDB
│   └── requirements.txt            # Các thư viện cần thiết
│
├── benchmark/                      # Thư mục benchmark
│   ├── results/                    # Kết quả benchmark
│   │   └── benchmark_results_*.csv # Các file kết quả
│   └── benchmark.json              # Cấu hình benchmark
│
├── data/                           # Thư mục chứa dữ liệu văn bản
│   ├── 101_2018_TT_BTC/            # Thư mục cho mỗi văn bản
│   │   ├── chunk_1.md              # Nội dung chunk
│   │   ├── chunk_2.md
│   │   └── metadata.json           # Metadata của văn bản
│   ├── 1766_QĐ_UBND/
│   │   ├── chunk_1.md
│   │   ├── chunk_2.md
│   │   └── metadata.json
│   └── ...
│
├── frontend/                       # Phần giao diện người dùng
│   ├── public/                     # Các tài nguyên công khai
│   │   └── vite.svg
│   ├── src/                        # Mã nguồn React
│   │   ├── assets/                 # Tài nguyên ứng dụng
│   │   ├── components/             # Các component React
│   │   ├── pages/                  # Các trang của ứng dụng
│   │   ├── App.css                 # Stylesheet chính
│   │   ├── App.jsx                 # Component gốc
│   │   └── main.jsx                # Entry point React
│   ├── eslint.config.js            # Cấu hình ESLint
│   ├── index.html                  # Trang HTML gốc
│   ├── package.json                # Quản lý dependencies
│   ├── tailwind.config.js          # Cấu hình Tailwind CSS
│   └── vite.config.js              # Cấu hình Vite
│
├── create_tree.ps1                 # Script tạo cây thư mục
└── README.md                       # File hướng dẫn này
```

## Cài đặt và chạy

### Yêu cầu

- Python 3.9+
- Node.js 16+
- MongoDB
- ChromaDB
- Gemini API key

### Backend

```bash
# Di chuyển đến thư mục backend
cd backend

# Tạo môi trường ảo (tùy chọn)
python -m venv venv
source venv/bin/activate  # Trên Windows dùng: venv\Scripts\activate

# Cài đặt dependencies
pip install -r requirements.txt

# Thiết lập biến môi trường
# Tạo file .env với các giá trị phù hợp
cp .env.example .env

# Chạy API
python main.py
```

### Frontend

```bash
# Di chuyển đến thư mục frontend
cd frontend

# Cài đặt dependencies
npm install

# Chạy ứng dụng trong chế độ phát triển
npm run dev
```

## API Endpoints

### Chat API

- `POST /chat/ask`: Gửi câu hỏi và nhận câu trả lời
- `POST /chat/retrieve`: Chỉ thực hiện truy xuất thông tin
- `GET /chat/conversations/{conversation_id}`: Lấy thông tin cuộc hội thoại
- `GET /chat/conversations`: Liệt kê các cuộc hội thoại

### Admin API

- `GET /admin/status`: Kiểm tra trạng thái hệ thống
- `POST /admin/run-benchmark`: Chạy benchmark đánh giá hiệu suất
- `GET /admin/benchmark-results`: Liệt kê kết quả benchmark
- `POST /admin/clear-cache`: Xóa toàn bộ cache
- `POST /admin/invalidate-cache/{doc_id}`: Vô hiệu hóa cache cho văn bản cụ thể
- `POST /admin/upload-document`: Tải lên văn bản mới

## Liên hệ

Để biết thêm thông tin, vui lòng liên hệ: [tuanhuu.thhn@gmail.com](mailto:tuanhuu.thhn@gmail.com)