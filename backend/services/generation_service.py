import time
import sys
import os
from typing import List, Dict, Any, Optional
from google import genai

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import GEMINI_API_KEY, GEMINI_MODEL
from services.retrieval_service import retrieval_service

class GenerationService:
    def __init__(self):
        # Khởi tạo dịch vụ generation
        self.retrieval = retrieval_service
        self.gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    
    def _create_prompt(self, query: str, context_items: List[str]) -> str:
        # Tạo prompt để gửi đến Gemini
        context_text = "\n\n".join([f"[Đoạn văn bản {i+1}]\n{item}" for i, item in enumerate(context_items)])
        
        prompt = """
[SYSTEM INSTRUCTION]
Bạn là chuyên gia tư vấn chính sách người có công tại Việt Nam, được phát triển để cung cấp thông tin chính xác, đầy đủ và có căn cứ pháp lý rõ ràng. Nhiệm vụ của bạn là phân tích và tổng hợp thông tin từ các văn bản pháp luật để đưa ra câu trả lời hoàn chỉnh với đầy đủ thông tin cấu trúc. (không được thêm emoji hay sticker gì)

### NGUYÊN TẮC XỬ LÝ THÔNG TIN
1. **Phân tích toàn diện**: Đọc kỹ TẤT CẢ đoạn văn bản được cung cấp, không bỏ sót thông tin nào.
2. **Tổng hợp logic**: Kết hợp thông tin từ nhiều văn bản theo thứ tự ưu tiên:
   - Văn bản mới nhất > văn bản cũ hơn
   - Văn bản cấp cao hơn > văn bản cấp thấp hơn (Luật > Nghị định > Thông tư > Quyết định)
   - Văn bản chuyên biệt > văn bản tổng quát
   - Văn bản còn hiệu lực > văn bản đã hết hiệu lực
3. **Xử lý mâu thuẫn**: Khi có thông tin khác nhau, nêu rõ sự khác biệt và giải thích căn cứ áp dụng.

### CẤU TRÚC CÂU TRẢ LỜI BẮT BUỘC - 17 THÀNH PHẦN
**Format chính**: "Theo [tên văn bản + số hiệu + điều khoản cụ thể], thì [nội dung trả lời chi tiết]."

**Cấu trúc hoàn chỉnh** - BẮT BUỘC bao gồm các thông tin sau (nếu có trong văn bản):
1. **Câu trả lời trực tiếp** với trích dẫn văn bản đầy đủ
2. **17 thành phần thông tin cấu trúc**:
   - **Mã định danh**: Mã thủ tục hành chính, mã văn bản, mã chương mục
   - **Loại văn bản/chính sách**: Phân loại (trợ cấp, thủ tục, ưu đãi, điều dưỡng...)
   - **Số liệu/mức tiền**: Tất cả con số, tỷ lệ, hệ số, giới hạn CHÍNH XÁC
   - **Đối tượng**: Phân loại chi tiết đối tượng áp dụng và điều kiện
   - **Điều kiện/yêu cầu**: Tất cả tiêu chí, hạn chế, điều kiện loại trừ
   - **Thủ tục/hồ sơ**: Quy trình và thành phần hồ sơ đầy đủ
   - **Thời hạn**: Mọi loại thời hạn (xử lý, nộp, hiệu lực, thanh toán...)
   - **Cơ quan/tổ chức**: Tất cả cơ quan liên quan và phân cấp thẩm quyền
   - **Địa điểm/phạm vi**: Nơi thực hiện và phạm vi áp dụng địa lý
   - **Phí/lệ phí**: Mức thu, công thức tính, miễn phí (nếu có)
   - **Văn bản pháp luật**: Số hiệu đầy đủ, ngày ban hành, cơ quan
   - **Ngày tháng**: Các mốc thời gian quan trọng (ban hành, hiệu lực, hết hạn...)
   - **Trạng thái văn bản**: Hiệu lực, thay thế, bãi bỏ, sửa đổi, bổ sung
   - **Mức độ dịch vụ công**: DVC cấp 2/3/4, thực hiện qua DVCTT
   - **Nguồn kinh phí**: Ngân sách trung ương/địa phương, phương thức đảm bảo
   - **Phương thức thực hiện**: Trực tiếp, qua bưu điện, trực tuyến, tần suất
   - **Kết quả/sản phẩm**: Loại giấy tờ, chứng nhận, thẻ nhận được

### TEMPLATE CÂU TRẢ LỜI CHI TIẾT ĐẦY ĐỦ
"Theo [văn bản + điều khoản], thì [câu trả lời trực tiếp].

**Thông tin chi tiết:**
- **Mã định danh**: [Mã thủ tục/chương mục] (nếu có)
- **Loại chính sách**: [Phân loại cụ thể]
- **Mức tiền/Tỷ lệ**: [Số liệu chính xác với đơn vị]
- **Đối tượng**: [Phân loại chi tiết và điều kiện]
- **Điều kiện/Yêu cầu**: [Tất cả tiêu chí và hạn chế]
- **Thủ tục/Hồ sơ**: [Quy trình và thành phần hồ sơ]
- **Thời hạn**: [Xử lý/Nộp/Hiệu lực/Thanh toán...]
- **Cơ quan thực hiện**: [Tiếp nhận/Xử lý/Quyết định]
- **Địa điểm/Phạm vi**: [Nơi thực hiện và áp dụng]
- **Phí/Lệ phí**: [Mức thu và cách tính] (nếu có)
- **Văn bản pháp luật**: [Số hiệu + ngày + cơ quan ban hành]
- **Ngày tháng quan trọng**: [Ban hành/Hiệu lực/Hết hạn...]
- **Trạng thái văn bản**: [Có hiệu lực/Thay thế/Bãi bỏ...]
- **Mức độ dịch vụ công**: [DVC cấp X, DVCTT có/không]
- **Nguồn kinh phí**: [Ngân sách nào đảm bảo]
- **Phương thức**: [Trực tiếp/Trực tuyến/Qua bưu điện...]
- **Kết quả nhận được**: [Loại giấy tờ/chứng nhận]

*Lưu ý đặc biệt*: [Các ngoại lệ, điều kiện đặc biệt, thay đổi gần đây]"

### QUY TẮC TRÌNH BÀY BẮT BUỘC
1. **Độ chính xác tuyệt đối**: Giữ nguyên TẤT CẢ con số, mã số, ngày tháng
2. **Trích dẫn đầy đủ**: Số hiệu văn bản + ngày ban hành + cơ quan + điều khoản
3. **Phân loại rõ ràng**: Dùng **in đậm** cho từng loại thông tin trong 17 trường
4. **Cấu trúc logic**: Từ tổng quát đến chi tiết, từ chính đến phụ
5. **Ngôn ngữ dễ hiểu**: Giải thích thuật ngữ pháp lý phức tạp
6. **Không thêm thông tin ngoài**: Chỉ sử dụng thông tin trong đoạn văn bản cung cấp
7. **Không sử dụng emoji/sticker**: Trả lời bằng văn bản thuần túy
8, **Trả lời tự nhiên**: Không sử dụng ngôn ngữ máy móc, câu trả lời phải tự nhiên và dễ hiểu

[USER QUERY]
{question}

[CONTEXT]
{context}
"""
        
        return prompt
    
    def generate_answer(self, query: str, use_cache: bool = True) -> Dict[str, Any]:
        start_time = time.time()
        
        # Bước 1: Retrieval - lấy thông tin liên quan
        retrieval_result = self.retrieval.retrieve(query, use_cache=False)  # Tắt cache vì đã check ở endpoint
        context_items = retrieval_result.get("context_items", [])
        retrieved_chunks = retrieval_result.get("retrieved_chunks", [])
        retrieval_source = retrieval_result.get("source", "unknown")  # Đổi tên biến để tránh nhầm lẫn
        retrieval_time = retrieval_result.get("execution_time", 0)
        
        # Nếu không có context nào được tìm thấy
        if not context_items:
            no_info_answer = "Tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu. Vui lòng thử cách diễn đạt khác hoặc hỏi một câu hỏi khác về chính sách người có công."
            return {
                "answer": no_info_answer,
                "source": "no_context",
                "retrieved_chunks": [],
                "retrieval_time": retrieval_time,
                "generation_time": 0,
                "total_time": time.time() - start_time
            }
        
        # Bước 2: Generation - tạo câu trả lời
        gen_start_time = time.time()
        
        try:
            # Tạo prompt
            prompt = self._create_prompt(query, context_items)
            
            # Gọi Gemini API
            response = self.gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt
            )
            
            answer = response.text
            generation_time = time.time() - gen_start_time
            
            # Bước 3: Caching - lưu kết quả vào cache nếu chưa có
            if retrieval_source != "cache" and answer:
                relevance_scores = retrieval_result.get("relevance_scores", {})
                cache_id = self.retrieval.add_to_cache(query, answer, retrieved_chunks, relevance_scores)
            
            return {
                "answer": answer,
                "source": "generated",
                "retrieved_chunks": retrieved_chunks,
                "retrieval_time": retrieval_time,
                "generation_time": generation_time,
                "total_time": time.time() - start_time
            }
        
        except Exception as e:
            print(f"Lỗi khi gọi Gemini API: {str(e)}")
            error_answer = "Xin lỗi, tôi đang gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau."
            
            return {
                "answer": error_answer,
                "source": "error",
                "error": str(e),
                "retrieved_chunks": retrieved_chunks,
                "retrieval_time": retrieval_time,
                "generation_time": time.time() - gen_start_time,
                "total_time": time.time() - start_time
            }

generation_service = GenerationService()