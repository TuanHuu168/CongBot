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
        
        # Khởi tạo ChromaDB client cho LangChain (sử dụng cùng config với chroma_client)
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
        """Khởi tạo ChromaDB client cho LangChain sử dụng cùng config với hệ thống chính"""
        try:
            # Sử dụng HttpClient như chroma_client.py
            self.langchain_chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
            
            # Sử dụng cùng embedding function
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
        try:
            retrieval_result = retrieval_service.retrieve(question, use_cache=False)
            context_items = retrieval_result.get("context_items", [])
            retrieved_chunks = retrieval_result.get("retrieved_chunks", [])
            
            if context_items:
                generation_result = generation_service.generate_answer(question, use_cache=False)
                answer = generation_result.get("answer", "")
            else:
                answer = "Tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu."
            
            return answer, retrieved_chunks
        except Exception as e:
            print(f"Error in process_current_system: {str(e)}")
            return f"ERROR: {str(e)}", []

    def process_langchain(self, question):
        """Xử lý câu hỏi bằng LangChain với ChromaDB Docker"""
        if not LANGCHAIN_AVAILABLE:
            return "LangChain not available", []
        
        if not self.langchain_chroma_client:
            return "LangChain ChromaDB client not initialized", []
        
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain.prompts import ChatPromptTemplate
            
            # Khởi tạo LangChain Chroma với client hiện có
            from langchain_chroma import Chroma
            from langchain_huggingface import HuggingFaceEmbeddings
            
            # Sử dụng cùng embedding model như hệ thống chính
            embedding_function = HuggingFaceEmbeddings(
                model_name=EMBEDDING_MODEL_NAME,
                model_kwargs={'device': 'cuda' if USE_GPU and self._check_gpu() else 'cpu'}
            )
            
            # Kết nối với collection chính (law_data)
            db = Chroma(
                client=self.langchain_chroma_client,
                collection_name=CHROMA_COLLECTION,  # Sử dụng collection chính
                embedding_function=embedding_function
            )
            
            model = ChatGoogleGenerativeAI(model="gemini-2.0-flash", api_key=GEMINI_API_KEY)
            
            # Thực hiện similarity search
            results = db.similarity_search_with_relevance_scores(question, k=5)
            
            if len(results) == 0 or results[0][1] < 0.7:
                return "No relevant documents found", []
            
            context_text = "\n\n---\n\n".join([doc.page_content for doc, _ in results])
            prompt_template = ChatPromptTemplate.from_template(self.prompt_template)
            prompt = prompt_template.format(context=context_text, question=question)
            
            response = model.invoke(prompt)
            answer = str(response.content)
            
            # Format retrieved chunks info
            retrieved_chunks = []
            for i, (doc, score) in enumerate(results):
                chunk_id = doc.metadata.get('chunk_id', f'unknown_chunk_{i}')
                doc_id = doc.metadata.get('doc_id', 'unknown_doc')
                doc_type = doc.metadata.get('doc_type', '')
                chunk_info = f"{chunk_id} (doc: {doc_id}, type: {doc_type}, score: {float(score):.3f})"
                retrieved_chunks.append(chunk_info)
            
            return answer, retrieved_chunks
            
        except Exception as e:
            print(f"Error in process_langchain: {str(e)}")
            return f"ERROR: {str(e)}", []

    def process_haystack(self, question):
        """Xử lý câu hỏi bằng Haystack"""
        if not HAYSTACK_AVAILABLE:
            return "Haystack not available", []
        
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
                return "No documents found for Haystack", []
            
            # Khởi tạo document store và retriever
            document_store = InMemoryDocumentStore()
            document_store.write_documents(all_docs)
            retriever = InMemoryBM25Retriever(document_store, top_k=5)
            
            # Retrieve documents
            retrieved_docs = retriever.run(query=question)
            
            chunk_ids = []
            context_parts = []
            for doc in retrieved_docs["documents"]:
                doc_id = doc.meta.get("doc_id", "unknown")
                chunk_id = doc.meta.get("chunk_id", "unknown")
                chunk_ids.append(f"{doc_id}_{chunk_id}")
                context_parts.append(doc.content)
            
            # Generate answer
            context_text = "\n\n---\n\n".join(context_parts)
            prompt = self.prompt_template.format(context=context_text, question=question)
            
            model = genai.GenerativeModel('gemini-2.0-flash')
            response = model.generate_content(prompt)
            answer = response.text
            
            return answer, chunk_ids
            
        except Exception as e:
            print(f"Error in process_haystack: {str(e)}")
            return f"ERROR: {str(e)}", []

    def process_chatgpt(self, question):
        """Xử lý câu hỏi bằng ChatGPT"""
        try:
            # Sử dụng retrieval từ hệ thống chính để lấy context
            retrieval_result = retrieval_service.retrieve(question, use_cache=False)
            context_items = retrieval_result.get("context_items", [])
            
            if not context_items:
                return "No relevant context found", []
            
            context_text = "\n\n---\n\n".join(context_items)
            prompt = self.prompt_template.format(context=context_text, question=question)
            
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if not openai_api_key:
                return "OpenAI API key not configured", []
            
            client = OpenAI(api_key=openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.1
            )
            
            answer = response.choices[0].message.content
            return answer, []
            
        except Exception as e:
            print(f"Error in process_chatgpt: {str(e)}")
            return f"ERROR: {str(e)}", []

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
        """Chạy benchmark so sánh 4 models"""
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
            
            with open(output_path, "w", encoding="utf-8-sig", newline="") as csvfile:
                writer = csv.writer(csvfile)
                
                # Header
                writer.writerow([
                    "STT", "question", "benchmark_answer", 
                    "current_answer", "current_cosine_sim", "current_retrieved_chunks", "current_retrieval_accuracy",
                    "langchain_answer", "langchain_cosine_sim", "langchain_retrieved_chunks", "langchain_retrieval_accuracy",
                    "haystack_answer", "haystack_cosine_sim", "haystack_retrieved_chunks", "haystack_retrieval_accuracy",
                    "chatgpt_answer", "chatgpt_cosine_sim",
                    "benchmark_chunks"
                ])
                
                for i, entry in enumerate(benchmark_data, start=1):
                    question = entry["question"]
                    expected = entry.get("ground_truth", entry.get("answer", ""))
                    benchmark_chunks = entry.get("contexts", [])
                    
                    if progress_callback:
                        progress_callback(i / total_questions * 100)
                    
                    print(f"Processing question {i}/{total_questions}: {question[:50]}...")
                    
                    # Process với các models
                    current_answer, current_chunks = self.process_current_system(question)
                    current_cosine_sim, benchmark_text = self.calculate_cosine_similarity(current_answer, expected)
                    current_retrieval_acc, _ = self.evaluate_retrieval_accuracy(current_chunks, benchmark_chunks)
                    
                    langchain_answer, langchain_chunks = self.process_langchain(question)
                    langchain_cosine_sim, _ = self.calculate_cosine_similarity(langchain_answer, expected)
                    langchain_retrieval_acc, _ = self.evaluate_retrieval_accuracy(langchain_chunks, benchmark_chunks)
                    
                    haystack_answer, haystack_chunks = self.process_haystack(question)
                    haystack_cosine_sim, _ = self.calculate_cosine_similarity(haystack_answer, expected)
                    haystack_retrieval_acc, _ = self.evaluate_retrieval_accuracy(haystack_chunks, benchmark_chunks)
                    
                    chatgpt_answer, _ = self.process_chatgpt(question)
                    chatgpt_cosine_sim, _ = self.calculate_cosine_similarity(chatgpt_answer, expected)
                    
                    # Ghi kết quả
                    writer.writerow([
                        i, question, benchmark_text,
                        current_answer, f"{current_cosine_sim:.4f}", 
                        " | ".join(current_chunks), f"{current_retrieval_acc:.4f}",
                        langchain_answer, f"{langchain_cosine_sim:.4f}", 
                        " | ".join(langchain_chunks), f"{langchain_retrieval_acc:.4f}",
                        haystack_answer, f"{haystack_cosine_sim:.4f}", 
                        " | ".join(haystack_chunks), f"{haystack_retrieval_acc:.4f}",
                        chatgpt_answer, f"{chatgpt_cosine_sim:.4f}",
                        " | ".join(benchmark_chunks)
                    ])
                    
                    results.append({
                        'current_cosine_sim': current_cosine_sim,
                        'current_retrieval_acc': current_retrieval_acc,
                        'langchain_cosine_sim': langchain_cosine_sim,
                        'langchain_retrieval_acc': langchain_retrieval_acc,
                        'haystack_cosine_sim': haystack_cosine_sim,
                        'haystack_retrieval_acc': haystack_retrieval_acc,
                        'chatgpt_cosine_sim': chatgpt_cosine_sim
                    })
                    
                    # Delay để tránh rate limit
                    time.sleep(2)
            
            # Tính statistics
            stats = {
                'current_avg_cosine': float(sum(r['current_cosine_sim'] for r in results) / len(results)),
                'current_avg_retrieval': float(sum(r['current_retrieval_acc'] for r in results) / len(results)),
                'langchain_avg_cosine': float(sum(r['langchain_cosine_sim'] for r in results) / len(results)),
                'langchain_avg_retrieval': float(sum(r['langchain_retrieval_acc'] for r in results) / len(results)),
                'haystack_avg_cosine': float(sum(r['haystack_cosine_sim'] for r in results) / len(results)),
                'haystack_avg_retrieval': float(sum(r['haystack_retrieval_acc'] for r in results) / len(results)),
                'chatgpt_avg_cosine': float(sum(r['chatgpt_cosine_sim'] for r in results) / len(results)),
                'total_questions': int(total_questions),
                'output_file': output_file
            }
            
            # Convert numpy types
            stats = self._convert_numpy_types(stats)
            
            return stats
            
        except Exception as e:
            raise Exception(f"Benchmark failed: {str(e)}")

# Singleton instance
benchmark_service = BenchmarkService()