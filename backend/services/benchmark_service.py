# backend/services/benchmark_service.py
import os
import json
import csv
import time
import uuid
from datetime import datetime
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from openai import OpenAI
import sys
import numpy as np
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
import re

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import GEMINI_API_KEY, BENCHMARK_DIR, BENCHMARK_RESULTS_DIR, CHROMA_HOST, CHROMA_PORT, CHROMA_COLLECTION, EMBEDDING_MODEL_NAME, USE_GPU
from services.retrieval_service import retrieval_service
from services.generation_service import generation_service
from database.chroma_client import chroma_client

# LangChain imports
try:
    from langchain_chroma import Chroma
    from langchain_huggingface import HuggingFaceEmbeddings
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain.prompts import ChatPromptTemplate
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False

# Haystack imports
try:
    from haystack import Document
    from haystack.document_stores.in_memory import InMemoryDocumentStore
    from haystack.components.retrievers import InMemoryBM25Retriever
    from haystack.components.builders import PromptBuilder
    from haystack import Pipeline
    HAYSTACK_AVAILABLE = True
except ImportError:
    HAYSTACK_AVAILABLE = False

class BenchmarkService:
    def __init__(self):
        self.embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        genai.configure(api_key=GEMINI_API_KEY)
        
        # Khởi tạo ChromaDB client cho LangChain
        self._init_langchain_client()
        
        self.prompt_template = """
[SYSTEM INSTRUCTION]
Bạn là chuyên gia tư vấn chính sách người có công tại Việt Nam, được phát triển để cung cấp thông tin chính xác, đầy đủ và có căn cứ pháp lý rõ ràng. Nhiệm vụ của bạn là phân tích và tổng hợp thông tin từ các văn bản pháp luật để đưa ra câu trả lời hoàn chỉnh.

### NGUYÊN TẮC XỬ LÝ THÔNG TIN
1. **Phân tích toàn diện**: Đọc kỹ TẤT CẢ đoạn văn bản được cung cấp, không bỏ sót thông tin nào.
2. **Tổng hợp logic**: Kết hợp thông tin từ nhiều văn bản theo thứ tự ưu tiên:
   - Văn bản mới nhất > văn bản cũ hơn
   - Văn bản cấp cao hơn > văn bản cấp thấp hơn (Luật > Nghị định > Thông tư > Quyết định)
   - Văn bản chuyên biệt > văn bản tổng quát
   - Văn bản còn hiệu lực > văn bản đã hết hiệu lực
3. **Xử lý mâu thuẫn**: Khi có thông tin khác nhau, nêu rõ sự khác biệt và giải thích căn cứ áp dụng.

### CẤU TRÚC CÂU TRẢ LỜI BẮT BUỘC
**Format chính**: "Theo [tên văn bản + số hiệu + điều khoản cụ thể], thì [nội dung trả lời chi tiết]."

**Cấu trúc hoàn chỉnh**:
1. **Câu trả lời trực tiếp** với trích dẫn văn bản
2. **Chi tiết cụ thể** (số tiền, tỷ lệ, thời hạn, điều kiện...)
3. **Thông tin bổ sung** (nếu có từ văn bản khác)
4. **Lưu ý đặc biệt** (nếu có ngoại lệ, điều kiện đặc biệt)

### HƯỚNG DẪN TRÍCH DẪN CỤ THỂ
- **Format chuẩn**: "Theo Điều X, Thông tư số Y/Z/TT-ABC ngày DD/MM/YYYY của [Cơ quan ban hành]"
- **Ví dụ**: "Theo Điều 4, Thông tư số 101/2018/TT-BTC ngày 14 tháng 11 năm 2018 của Bộ Tài chính"
- **Khi có nhiều văn bản**: Liệt kê theo thứ tự quan trọng, nêu rõ mối quan hệ giữa các văn bản

### XỬ LÝ CÁC LOẠI THÔNG TIN
1. **Số tiền/Mức chi**: Nêu chính xác số tiền, công thức tính, điều kiện áp dụng
   - VD: "mức 2.000 đồng/trang, từ trang thứ 3 trở lên thu 1.000 đồng/trang, tối đa không quá 200.000 đồng/bản"

2. **Thời hạn**: Phân biệt rõ các loại thời hạn
   - Thời gian xử lý: "trong ngày", "không quá 02 ngày"
   - Thời hạn nộp hồ sơ: "trước ngày 20 tháng 6"
   - Thời điểm có hiệu lực: "kể từ ngày 01/01/2024"

3. **Đối tượng**: Mô tả chi tiết đối tượng được áp dụng
   - Đối tượng chính: "thương binh", "bệnh binh", "người có công với cách mạng"
   - Điều kiện cụ thể: tuổi, thời gian phục vụ, nơi cư trú...

4. **Thủ tục/Hồ sơ**: Liệt kê đầy đủ
   - Thành phần hồ sơ
   - Địa điểm nộp
   - Cách thức thực hiện

5. **Cơ quan có thẩm quyền**: Nêu rõ cơ quan nào làm gì
   - Cơ quan tiếp nhận hồ sơ
   - Cơ quan xử lý
   - Cơ quan ra quyết định

### QUY TẮC TRÌNH BÀY
1. **Ngôn ngữ**: Đơn giản, dễ hiểu, tránh thuật ngữ pháp lý phức tạp
2. **Cấu trúc**: Sử dụng đoạn văn ngắn, có thể dùng danh sách đánh số khi cần
3. **Nhấn mạnh**: Dùng **in đậm** cho thông tin quan trọng (số tiền, thời hạn, điều kiện...)
4. **Độ chính xác**: Giữ nguyên con số, không làm tròn, không thay đổi format

### XỬ LÝ TÌNH HUỐNG ĐẶC BIỆT
1. **Thiếu thông tin**: "Dựa trên văn bản được cung cấp, [nội dung hiện có]. Tuy nhiên, văn bản không quy định chi tiết về [vấn đề cần thêm thông tin]."

2. **Thông tin mâu thuẫn**: "Theo [văn bản A] thì [nội dung A], nhưng [văn bản B] quy định [nội dung B]. Do [văn bản A] là [lý do ưu tiên], nên áp dụng theo [lựa chọn]."

3. **Câu hỏi ngoài phạm vi**: "Câu hỏi của bạn về [chủ đề] nằm ngoài phạm vi chính sách người có công. Tôi chuyên tư vấn về các vấn đề liên quan đến thương binh, bệnh binh, liệt sĩ và người có công với cách mạng. Bạn có thể đặt câu hỏi khác về lĩnh vực này không?"

### TEMPLATE CÂU TRẢ LỜI
"Theo [văn bản + điều khoản], thì [câu trả lời trực tiếp]. 

Cụ thể:
- **[Yếu tố 1]**: [Thông tin chi tiết]
- **[Yếu tố 2]**: [Thông tin chi tiết]
- **[Yếu tố 3]**: [Thông tin chi tiết]

[Thông tin bổ sung từ văn bản khác nếu có]

*Lưu ý*: [Các điều kiện đặc biệt, ngoại lệ nếu có]"

### YÊU CẦU CHẤT LƯỢNG
- Đảm bảo **100% dựa trên văn bản được cung cấp**
- **Không bỏ sót** thông tin quan trọng
- **Trích dẫn chính xác** số hiệu văn bản và điều khoản
- **Tổ chức logic** từ tổng quát đến chi tiết
- **Dễ hiểu** với người không chuyên

[USER QUERY]
{question}

[CONTEXT]
{context}
"""

        self.entity_extraction_prompt = """
Bạn là chuyên gia phân tích văn bản pháp luật về chính sách người có công tại Việt Nam.
Nhiệm vụ của bạn là trích xuất TOÀN BỘ thông tin có cấu trúc từ câu trả lời về chính sách để phục vụ đánh giá độ chính xác của hệ thống RAG.

NGUYÊN TẮC TRÍCH XUẤT:
- Trích xuất TẤT CẢ thông tin, không bỏ sót
- Giữ nguyên con số, ký hiệu, mã số CHÍNH XÁC
- Chuẩn hóa format nhưng không thay đổi nội dung
- Nếu có nhiều giá trị cho cùng 1 field, liệt kê tất cả

HƯỚNG DẪN TRÍCH XUẤT CHI TIẾT:

1. **MÃ ĐỊNH DANH**:
   - Mã thủ tục hành chính: "2.000815", "1.002010", "2.001895"
   - Mã văn bản: "47/2009/TTLT-BTC-BLĐTBXH", "101/2018/TT-BTC"
   - Mã chương mục: "024", "520", "527"

2. **LOẠI VĂN BẢN/CHÍNH SÁCH**:
   - Loại văn bản: "Nghị định", "Thông tư", "Quyết định", "Pháp lệnh"
   - Loại chính sách: "trợ cấp hàng tháng", "trợ cấp một lần", "điều dưỡng", "bảo hiểm y tế", "thủ tục hành chính", "chứng thực"
   - Loại thủ tục: "đăng ký", "cấp phép", "chứng nhận", "xác nhận"

3. **SỐ LIỆU/MỨC TIỀN** (Quan trọng - phải chính xác 100%):
   - Số tiền cụ thể: "5.500.000 đồng", "2.000 đồng/trang", "50.000 đồng/hồ sơ"
   - Tỷ lệ: "1,7%", "70%", "50%", "80%"
   - Hệ số/đơn giá: "5.000 đồng/km", "2.000 đồng/km", "320.000 đồng/người/lần"
   - Mức giới hạn: "tối đa 2.400.000 đồng", "không quá 200.000 đồng", "từ trang thứ 3 trở lên"
   - Số lượng: "không quá 3 người", "một năm không quá 02 lần"

4. **ĐỐI TƯỢNG** (Phân loại chi tiết):
   - Đối tượng chính: "thương binh", "bệnh binh", "liệt sĩ", "người có công với cách mạng", "thanh niên xung phong"
   - Phân cấp: "thương binh hạng 1/4", "bệnh binh loại B", "thương binh loại B bị suy giảm khả năng lao động từ 81% trở lên"
   - Thân nhân: "con liệt sĩ", "thân nhân liệt sĩ", "vợ/chồng liệt sĩ"
   - Đối tượng áp dụng TTHC: "cá nhân", "tổ chức", "doanh nghiệp", "cơ quan nhà nước"

5. **ĐIỀU KIỆN/YÊU CẦU** (Chi tiết từng loại):
   - Điều kiện tuổi: "từ 18 tuổi trở lên", "dưới 20 năm công tác"
   - Điều kiện thời gian: "có dưới 20 năm công tác trong quân đội", "thời kỳ kháng chiến chống Pháp"
   - Điều kiện địa lý: "cư trú tại địa phương", "trên địa bàn Thành phố Hồ Chí Minh"
   - Điều kiện kinh tế: "có hoàn cảnh kinh tế khó khăn"
   - Điều kiện loại trừ: "trừ những người đồng thời đang tham gia bảo hiểm xã hội bắt buộc"

6. **THỦ TỤC/HỒ SƠ**:
   - Tên thủ tục đầy đủ
   - Thành phần hồ sơ cụ thể
   - Số lượng bản sao: "bản chính", "02 bản sao"
   - Yêu cầu xác thực: "có xác nhận của UBND cấp xã"

7. **THỜI HẠN** (Tất cả các loại thời hạn):
   - Thời gian xử lý: "trong ngày", "không quá 02 ngày", "05 ngày", "115 ngày"
   - Thời điểm nộp hồ sơ: "trước ngày 20 tháng 6", "trước ngày 05 tháng 7"
   - Thời điểm hiệu lực: "có hiệu lực kể từ ngày 01 tháng 7 năm 2013", "áp dụng từ năm ngân sách 2009"
   - Thời hạn thanh toán: "trước ngày 15 hàng tháng", "chậm nhất trong phạm vi 07 ngày làm việc"
   - Niên hạn: "mỗi niên hạn 01 lần", "một năm một lần"

8. **CƠ QUAN/TỔ CHỨC** (Phân cấp rõ ràng):
   - Cấp trung ương: "Bộ Tài chính", "Bộ LĐTBXH", "Thủ tướng Chính phủ", "Kho bạc Nhà nước"
   - Cấp tỉnh: "UBND tỉnh", "Sở LĐTBXH", "Sở Tư pháp", "Kho bạc Nhà nước tỉnh"
   - Cấp huyện: "UBND huyện", "Phòng LĐTBXH", "Kho bạc Nhà nước huyện"
   - Cấp xã: "UBND xã", "UBND phường", "UBND thị trấn"
   - Tổ chức khác: "tổ chức hành nghề công chứng", "Trung tâm HCC"

9. **ĐỊA ĐIỂM/PHẠM VI**:
   - Phạm vi áp dụng: "toàn quốc", "địa phương", "trên địa bàn tỉnh Bình Thuận"
   - Địa điểm thực hiện: "tại Trung tâm HCC tỉnh", "Bộ phận Tiếp nhận và trả kết quả của UBND cấp xã"
   - Địa điểm cụ thể: "Quầy Sở Tư pháp", "Bộ phận Một cửa cấp huyện"

10. **PHÍ/LỆ PHÍ**:
    - Mức phí chính xác: "50.000 đồng/hồ sơ", "2.000 đồng/trang"
    - Công thức tính: "từ trang thứ 3 trở lên thu 1.000 đồng/trang"
    - Miễn phí: "Không thu phí", "Miễn lệ phí đối với người có công lao đặc biệt"

11. **VĂN BẢN PHÁP LUẬT** (Đầy đủ thông tin):
    - Số hiệu đầy đủ: "Nghị định số 48/2013/NĐ-CP", "Thông tư số 101/2018/TT-BTC"
    - Ngày ban hành: "ngày 14 tháng 05 năm 2013", "ngày 14 tháng 11 năm 2018"
    - Cơ quan ban hành: "của Chính phủ", "của Bộ Tài chính"
    - Văn bản liên quan: "thay thế Thông tư liên tịch số 84/2005/TTLT/BTC-BLĐTBXH"

12. **NGÀY THÁNG** (Tất cả ngày quan trọng):
    - Ngày ban hành, ký
    - Ngày có hiệu lực
    - Ngày hết hạn nộp hồ sơ
    - Các mốc thời gian lịch sử: "trước ngày 01/01/1945", "sau ngày 30 tháng 4 năm 1975"

13. **TRẠNG THÁI VĂN BẢN**:
    - "có hiệu lực", "bãi bỏ", "sửa đổi", "bổ sung", "thay thế"

14. **MỨC ĐỘ DỊCH VỤ CÔNG**:
    - "Mức độ DVC 2", "Mức độ DVC 3", "Mức độ DVC 4"
    - "Có" hoặc "Không" thực hiện qua DVCTT

15. **NGUỒN KINH PHÍ**:
    - "ngân sách trung ương", "ngân sách địa phương", "nguồn vốn sự nghiệp"
    - Phương thức đảm bảo cụ thể

16. **PHƯƠNG THỨC THỰC HIỆN**:
    - Cách thức: "trực tiếp", "qua bưu điện", "trực tuyến", "qua tổ chức dịch vụ"
    - Tần suất: "hàng tháng", "hàng quý", "một lần", "theo đợt"

17. **KẾT QUẢ/SẢN PHẨM**:
    - "Giấy chứng nhận", "Thẻ bảo hiểm y tế", "Quyết định", "Giấy xác nhận"

YÊU CẦU FORMAT OUTPUT:
- Trả về JSON với structure rõ ràng
- Mỗi field là array để chứa nhiều giá trị
- Sử dụng key tiếng Anh, value tiếng Việt nguyên gốc
- Nếu không có thông tin, để array rỗng []
- Đặc biệt chú ý: KHÔNG làm tròn số, KHÔNG thay đổi format tiền tệ

Câu trả lời cần phân tích:
{answer_text}

JSON:
{
  "ma_dinh_danh": [],
  "loai_van_ban_chinh_sach": [],
  "so_lieu_muc_tien": [],
  "doi_tuong": [],
  "dieu_kien_yeu_cau": [],
  "thu_tuc_ho_so": [],
  "thoi_han": [],
  "co_quan_to_chuc": [],
  "dia_diem_pham_vi": [],
  "phi_le_phi": [],
  "van_ban_phap_luat": [],
  "ngay_thang": [],
  "trang_thai_van_ban": [],
  "muc_do_dich_vu_cong": [],
  "nguon_kinh_phi": [],
  "phuong_thuc_thuc_hien": [],
  "ket_qua_san_pham": []
}
"""

    def _init_langchain_client(self):
        """Khởi tạo ChromaDB client cho LangChain sử dụng cùng config với hệ thống chính"""
        try:
            self.langchain_chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
            
            device = "cuda" if USE_GPU and self._check_gpu() else "cpu"
            self.langchain_embedding_function = SentenceTransformerEmbeddingFunction(
                model_name=EMBEDDING_MODEL_NAME,
                device=device
            )
            
            print(f"LangChain ChromaDB client initialized: {CHROMA_HOST}:{CHROMA_PORT}")
            
        except Exception as e:
            print(f"Lỗi khởi tạo LangChain ChromaDB client: {str(e)}")
            self.langchain_chroma_client = None
            self.langchain_embedding_function = None

    def _check_gpu(self):
        """Kiểm tra GPU availability"""
        try:
            import torch
            return torch.cuda.is_available()
        except:
            return False

    def _convert_numpy_types(self, obj):
        """Convert numpy types to Python native types for JSON serialization"""
        if isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {key: self._convert_numpy_types(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_numpy_types(item) for item in obj]
        return obj

    def extract_entities(self, answer_text):
        """Trích xuất entities từ câu trả lời sử dụng Gemini"""
        try:
            time.sleep(0.5)  # Delay để tránh quá tải API
            
            model = genai.GenerativeModel('gemini-2.0-flash')
            prompt = self.entity_extraction_prompt.format(answer_text=answer_text)
            
            response = model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Tìm JSON trong response
            json_start = result_text.find('{')
            json_end = result_text.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = result_text[json_start:json_end]
                entities = json.loads(json_str)
                
                # Chuẩn hóa entities - đảm bảo có đủ các key
                standard_entities = {
                    "MỨC_TIỀN": entities.get("MỨC_TIỀN", "").strip(),
                    "ĐỐI_TƯỢNG": entities.get("ĐỐI_TƯỢNG", "").strip(),
                    "ĐIỀU_KIỆN": entities.get("ĐIỀU_KIỆN", "").strip(),
                    "THỦ_TỤC": entities.get("THỦ_TỤC", "").strip(),
                    "THỜI_HẠN": entities.get("THỜI_HẠN", "").strip(),
                    "CƠ_QUAN": entities.get("CƠ_QUAN", "").strip(),
                    "VĂN_BẢN_PHÁP_LUẬT": entities.get("VĂN_BẢN_PHÁP_LUẬT", "").strip()
                }
                
                return standard_entities
            else:
                raise ValueError("Không tìm thấy JSON trong response")
                
        except Exception as e:
            print(f"Lỗi khi trích xuất entities: {str(e)}")
            return {
                "MỨC_TIỀN": "",
                "ĐỐI_TƯỢNG": "", 
                "ĐIỀU_KIỆN": "",
                "THỦ_TỤC": "",
                "THỜI_HẠN": "",
                "CƠ_QUAN": "",
                "VĂN_BẢN_PHÁP_LUẬT": ""
            }

    def calculate_entity_similarity(self, entities1, entities2):
        """Tính độ tương đồng giữa 2 bộ entities"""
        total_score = 0
        count = 0
        
        for key in entities1.keys():
            val1 = entities1.get(key, "").strip()
            val2 = entities2.get(key, "").strip()
            
            count += 1
            
            # Nếu cả 2 đều rỗng -> 100%
            if not val1 and not val2:
                total_score += 1.0
                continue
            
            # Nếu một bên rỗng, bên kia không -> 0%
            if (not val1 and val2) or (val1 and not val2):
                total_score += 0.0
                continue
            
            # Kiểm tra số liệu (tiền, tỷ lệ, số) - so sánh chính xác
            if self._is_numeric_content(val1) and self._is_numeric_content(val2):
                if self._normalize_numeric(val1) == self._normalize_numeric(val2):
                    total_score += 1.0
                else:
                    total_score += 0.0
            else:
                # Văn bản - dùng cosine similarity
                try:
                    embeddings = self.embedding_model.encode([val1, val2])
                    cosine_sim = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
                    total_score += float(cosine_sim)
                except:
                    total_score += 0.0
        
        return total_score / count if count > 0 else 0.0

    def _is_numeric_content(self, text):
        """Kiểm tra xem text có chứa thông tin số liệu không"""
        numeric_patterns = [
            r'\d+\.?\d*\s*(triệu|tỷ|đồng|%|phần trăm)',
            r'\d+\.\d+\.\d+',  # Format 5.500.000
            r'\d+,\d+',        # Format 5,500,000
            r'\d+%',           # 80%
            r'hệ\s*số\s*\d+',  # hệ số 2.5
            r'\d+\s*lần'       # 2 lần
        ]
        
        text_lower = text.lower()
        for pattern in numeric_patterns:
            if re.search(pattern, text_lower):
                return True
        return False

    def _normalize_numeric(self, text):
        """Chuẩn hóa text chứa số liệu để so sánh"""
        # Loại bỏ khoảng trắng, chuyển thường
        normalized = re.sub(r'\s+', '', text.lower())
        
        # Chuẩn hóa format số
        normalized = re.sub(r'\.(?=\d{3})', '', normalized)  # 5.500.000 -> 5500000
        normalized = re.sub(r',(?=\d{3})', '', normalized)   # 5,500,000 -> 5500000
        
        return normalized

    def calculate_cosine_similarity(self, generated_answer, reference_answer):
        """Tính cosine similarity giữa câu trả lời generated và reference"""
        if isinstance(reference_answer, dict):
            if "current_citation" in reference_answer and reference_answer["current_citation"]:
                ref_text = reference_answer["current_citation"]
            else:
                parts = []
                for key, value in reference_answer.items():
                    if value and isinstance(value, str):
                        parts.append(f"{key}: {value}")
                ref_text = " ".join(parts)
        else:
            ref_text = str(reference_answer)
        
        gen_text = str(generated_answer)
        
        try:
            embeddings = self.embedding_model.encode([gen_text, ref_text])
            cosine_sim = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
            return float(cosine_sim), ref_text
        except Exception as e:
            print(f"Error calculating cosine similarity: {str(e)}")
            return 0.0, ref_text

    def evaluate_retrieval_accuracy(self, retrieved_chunks, benchmark_chunks):
        """Đánh giá độ chính xác của retrieval"""
        if not benchmark_chunks:
            return 1.0, []
        
        clean_retrieved = []
        for chunk in retrieved_chunks:
            if '(' in chunk and 'doc:' in chunk:
                chunk_id = chunk.split(' (doc:')[0].strip()
                clean_retrieved.append(chunk_id)
            elif chunk:
                clean_retrieved.append(chunk.strip())
        
        found = 0
        found_chunks = []
        
        for benchmark_chunk in benchmark_chunks:
            chunk_found = False
            for retrieved_chunk in clean_retrieved:
                if (benchmark_chunk == retrieved_chunk or 
                    benchmark_chunk in retrieved_chunk or 
                    retrieved_chunk in benchmark_chunk):
                    chunk_found = True
                    break
            
            if chunk_found:
                found += 1
                found_chunks.append(benchmark_chunk)
        
        accuracy = found / len(benchmark_chunks)
        return float(accuracy), found_chunks

    def process_current_system(self, question):
        """Xử lý câu hỏi bằng hệ thống hiện tại"""
        start_time = time.time()
        try:
            retrieval_result = retrieval_service.retrieve(question, use_cache=False)
            context_items = retrieval_result.get("context_items", [])
            retrieved_chunks = retrieval_result.get("retrieved_chunks", [])
            
            time.sleep(0.5)  # Delay giữa retrieval và generation
            
            if context_items:
                generation_result = generation_service.generate_answer(question, use_cache=False)
                answer = generation_result.get("answer", "")
            else:
                answer = "Tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu."
            
            processing_time = time.time() - start_time
            return answer, retrieved_chunks, processing_time
        except Exception as e:
            processing_time = time.time() - start_time
            print(f"Error in process_current_system: {str(e)}")
            return f"ERROR: {str(e)}", [], processing_time

    def process_langchain(self, question):
        """Xử lý câu hỏi bằng LangChain với ChromaDB Docker"""
        start_time = time.time()
        
        if not LANGCHAIN_AVAILABLE:
            return "LangChain not available", [], time.time() - start_time
        
        if not self.langchain_chroma_client:
            return "LangChain ChromaDB client not initialized", [], time.time() - start_time
        
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain.prompts import ChatPromptTemplate
            from langchain_chroma import Chroma
            from langchain_huggingface import HuggingFaceEmbeddings
            
            embedding_function = HuggingFaceEmbeddings(
                model_name=EMBEDDING_MODEL_NAME,
                model_kwargs={'device': 'cuda' if USE_GPU and self._check_gpu() else 'cpu'}
            )
            
            db = Chroma(
                client=self.langchain_chroma_client,
                collection_name=CHROMA_COLLECTION,
                embedding_function=embedding_function
            )
            
            results = db.similarity_search_with_relevance_scores(question, k=5)
            
            time.sleep(0.5)  # Delay giữa retrieval và generation
            
            if len(results) == 0 or results[0][1] < 0.7:
                processing_time = time.time() - start_time
                return "No relevant documents found", [], processing_time
            
            context_text = "\n\n---\n\n".join([doc.page_content for doc, _ in results])
            prompt_template = ChatPromptTemplate.from_template(self.prompt_template)
            prompt = prompt_template.format(context=context_text, question=question)
            
            model = ChatGoogleGenerativeAI(model="gemini-2.0-flash", api_key=GEMINI_API_KEY)
            response = model.invoke(prompt)
            answer = str(response.content)
            
            retrieved_chunks = []
            for i, (doc, score) in enumerate(results):
                chunk_id = doc.metadata.get('chunk_id', f'unknown_chunk_{i}')
                doc_id = doc.metadata.get('doc_id', 'unknown_doc')
                doc_type = doc.metadata.get('doc_type', '')
                chunk_info = f"{chunk_id} (doc: {doc_id}, type: {doc_type}, score: {float(score):.3f})"
                retrieved_chunks.append(chunk_info)
            
            processing_time = time.time() - start_time
            return answer, retrieved_chunks, processing_time
            
        except Exception as e:
            processing_time = time.time() - start_time
            print(f"Error in process_langchain: {str(e)}")
            return f"ERROR: {str(e)}", [], processing_time

    def process_haystack(self, question):
        """Xử lý câu hỏi bằng Haystack"""
        start_time = time.time()
        
        if not HAYSTACK_AVAILABLE:
            return "Haystack not available", [], time.time() - start_time
        
        try:
            from haystack import Document
            from haystack.document_stores.in_memory import InMemoryDocumentStore
            from haystack.components.retrievers import InMemoryBM25Retriever
            
            # Load documents từ data directory
            data_dir = "data"
            all_docs = []
            
            if os.path.exists(data_dir):
                subdirs = [os.path.join(data_dir, d) for d in os.listdir(data_dir) 
                          if os.path.isdir(os.path.join(data_dir, d))]
                
                for subdir in subdirs:
                    metadata_path = os.path.join(subdir, "metadata.json")
                    doc_id = os.path.basename(subdir)
                    
                    if os.path.exists(metadata_path):
                        with open(metadata_path, "r", encoding="utf-8-sig") as f:
                            metadata = json.load(f)
                        
                        if "chunks" in metadata:
                            for chunk in metadata["chunks"]:
                                chunk_id = chunk.get("chunk_id", "unknown")
                                file_path = chunk.get("file_path", "")
                                
                                # Tìm file chunk
                                if file_path.startswith("/data/") or file_path.startswith("data/"):
                                    filename = os.path.basename(file_path)
                                    abs_file_path = os.path.join(subdir, filename)
                                else:
                                    # Fallback: tìm file chunk_*.md
                                    for i in range(1, 11):
                                        test_path = os.path.join(subdir, f"chunk_{i}.md")
                                        if os.path.exists(test_path):
                                            abs_file_path = test_path
                                            break
                                    else:
                                        continue
                                
                                if os.path.exists(abs_file_path):
                                    with open(abs_file_path, "r", encoding="utf-8-sig") as f:
                                        content = f.read()
                                    doc = Document(content=content, meta={"doc_id": doc_id, "chunk_id": chunk_id})
                                    all_docs.append(doc)
            
            if not all_docs:
                processing_time = time.time() - start_time
                return "No documents found for Haystack", [], processing_time
            
            # Khởi tạo document store và retriever
            document_store = InMemoryDocumentStore()
            document_store.write_documents(all_docs)
            retriever = InMemoryBM25Retriever(document_store, top_k=5)
            
            # Retrieve documents
            retrieved_docs = retriever.run(query=question)
            
            time.sleep(0.5)  # Delay giữa retrieval và generation
            
            chunk_ids = []
            context_parts = []
            for doc in retrieved_docs["documents"]:
                doc_id = doc.meta.get("doc_id", "unknown")
                chunk_id = doc.meta.get("chunk_id", "unknown")
                chunk_ids.append(f"{chunk_id} (doc: {doc_id}, type: BM25)")
                context_parts.append(doc.content)
            
            # Generate answer
            context_text = "\n\n---\n\n".join(context_parts)
            prompt = self.prompt_template.format(context=context_text, question=question)
            
            model = genai.GenerativeModel('gemini-2.0-flash')
            response = model.generate_content(prompt)
            answer = response.text
            
            processing_time = time.time() - start_time
            return answer, chunk_ids, processing_time
            
        except Exception as e:
            processing_time = time.time() - start_time
            print(f"Error in process_haystack: {str(e)}")
            return f"ERROR: {str(e)}", [], processing_time

    def process_chatgpt(self, question):
        """Xử lý câu hỏi bằng ChatGPT"""
        start_time = time.time()
        
        try:
            # Sử dụng retrieval từ hệ thống chính để lấy context
            retrieval_result = retrieval_service.retrieve(question, use_cache=False)
            context_items = retrieval_result.get("context_items", [])
            
            time.sleep(0.5)  # Delay giữa retrieval và generation
            
            if not context_items:
                processing_time = time.time() - start_time
                return "No relevant context found", [], processing_time
            
            context_text = "\n\n---\n\n".join(context_items)
            prompt = self.prompt_template.format(context=context_text, question=question)
            
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if not openai_api_key:
                processing_time = time.time() - start_time
                return "OpenAI API key not configured", [], processing_time
            
            client = OpenAI(api_key=openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.1
            )
            
            answer = response.choices[0].message.content
            processing_time = time.time() - start_time
            return answer, [], processing_time
            
        except Exception as e:
            processing_time = time.time() - start_time
            print(f"Error in process_chatgpt: {str(e)}")
            return f"ERROR: {str(e)}", [], processing_time

    def save_uploaded_benchmark(self, file_content, filename):
        """Save uploaded benchmark file"""
        try:
            os.makedirs(BENCHMARK_DIR, exist_ok=True)
            file_path = os.path.join(BENCHMARK_DIR, filename)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(file_content)
            return filename
        except Exception as e:
            raise Exception(f"Failed to save benchmark file: {str(e)}")

    def run_benchmark(self, benchmark_file="benchmark.json", progress_callback=None):
        """Chạy benchmark so sánh 4 models với entity extraction và tracking chi tiết"""
        try:
            benchmark_path = os.path.join(BENCHMARK_DIR, benchmark_file)
            if not os.path.exists(benchmark_path):
                raise FileNotFoundError(f"Benchmark file not found: {benchmark_path}")
            
            with open(benchmark_path, "r", encoding="utf-8-sig") as f:
                benchmark_data = json.load(f).get("benchmark", [])
            
            if not benchmark_data:
                raise ValueError("No benchmark questions found")
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"benchmark_4models_{timestamp}.csv"
            output_path = os.path.join(BENCHMARK_RESULTS_DIR, output_file)
            
            os.makedirs(BENCHMARK_RESULTS_DIR, exist_ok=True)
            
            results = []
            total_questions = len(benchmark_data)
            total_times = {'current': [], 'langchain': [], 'haystack': [], 'chatgpt': []}
            
            # Bước 1: Trích xuất entities từ benchmark answers
            print("Bước 1: Đang trích xuất entities từ benchmark answers...")
            benchmark_entities = []
            for i, entry in enumerate(benchmark_data):
                expected = entry.get("ground_truth", entry.get("answer", ""))
                
                if progress_callback:
                    progress_callback({
                        'phase': 'extracting_benchmark_entities',
                        'current_step': i + 1,
                        'total_steps': total_questions,
                        'progress': (i + 1) / total_questions * 10  # 10% cho việc extract benchmark
                    })
                
                if isinstance(expected, dict):
                    benchmark_text = expected.get("current_citation", str(expected))
                else:
                    benchmark_text = str(expected)
                
                entities = self.extract_entities(benchmark_text)
                benchmark_entities.append(entities)
                
                time.sleep(0.3)  # Delay ngắn hơn cho extraction
            
            # Bước 2: Chạy benchmark cho 4 models
            print("Bước 2: Đang chạy benchmark cho 4 models...")
            
            with open(output_path, "w", encoding="utf-8-sig", newline="") as csvfile:
                writer = csv.writer(csvfile)
                
                # Header với thêm cột entity similarity
                writer.writerow([
                    "STT", "question", "benchmark_answer", 
                    "current_answer", "current_cosine_sim", "current_entity_sim", "current_retrieval_accuracy", "current_processing_time",
                    "langchain_answer", "langchain_cosine_sim", "langchain_entity_sim", "langchain_retrieval_accuracy", "langchain_processing_time",
                    "haystack_answer", "haystack_cosine_sim", "haystack_entity_sim", "haystack_retrieval_accuracy", "haystack_processing_time",
                    "chatgpt_answer", "chatgpt_cosine_sim", "chatgpt_entity_sim", "chatgpt_processing_time",
                    "benchmark_chunks"
                ])
                
                for i, entry in enumerate(benchmark_data, start=1):
                    question = entry["question"]
                    expected = entry.get("ground_truth", entry.get("answer", ""))
                    benchmark_chunks = entry.get("contexts", [])
                    benchmark_entity = benchmark_entities[i-1]
                    
                    if progress_callback:
                        progress_callback({
                            'phase': 'processing_models',
                            'current_step': i,
                            'total_steps': total_questions,
                            'progress': 10 + (i / total_questions * 85)  # 10% đã xong, 85% cho models
                        })
                    
                    print(f"Processing question {i}/{total_questions}: {question[:50]}...")
                    
                    # Process với Current System
                    if progress_callback:
                        progress_callback({
                            'phase': 'current_system',
                            'current_step': i,
                            'total_steps': total_questions,
                            'progress': 10 + (i-1) / total_questions * 85 + 85/total_questions * 0.1
                        })
                    
                    current_answer, current_chunks, current_time = self.process_current_system(question)
                    current_cosine_sim, benchmark_text = self.calculate_cosine_similarity(current_answer, expected)
                    current_retrieval_acc, _ = self.evaluate_retrieval_accuracy(current_chunks, benchmark_chunks)
                    total_times['current'].append(current_time)
                    
                    # Extract entities và tính entity similarity cho Current
                    current_entities = self.extract_entities(current_answer)
                    current_entity_sim = self.calculate_entity_similarity(benchmark_entity, current_entities)
                    
                    # Process với LangChain
                    if progress_callback:
                        progress_callback({
                            'phase': 'langchain',
                            'current_step': i,
                            'total_steps': total_questions,
                            'progress': 10 + (i-1) / total_questions * 85 + 85/total_questions * 0.3
                        })
                    
                    langchain_answer, langchain_chunks, langchain_time = self.process_langchain(question)
                    langchain_cosine_sim, _ = self.calculate_cosine_similarity(langchain_answer, expected)
                    langchain_retrieval_acc, _ = self.evaluate_retrieval_accuracy(langchain_chunks, benchmark_chunks)
                    total_times['langchain'].append(langchain_time)
                    
                    # Extract entities và tính entity similarity cho LangChain
                    langchain_entities = self.extract_entities(langchain_answer)
                    langchain_entity_sim = self.calculate_entity_similarity(benchmark_entity, langchain_entities)
                    
                    # Process với Haystack
                    if progress_callback:
                        progress_callback({
                            'phase': 'haystack',
                            'current_step': i,
                            'total_steps': total_questions,
                            'progress': 10 + (i-1) / total_questions * 85 + 85/total_questions * 0.6
                        })
                    
                    haystack_answer, haystack_chunks, haystack_time = self.process_haystack(question)
                    haystack_cosine_sim, _ = self.calculate_cosine_similarity(haystack_answer, expected)
                    haystack_retrieval_acc, _ = self.evaluate_retrieval_accuracy(haystack_chunks, benchmark_chunks)
                    total_times['haystack'].append(haystack_time)
                    
                    # Extract entities và tính entity similarity cho Haystack
                    haystack_entities = self.extract_entities(haystack_answer)
                    haystack_entity_sim = self.calculate_entity_similarity(benchmark_entity, haystack_entities)
                    
                    # Process với ChatGPT
                    if progress_callback:
                        progress_callback({
                            'phase': 'chatgpt',
                            'current_step': i,
                            'total_steps': total_questions,
                            'progress': 10 + (i-1) / total_questions * 85 + 85/total_questions * 0.9
                        })
                    
                    chatgpt_answer, _, chatgpt_time = self.process_chatgpt(question)
                    chatgpt_cosine_sim, _ = self.calculate_cosine_similarity(chatgpt_answer, expected)
                    total_times['chatgpt'].append(chatgpt_time)
                    
                    # Extract entities và tính entity similarity cho ChatGPT
                    chatgpt_entities = self.extract_entities(chatgpt_answer)
                    chatgpt_entity_sim = self.calculate_entity_similarity(benchmark_entity, chatgpt_entities)
                    
                    # Ghi kết quả với entity similarity
                    writer.writerow([
                        i, question, benchmark_text,
                        current_answer, f"{current_cosine_sim:.4f}", f"{current_entity_sim:.4f}", f"{current_retrieval_acc:.4f}", f"{current_time:.3f}",
                        langchain_answer, f"{langchain_cosine_sim:.4f}", f"{langchain_entity_sim:.4f}", f"{langchain_retrieval_acc:.4f}", f"{langchain_time:.3f}",
                        haystack_answer, f"{haystack_cosine_sim:.4f}", f"{haystack_entity_sim:.4f}", f"{haystack_retrieval_acc:.4f}", f"{haystack_time:.3f}",
                        chatgpt_answer, f"{chatgpt_cosine_sim:.4f}", f"{chatgpt_entity_sim:.4f}", f"{chatgpt_time:.3f}",
                        " | ".join(benchmark_chunks)
                    ])
                    
                    results.append({
                        'current_cosine_sim': current_cosine_sim,
                        'current_entity_sim': current_entity_sim,
                        'current_retrieval_acc': current_retrieval_acc,
                        'current_time': current_time,
                        'langchain_cosine_sim': langchain_cosine_sim,
                        'langchain_entity_sim': langchain_entity_sim,
                        'langchain_retrieval_acc': langchain_retrieval_acc,
                        'langchain_time': langchain_time,
                        'haystack_cosine_sim': haystack_cosine_sim,
                        'haystack_entity_sim': haystack_entity_sim,
                        'haystack_retrieval_acc': haystack_retrieval_acc,
                        'haystack_time': haystack_time,
                        'chatgpt_cosine_sim': chatgpt_cosine_sim,
                        'chatgpt_entity_sim': chatgpt_entity_sim,
                        'chatgpt_time': chatgpt_time
                    })
                    
                    # Delay ngắn giữa các câu hỏi
                    time.sleep(1)
                
                # Bước 3: Tính toán thống kê cuối cùng
                if progress_callback:
                    progress_callback({
                        'phase': 'finalizing',
                        'current_step': total_questions,
                        'total_steps': total_questions,
                        'progress': 95
                    })
                
                # Tính statistics đầy đủ
                avg_current_time = sum(total_times['current']) / len(total_times['current'])
                avg_langchain_time = sum(total_times['langchain']) / len(total_times['langchain'])
                avg_haystack_time = sum(total_times['haystack']) / len(total_times['haystack'])
                avg_chatgpt_time = sum(total_times['chatgpt']) / len(total_times['chatgpt'])
                
                # Thêm dòng SUMMARY với entity similarity
                writer.writerow([
                    "SUMMARY", 
                    f"Average results from {total_questions} questions",
                    "Statistical Summary",
                    "See individual results above",
                    f"{sum(r['current_cosine_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['current_entity_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['current_retrieval_acc'] for r in results) / len(results):.4f}",
                    f"{avg_current_time:.3f}",
                    "See individual results above",
                    f"{sum(r['langchain_cosine_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['langchain_entity_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['langchain_retrieval_acc'] for r in results) / len(results):.4f}",
                    f"{avg_langchain_time:.3f}",
                    "See individual results above",
                    f"{sum(r['haystack_cosine_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['haystack_entity_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['haystack_retrieval_acc'] for r in results) / len(results):.4f}",
                    f"{avg_haystack_time:.3f}",
                    "See individual results above",
                    f"{sum(r['chatgpt_cosine_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['chatgpt_entity_sim'] for r in results) / len(results):.4f}",
                    f"{avg_chatgpt_time:.3f}",
                    "All benchmark chunks across questions"
                ])
            
            # Tính toán statistics trả về với entity similarity
            stats = {
                'current_avg_cosine': float(sum(r['current_cosine_sim'] for r in results) / len(results)),
                'current_avg_entity': float(sum(r['current_entity_sim'] for r in results) / len(results)),
                'current_avg_retrieval': float(sum(r['current_retrieval_acc'] for r in results) / len(results)),
                'current_avg_time': float(avg_current_time),
                'langchain_avg_cosine': float(sum(r['langchain_cosine_sim'] for r in results) / len(results)),
                'langchain_avg_entity': float(sum(r['langchain_entity_sim'] for r in results) / len(results)),
                'langchain_avg_retrieval': float(sum(r['langchain_retrieval_acc'] for r in results) / len(results)),
                'langchain_avg_time': float(avg_langchain_time),
                'haystack_avg_cosine': float(sum(r['haystack_cosine_sim'] for r in results) / len(results)),
                'haystack_avg_entity': float(sum(r['haystack_entity_sim'] for r in results) / len(results)),
                'haystack_avg_retrieval': float(sum(r['haystack_retrieval_acc'] for r in results) / len(results)),
                'haystack_avg_time': float(avg_haystack_time),
                'chatgpt_avg_cosine': float(sum(r['chatgpt_cosine_sim'] for r in results) / len(results)),
                'chatgpt_avg_entity': float(sum(r['chatgpt_entity_sim'] for r in results) / len(results)),
                'chatgpt_avg_time': float(avg_chatgpt_time),
                'total_questions': int(total_questions),
                'output_file': output_file
            }
            
            # Convert numpy types
            stats = self._convert_numpy_types(stats)
            
            if progress_callback:
                progress_callback({
                    'phase': 'completed',
                    'current_step': total_questions,
                    'total_steps': total_questions,
                    'progress': 100
                })
            
            return stats
            
        except Exception as e:
            raise Exception(f"Benchmark failed: {str(e)}")

# Singleton instance
benchmark_service = BenchmarkService()