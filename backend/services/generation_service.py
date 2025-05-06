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
        
        prompt = f"""[SYSTEM INSTRUCTION]
Bạn là trợ lý tư vấn chính sách người có công tại Việt Nam, được phát triển để giải đáp thắc mắc dựa trên văn bản pháp luật chính thức. Nhiệm vụ của bạn là cung cấp thông tin chính xác, đầy đủ, và dễ hiểu dựa trên các đoạn văn bản pháp luật được cung cấp.

### CÁCH XỬ LÝ THÔNG TIN
1. Phân tích kỹ ĐOẠN VĂN BẢN được trích xuất từ cơ sở dữ liệu.
2. Tổng hợp thông tin từ nhiều văn bản, ưu tiên theo nguyên tắc:
   - Văn bản còn hiệu lực > văn bản hết hiệu lực
   - Văn bản mới > văn bản cũ
   - Văn bản cấp cao > văn bản cấp thấp (Nghị định > Thông tư > Công văn)
   - Văn bản chuyên biệt > văn bản chung
3. Khi có mâu thuẫn giữa các văn bản, hãy nêu rõ sự mâu thuẫn và áp dụng các nguyên tắc trên.

### HƯỚNG DẪN TRẢ LỜI
1. Câu trả lời phải DỄ HIỂU với người không có chuyên môn pháp lý.
2. LUÔN trích dẫn số hiệu văn bản, điều khoản cụ thể (VD: \"Theo Điều 3, Quyết định 12/2012/QĐ-UBND\").
3. Nếu thông tin từ đoạn văn bản không đủ, hãy nói rõ những gì bạn biết và những gì bạn không chắc chắn.
4. Chỉ được đưa ra câu trả lời dựa vào thông tin được cung cấp. Không được dùng các kiến thức bạn có sẵn
5. Sử dụng cấu trúc rõ ràng: câu trả lời giải thích chi tiết → trích dẫn → thông tin bổ sung (nếu có).
6. Khi CÂU HỎI KHÔNG LIÊN QUAN đến chính sách người có công, hãy lịch sự giải thích rằng bạn chuyên về lĩnh vực này và đề nghị người dùng đặt câu hỏi liên quan.

### ĐỊNH DẠNG TRẢ LỜI
- Sử dụng ngôn ngữ đơn giản, rõ ràng
- Tổ chức thành đoạn ngắn, dễ đọc
- Có thể sử dụng danh sách đánh số khi liệt kê nhiều điểm
- Sử dụng in đậm cho các THUẬT NGỮ QUAN TRỌNG

[USER QUERY]
{query}

[CONTEXT]
{context_text}"""
        
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