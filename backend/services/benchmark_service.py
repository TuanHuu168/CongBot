import os
import json
import csv
import time
import uuid
import numpy as np
from datetime import datetime
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from openai import OpenAI
import sys
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
import re
from typing import Dict, List, Tuple, Set
from difflib import SequenceMatcher

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import GEMINI_API_KEY, BENCHMARK_DIR, BENCHMARK_RESULTS_DIR, CHROMA_HOST, CHROMA_PORT, CHROMA_COLLECTION, EMBEDDING_MODEL_NAME, USE_GPU
from services.retrieval_service import retrieval_service
from services.generation_service import generation_service
from database.chroma_client import chroma_client

try:
    from langchain_chroma import Chroma
    from langchain_huggingface import HuggingFaceEmbeddings
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain.prompts import ChatPromptTemplate
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False

try:
    from haystack import Document
    from haystack.document_stores.in_memory import InMemoryDocumentStore
    from haystack.components.retrievers import InMemoryBM25Retriever
    from haystack.components.builders import PromptBuilder
    from haystack import Pipeline
    HAYSTACK_AVAILABLE = True
except ImportError:
    HAYSTACK_AVAILABLE = False

class LegalEntityEvaluator:
    def __init__(self, gemini_api_key: str, embedding_model_name: str = "intfloat/multilingual-e5-base"):
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash')
        self.embedding_model = SentenceTransformer(embedding_model_name)
        
        self.critical_entities = {
            'monetary_values', 'time_periods', 'percentages', 
            'legal_documents', 'article_numbers'
        }
        
    def extract_entities_prompt(self, answer_text: str) -> str:
        prompt = f"""
Bạn là chuyên gia pháp luật Việt Nam. Hãy trích xuất TẤT CẢ thông tin quan trọng từ câu trả lời về chính sách người có công sau đây.

**QUAN TRỌNG**: 
- Giữ NGUYÊN HOÀN TOÀN format số, đơn vị, ký hiệu như trong văn bản gốc
- KHÔNG làm tròn, thay đổi hoặc diễn giải số liệu
- Trích xuất CHÍNH XÁC tên văn bản, điều, khoản, mục

**Câu trả lời cần phân tích:**
{answer_text}

**Trích xuất theo các nhóm sau:**

1. **MONETARY_VALUES** (Số tiền, mức trợ cấp):
   - Bao gồm: số tiền cụ thể, phần trăm lương, hệ số
   - Ví dụ: "5.335.000 đồng", "80% mức lương cơ sở", "2,5 lần"

2. **PERCENTAGES** (Tỷ lệ phần trăm):
   - Tỷ lệ thương tật, phần trăm giảm trừ, tỷ lệ hưởng
   - Ví dụ: "81%", "100%", "50% mức trợ cấp"

3. **TIME_PERIODS** (Thời gian):
   - Ngày hiệu lực, thời hạn, khoảng thời gian
   - Ví dụ: "từ ngày 05/09/2023", "trong vòng 30 ngày", "trước 15/12"

4. **LEGAL_DOCUMENTS** (Văn bản pháp lý):
   - Tên chính xác của luật, nghị định, thông tư, quyết định
   - Ví dụ: "Nghị định 55/2023/NĐ-CP", "Luật Người có công 2023"

5. **ARTICLE_NUMBERS** (Điều, khoản, mục):
   - Số điều, khoản, mục, phụ lục
   - Ví dụ: "Điều 15", "khoản 3", "Phụ lục I"

6. **TARGET_GROUPS** (Đối tượng):
   - Nhóm người được hưởng chính sách
   - Ví dụ: "thương binh hạng 1/4", "con của liệt sĩ"

7. **CONDITIONS** (Điều kiện):
   - Yêu cầu, tiêu chí để được hưởng
   - Ví dụ: "có giấy chứng nhận thương binh", "cư trú tại Việt Nam"

8. **PROCEDURES** (Thủ tục):
   - Các bước, quy trình thực hiện
   - Ví dụ: "nộp hồ sơ tại UBND xã", "chờ thông báo kết quả"

9. **ORGANIZATIONS** (Cơ quan):
   - Đơn vị, tổ chức có thẩm quyền
   - Ví dụ: "Bộ Lao động - Thương binh và Xã hội", "UBND tỉnh"

10. **LOCATIONS** (Địa điểm):
    - Nơi thực hiện, phạm vi áp dụng
    - Ví dụ: "toàn quốc", "tại nơi cư trú"

**Format đầu ra (JSON nghiêm ngặt):**
{{
    "monetary_values": [],
    "percentages": [],
    "time_periods": [],
    "legal_documents": [],
    "article_numbers": [],
    "target_groups": [],
    "conditions": [],
    "procedures": [],
    "organizations": [],
    "locations": []
}}

**LƯU Ý QUAN TRỌNG:**
- CHỈ trích xuất thông tin CÓ SẴN trong câu trả lời
- KHÔNG thêm thông tin từ kiến thức ngoài
- Giữ nguyên 100% format gốc của số liệu
- Nếu không có thông tin cho nhóm nào, để mảng rỗng []
- Mỗi thông tin chỉ xuất hiện một lần
"""
        return prompt

    def normalize_monetary_value(self, value: str) -> str:
        normalized = re.sub(r'\s+', ' ', value.strip())
        return normalized

    def extract_numeric_value(self, text: str) -> float:
        money_pattern = r'(\d{1,3}(?:\.\d{3})*)'
        matches = re.findall(money_pattern, text)
        if matches:
            num_str = matches[0].replace('.', '')
            try:
                return float(num_str)
            except:
                return 0.0
        return 0.0

    def exact_match_score(self, list1: List[str], list2: List[str], entity_type: str) -> Dict:
        if not list1 and not list2:
            return {"exact_match": 1.0, "partial_match": 1.0, "details": "Both empty"}
        
        if not list1 or not list2:
            return {"exact_match": 0.0, "partial_match": 0.0, "details": "One empty"}
        
        normalized_list1 = [item.strip().lower() for item in list1]
        normalized_list2 = [item.strip().lower() for item in list2]
        
        exact_matches = 0
        partial_matches = 0
        match_details = []
        
        for item1 in normalized_list1:
            best_match_score = 0
            best_match_item = ""
            
            for item2 in normalized_list2:
                if entity_type in self.critical_entities:
                    if entity_type == 'monetary_values':
                        num1 = self.extract_numeric_value(item1)
                        num2 = self.extract_numeric_value(item2)
                        
                        if num1 == num2 and num1 > 0:
                            similarity = 1.0
                        else:
                            similarity = 0.0
                    else:
                        similarity = 1.0 if item1 == item2 else SequenceMatcher(None, item1, item2).ratio()
                        if similarity < 0.9:
                            similarity = 0.0
                else:
                    similarity = SequenceMatcher(None, item1, item2).ratio()
                
                if similarity > best_match_score:
                    best_match_score = similarity
                    best_match_item = item2
            
            if best_match_score == 1.0:
                exact_matches += 1
                match_details.append(f"EXACT: '{item1}' ↔ '{best_match_item}' ({best_match_score:.3f})")
            elif best_match_score > 0.0:
                partial_matches += 1
                match_details.append(f"PARTIAL: '{item1}' ↔ '{best_match_item}' ({best_match_score:.3f})")
            else:
                match_details.append(f"NO_MATCH: '{item1}' (best: {best_match_score:.3f})")
        
        total_items = max(len(list1), len(list2))
        exact_score = exact_matches / total_items if total_items > 0 else 0.0
        partial_score = (exact_matches + partial_matches) / total_items if total_items > 0 else 0.0
        
        return {
            "exact_match": exact_score,
            "partial_match": partial_score,
            "details": match_details,
            "stats": {
                "exact_matches": exact_matches,
                "partial_matches": partial_matches,
                "total_items": total_items,
                "is_critical": entity_type in self.critical_entities
            }
        }

    def extract_entities(self, answer_text: str) -> Dict:
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                prompt = self.extract_entities_prompt(answer_text)
                response = self.model.generate_content(prompt)
                
                response_text = response.text.strip()
                
                start_idx = response_text.find('{')
                end_idx = response_text.rfind('}') + 1
                
                if start_idx != -1 and end_idx != 0:
                    json_str = response_text[start_idx:end_idx]
                    entities = json.loads(json_str)
                    
                    required_keys = [
                        'monetary_values', 'percentages', 'time_periods', 
                        'legal_documents', 'article_numbers', 'target_groups',
                        'conditions', 'procedures', 'organizations', 'locations'
                    ]
                    
                    for key in required_keys:
                        if key not in entities:
                            entities[key] = []
                    
                    return entities
                    
            except json.JSONDecodeError as e:
                print(f"JSON decode error (attempt {attempt + 1}): {e}")
            except Exception as e:
                print(f"Extraction error (attempt {attempt + 1}): {e}")
        
        return self._empty_entities()
    
    def _empty_entities(self) -> Dict:
        return {
            "monetary_values": [],
            "percentages": [],
            "time_periods": [],
            "legal_documents": [],
            "article_numbers": [],
            "target_groups": [],
            "conditions": [],
            "procedures": [],
            "organizations": [],
            "locations": []
        }
    
    def calculate_entity_similarity_score(self, entities1: Dict, entities2: Dict) -> float:
        weights = {
            'monetary_values': 0.30,
            'percentages': 0.20,
            'legal_documents': 0.15,
            'time_periods': 0.10,
            'article_numbers': 0.10,
            'target_groups': 0.05,
            'conditions': 0.04,
            'procedures': 0.03,
            'organizations': 0.02,
            'locations': 0.01
        }
        
        weighted_score = 0.0
        
        for category in entities1.keys():
            list1 = entities1[category]
            list2 = entities2[category]
            
            match_result = self.exact_match_score(list1, list2, category)
            category_score = match_result['exact_match']
            
            weight = weights.get(category, 0.01)
            weighted_score += category_score * weight
        
        return float(weighted_score)

