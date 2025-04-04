# NCC Chatbot - Chatbot Tư vấn Chính sách Người có công

Chatbot thông minh tư vấn chính sách người có công ứng dụng công nghệ RAG (Retrieval-Augmented Generation) nhằm cung cấp thông tin chính xác, kịp thời và dễ hiểu cho người dân về các chính sách liên quan đến người có công.

## Mô tả dự án

NCC Chatbot là một hệ thống trí tuệ nhân tạo được xây dựng để:

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
- **Frontend Framework**: (Tùy chọn, có thể là React/Vue/Angular)

## Cài đặt và chạy

### Yêu cầu

- Python 3.9+
- MongoDB
- ChromaDB
- Gemini API key

### Bước 1: Clone repository

```bash
git clone https://github.com/yourusername/ncc-chatbot.git
cd ncc-chatbot
```

### Bước 2: Cài đặt dependencies

```bash
pip install -r backend/requirements.txt
```

### Bước 3: Thiết lập môi trường

Tạo file `.env` trong thư mục `backend`:

```
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=ncc_chatbot
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION=law_data
GEMINI_API_KEY=your_gemini_api_key
```

### Bước 4: Tải dữ liệu

```bash
cd backend
python scripts/load_documents.py
```

### Bước 5: Chạy API

```bash
cd backend
python main.py
```

API sẽ chạy tại `http://localhost:8001`

## Cấu trúc thư mục

```
ncc-chatbot/
│
├── data/                           # Thư mục chứa dữ liệu văn bản
│   ├── 49_2012_QĐ_UBND/            # Thư mục cho mỗi văn bản
│   │   ├── chunk_1.md              # Nội dung chunk
│   │   ├── chunk_2.md
│   │   └── metadata.json           # Metadata của văn bản
│   ├── 63_2010_NĐ_CP/
│   │   ├── ...
│   │   └── metadata.json
│   └── ...
│
├── backend/                        # Phần xử lý backend
│   ├── models/                     # Định nghĩa models cho MongoDB
│   ├── database/                   # Kết nối và quản lý cơ sở dữ liệu
│   ├── services/                   # Các dịch vụ logic nghiệp vụ
│   ├── utils/                      # Công cụ tiện ích
│   ├── scripts/                    # Scripts để chạy tác vụ
│   ├── api/                        # API routes
│   ├── config.py                   # Cấu hình hệ thống
│   ├── main.py                     # Entry point của API
│   └── requirements.txt            # Các thư viện cần thiết
│
├── frontend/                       # Phần giao diện người dùng (nếu có)
│   └── ...
│
├── tests/                          # Unit tests
│   └── ...
│
├── benchmark/                      # Dữ liệu và kết quả benchmark
│   └── ...
│
└── README.md                       # File này
```

## API Endpoints

### Chat API

- `POST /chat/ask`: Gửi câu hỏi và nhận câu trả lời
- `POST /chat/retrieve`: Chỉ thực hiện truy xuất thông tin, không tạo câu trả lời
- `GET /chat/conversations/{conversation_id}`: Lấy thông tin một cuộc hội thoại
- `GET /chat/conversations`: Liệt kê các cuộc hội thoại

### Admin API

- `GET /admin/status`: Kiểm tra trạng thái hệ thống
- `POST /admin/run-benchmark`: Chạy benchmark đánh giá hiệu suất
- `GET /admin/benchmark-results`: Liệt kê kết quả benchmark
- `POST /admin/clear-cache`: Xóa toàn bộ cache
- `POST /admin/invalidate-cache/{doc_id}`: Vô hiệu hóa cache cho văn bản cụ thể
- `POST /admin/upload-document`: Tải lên văn bản mới

## Đóng góp

Chúng tôi hoan nghênh mọi đóng góp và cải tiến cho dự án. Vui lòng tạo issue hoặc pull request trên GitHub.

## Giấy phép

Dự án này được phân phối dưới giấy phép MIT. Xem thêm tại file `LICENSE`.

## Liên hệ

Để biết thêm thông tin, vui lòng liên hệ: [2151062894@e.tlu.edu.vn](mailto:2151062894@e.tlu.edu.vn)