class BenchmarkService:
    def __init__(self):
        self.embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        genai.configure(api_key=GEMINI_API_KEY)
        self.entity_evaluator = LegalEntityEvaluator(GEMINI_API_KEY, EMBEDDING_MODEL_NAME)
        
        self._init_langchain_client()
        
        self.prompt_template = """
[SYSTEM INSTRUCTION]
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
2. LUÔN trích dẫn số hiệu văn bản, điều khoản cụ thể (VD: "Theo Điều 3, Quyết định 12/2012/QĐ-UBND").
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
{question}

[CONTEXT]
{context}
"""

    def _init_langchain_client(self):
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
        try:
            import torch
            return torch.cuda.is_available()
        except:
            return False

    def _convert_numpy_types(self, obj):
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

    def calculate_entity_similarity(self, generated_answer, reference_answer):
        try:
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
            
            gen_entities = self.entity_evaluator.extract_entities(gen_text)
            ref_entities = self.entity_evaluator.extract_entities(ref_text)
            
            entity_similarity = self.entity_evaluator.calculate_entity_similarity_score(gen_entities, ref_entities)
            
            return float(entity_similarity), ref_text
            
        except Exception as e:
            print(f"Error calculating entity similarity: {str(e)}")
            return 0.0, str(reference_answer) if not isinstance(reference_answer, dict) else "Error in reference"

    def evaluate_retrieval_accuracy(self, retrieved_chunks, benchmark_chunks):
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
        start_time = time.time()
        try:
            retrieval_result = retrieval_service.retrieve(question, use_cache=False)
            context_items = retrieval_result.get("context_items", [])
            retrieved_chunks = retrieval_result.get("retrieved_chunks", [])
            
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
            
            model = ChatGoogleGenerativeAI(model="gemini-2.0-flash", api_key=GEMINI_API_KEY)
            
            results = db.similarity_search_with_relevance_scores(question, k=5)
            
            if len(results) == 0 or results[0][1] < 0.7:
                processing_time = time.time() - start_time
                return "No relevant documents found", [], processing_time
            
            context_text = "\n\n---\n\n".join([doc.page_content for doc, _ in results])
            prompt_template = ChatPromptTemplate.from_template(self.prompt_template)
            prompt = prompt_template.format(context=context_text, question=question)
            
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
        start_time = time.time()
        
        if not HAYSTACK_AVAILABLE:
            return "Haystack not available", [], time.time() - start_time
        
        try:
            from haystack import Document
            from haystack.document_stores.in_memory import InMemoryDocumentStore
            from haystack.components.retrievers import InMemoryBM25Retriever
            
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
                                
                                if file_path.startswith("/data/") or file_path.startswith("data/"):
                                    filename = os.path.basename(file_path)
                                    abs_file_path = os.path.join(subdir, filename)
                                else:
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
            
            document_store = InMemoryDocumentStore()
            document_store.write_documents(all_docs)
            retriever = InMemoryBM25Retriever(document_store, top_k=5)
            
            retrieved_docs = retriever.run(query=question)
            
            chunk_ids = []
            context_parts = []
            for doc in retrieved_docs["documents"]:
                doc_id = doc.meta.get("doc_id", "unknown")
                chunk_id = doc.meta.get("chunk_id", "unknown")
                chunk_ids.append(f"{chunk_id} (doc: {doc_id}, type: BM25)")
                context_parts.append(doc.content)
            
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
        start_time = time.time()
        
        try:
            retrieval_result = retrieval_service.retrieve(question, use_cache=False)
            context_items = retrieval_result.get("context_items", [])
            
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
        try:
            os.makedirs(BENCHMARK_DIR, exist_ok=True)
            file_path = os.path.join(BENCHMARK_DIR, filename)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(file_content)
            return filename
        except Exception as e:
            raise Exception(f"Failed to save benchmark file: {str(e)}")

    def run_benchmark(self, benchmark_file="benchmark.json", progress_callback=None):
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
            
            with open(output_path, "w", encoding="utf-8-sig", newline="") as csvfile:
                writer = csv.writer(csvfile)
                
                writer.writerow([
                    "STT", "question", "benchmark_answer", 
                    "current_answer", "current_entity_sim", "current_retrieval_accuracy", "current_processing_time",
                    "langchain_answer", "langchain_entity_sim", "langchain_retrieval_accuracy", "langchain_processing_time",
                    "haystack_answer", "haystack_entity_sim", "haystack_retrieval_accuracy", "haystack_processing_time",
                    "chatgpt_answer", "chatgpt_entity_sim", "chatgpt_processing_time",
                    "benchmark_chunks"
                ])
                
                for i, entry in enumerate(benchmark_data, start=1):
                    question = entry["question"]
                    expected = entry.get("ground_truth", entry.get("answer", ""))
                    benchmark_chunks = entry.get("contexts", [])
                    
                    if progress_callback:
                        progress_callback(i / total_questions * 100)
                    
                    print(f"Processing question {i}/{total_questions}: {question[:50]}...")
                    
                    current_answer, current_chunks, current_time = self.process_current_system(question)
                    current_entity_sim, benchmark_text = self.calculate_entity_similarity(current_answer, expected)
                    current_retrieval_acc, _ = self.evaluate_retrieval_accuracy(current_chunks, benchmark_chunks)
                    total_times['current'].append(current_time)
                    
                    langchain_answer, langchain_chunks, langchain_time = self.process_langchain(question)
                    langchain_entity_sim, _ = self.calculate_entity_similarity(langchain_answer, expected)
                    langchain_retrieval_acc, _ = self.evaluate_retrieval_accuracy(langchain_chunks, benchmark_chunks)
                    total_times['langchain'].append(langchain_time)
                    
                    haystack_answer, haystack_chunks, haystack_time = self.process_haystack(question)
                    haystack_entity_sim, _ = self.calculate_entity_similarity(haystack_answer, expected)
                    haystack_retrieval_acc, _ = self.evaluate_retrieval_accuracy(haystack_chunks, benchmark_chunks)
                    total_times['haystack'].append(haystack_time)
                    
                    chatgpt_answer, _, chatgpt_time = self.process_chatgpt(question)
                    chatgpt_entity_sim, _ = self.calculate_entity_similarity(chatgpt_answer, expected)
                    total_times['chatgpt'].append(chatgpt_time)
                    
                    writer.writerow([
                        i, question, benchmark_text,
                        current_answer, f"{current_entity_sim:.4f}", f"{current_retrieval_acc:.4f}", f"{current_time:.3f}",
                        langchain_answer, f"{langchain_entity_sim:.4f}", f"{langchain_retrieval_acc:.4f}", f"{langchain_time:.3f}",
                        haystack_answer, f"{haystack_entity_sim:.4f}", f"{haystack_retrieval_acc:.4f}", f"{haystack_time:.3f}",
                        chatgpt_answer, f"{chatgpt_entity_sim:.4f}", f"{chatgpt_time:.3f}",
                        " | ".join(benchmark_chunks)
                    ])
                    
                    results.append({
                        'current_entity_sim': current_entity_sim,
                        'current_retrieval_acc': current_retrieval_acc,
                        'current_time': current_time,
                        'langchain_entity_sim': langchain_entity_sim,
                        'langchain_retrieval_acc': langchain_retrieval_acc,
                        'langchain_time': langchain_time,
                        'haystack_entity_sim': haystack_entity_sim,
                        'haystack_retrieval_acc': haystack_retrieval_acc,
                        'haystack_time': haystack_time,
                        'chatgpt_entity_sim': chatgpt_entity_sim,
                        'chatgpt_time': chatgpt_time
                    })
                    
                    time.sleep(2)
                
                avg_current_time = sum(total_times['current']) / len(total_times['current'])
                avg_langchain_time = sum(total_times['langchain']) / len(total_times['langchain'])
                avg_haystack_time = sum(total_times['haystack']) / len(total_times['haystack'])
                avg_chatgpt_time = sum(total_times['chatgpt']) / len(total_times['chatgpt'])
                
                writer.writerow([
                    "SUMMARY", 
                    f"Average results from {total_questions} questions",
                    "Statistical Summary",
                    "See individual results above",
                    f"{sum(r['current_entity_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['current_retrieval_acc'] for r in results) / len(results):.4f}",
                    f"{avg_current_time:.3f}",
                    "See individual results above",
                    f"{sum(r['langchain_entity_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['langchain_retrieval_acc'] for r in results) / len(results):.4f}",
                    f"{avg_langchain_time:.3f}",
                    "See individual results above",
                    f"{sum(r['haystack_entity_sim'] for r in results) / len(results):.4f}",
                    f"{sum(r['haystack_retrieval_acc'] for r in results) / len(results):.4f}",
                    f"{avg_haystack_time:.3f}",
                    "See individual results above",
                    f"{sum(r['chatgpt_entity_sim'] for r in results) / len(results):.4f}",
                    f"{avg_chatgpt_time:.3f}",
                    "All benchmark chunks across questions"
                ])
            
            stats = {
                'current_avg_entity_sim': float(sum(r['current_entity_sim'] for r in results) / len(results)),
                'current_avg_retrieval': float(sum(r['current_retrieval_acc'] for r in results) / len(results)),
                'current_avg_time': float(avg_current_time),
                'langchain_avg_entity_sim': float(sum(r['langchain_entity_sim'] for r in results) / len(results)),
                'langchain_avg_retrieval': float(sum(r['langchain_retrieval_acc'] for r in results) / len(results)),
                'langchain_avg_time': float(avg_langchain_time),
                'haystack_avg_entity_sim': float(sum(r['haystack_entity_sim'] for r in results) / len(results)),
                'haystack_avg_retrieval': float(sum(r['haystack_retrieval_acc'] for r in results) / len(results)),
                'haystack_avg_time': float(avg_haystack_time),
                'chatgpt_avg_entity_sim': float(sum(r['chatgpt_entity_sim'] for r in results) / len(results)),
                'chatgpt_avg_time': float(avg_chatgpt_time),
                'total_questions': int(total_questions),
                'output_file': output_file
            }
            
            stats = self._convert_numpy_types(stats)
            
            return stats
            
        except Exception as e:
            raise Exception(f"Benchmark failed: {str(e)}")

benchmark_service = BenchmarkService()