from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import time
import functools
import json
import pandas as pd
from datetime import datetime
import os
from google import genai
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from fastapi.middleware.cors import CORSMiddleware

# === DECORATOR BENCHMARK ===
def benchmark(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        execution_time = time.time() - start_time
        print(f"Thời gian thực thi {func.__name__}: {execution_time:.4f} giây")
        # Thêm thời gian vào kết quả nếu nó là dict
        if isinstance(result, dict):
            result['execution_time'] = execution_time
        return result
    return wrapper

app = FastAPI()

# Thêm CORS để frontend có thể gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite mặc định chạy trên port 5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === CẤU HÌNH ===
MODEL_NAME = "intfloat/multilingual-e5-base"
COLLECTION_NAME = "law_data"
TOP_K = 5  # Số lượng đoạn văn bản tương đồng nhất để lấy
MAX_CHUNK_LENGTH_FOR_CONTEXT = 4000  # Giới hạn độ dài tối đa cho context

# Khởi tạo embedding function cho ChromaDB
embedding_function = SentenceTransformerEmbeddingFunction(
    model_name=MODEL_NAME
)

# === KHỞI TẠO CHROMADB CLIENT ===
try:
    chroma_client = chromadb.HttpClient(host="localhost", port=8000)
    
    # Kiểm tra xem collection đã tồn tại chưa
    try:
        collection = chroma_client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_function
        )
        print(f"Đã kết nối tới collection '{COLLECTION_NAME}', có {collection.count()} chunks")
    except Exception as e:
        print(f"Không thể kết nối tới collection '{COLLECTION_NAME}': {e}")
        # Tạo collection mới nếu chưa tồn tại
        collection = chroma_client.create_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_function
        )
        print(f"Đã tạo collection mới '{COLLECTION_NAME}'")
        
except Exception as e:
    print(f"Không thể kết nối tới ChromaDB: {e}")
    raise Exception("Không thể kết nối tới cơ sở dữ liệu. Vui lòng kiểm tra kết nối ChromaDB.")

# === KHỞI TẠO GEMINI CLIENT ===
client = genai.Client(api_key="AIzaSyBayTCsGKqfARlNRmlssmFfsUM8UvLjXCY")

# === INPUT SCHEMA ===
class QueryInput(BaseModel):
    query: str

class SearchResult(BaseModel):
    query: str
    answer: str
    retrieval_time: Optional[float] = None
    generation_time: Optional[float] = None
    total_time: Optional[float] = None

# === HÀM TRUY XUẤT DỮ LIỆU TỪ CHROMADB ===
@benchmark
def retrieve_from_chroma(query: str, top_k: int = TOP_K):
    try:
        # Chuẩn bị query
        query_text = f"query: {query}"
        
        # Thực hiện truy vấn
        results = collection.query(
            query_texts=[query_text],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        
        # Xử lý kết quả
        context_items = []
        retrieved_chunks = []
        
        if results["documents"] and len(results["documents"]) > 0:
            documents = results["documents"][0]  # Lấy kết quả của query đầu tiên
            metadatas = results["metadatas"][0]
            
            for i, (doc, meta) in enumerate(zip(documents, metadatas)):
                # Bỏ tiền tố "passage: " nếu có
                if doc.startswith("passage: "):
                    doc = doc[9:]
                
                # Xây dựng thông tin nguồn dựa trên metadata
                source_info = f"(Nguồn: {meta.get('doc_type', '')} {meta.get('doc_id', '')}"
                if "effective_date" in meta:
                    source_info += f", có hiệu lực từ {meta.get('effective_date', '')}"
                source_info += ")"
                
                # Lưu chunk_id
                if 'chunk_id' in meta:
                    retrieved_chunks.append(meta['chunk_id'])
                
                # Tạo một mục context với nội dung và nguồn
                context_item = f"{doc} {source_info}"
                context_items.append(context_item)
                
        return {
            "context_items": context_items,
            "retrieved_chunks": retrieved_chunks
        }
    except Exception as e:
        print(f"Lỗi khi truy vấn ChromaDB: {str(e)}")
        return {
            "context_items": [],
            "retrieved_chunks": []
        }

# === GỌI GEMINI ===
@benchmark
def generate_response_with_gemini(query: str, context_items: List[str]):
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
4. Sử dụng cấu trúc rõ ràng: câu trả lời ngắn gọn → giải thích chi tiết → trích dẫn → thông tin bổ sung (nếu có).
5. Khi CÂU HỎI KHÔNG LIÊN QUAN đến chính sách người có công, hãy lịch sự giải thích rằng bạn chuyên về lĩnh vực này và đề nghị người dùng đặt câu hỏi liên quan.
6. Bạn nên nhớ là bạn là trợ lý tư vấn về chính sách người có công nói chung, chứ không phải là người có công với cách mạng nhé, vậy nên không được nhắc tới từ người có công với cách mạng. Hai lĩnh vực đó là khác nhau.

### ĐỊNH DẠNG TRẢ LỜI
- Sử dụng ngôn ngữ đơn giản, rõ ràng
- Tổ chức thành đoạn ngắn, dễ đọc
- Có thể sử dụng danh sách đánh số khi liệt kê nhiều điểm
- Sử dụng in đậm cho các THUẬT NGỮ QUAN TRỌNG

[USER QUERY]
{query}

[CONTEXT]
{context_text}"""

    try:
        # gemini-2.0-pro-exp-02-05
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return {
            "answer": response.text
        }
    except Exception as e:
        print(f"Error calling Gemini API: {str(e)}")
        return {
            "answer": "Xin lỗi, tôi đang gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau."
        }

# === ENDPOINT CHÍNH ===
@app.post("/ask", response_model=SearchResult)
async def ask(input: QueryInput):
    try:
        start_time = time.time()
        
        # 1. Retrieval
        retrieval_result = retrieve_from_chroma(input.query)
        context_items = retrieval_result['context_items']
        retrieval_time = retrieval_result.get('execution_time', 0)
        
        if not context_items:
            return {
                "query": input.query,
                "answer": "Tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu. Vui lòng thử cách diễn đạt khác hoặc hỏi một câu hỏi khác về chính sách người có công.",
                "retrieval_time": retrieval_time,
                "generation_time": 0,
                "total_time": retrieval_time
            }
        
        # 2. Generation
        generation_result = generate_response_with_gemini(input.query, context_items)
        answer = generation_result['answer']
        generation_time = generation_result.get('execution_time', 0)
        
        # 3. Tính tổng thời gian
        total_time = time.time() - start_time
        
        return {
            "query": input.query,
            "answer": answer,
            "retrieval_time": retrieval_time,
            "generation_time": generation_time,
            "total_time": total_time
        }
    except Exception as e:
        print(f"Error in /ask endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === ENDPOINT TRUY XUẤT DỮ LIỆU RIÊNG BIỆT ===
@app.post("/retrieve")
async def retrieve(input: QueryInput):
    try:
        retrieval_result = retrieve_from_chroma(input.query)
        
        return {
            "query": input.query,
            "contexts": retrieval_result['context_items'],
            "retrieved_chunks": retrieval_result['retrieved_chunks'],
            "count": len(retrieval_result['context_items']),
            "retrieval_time": retrieval_result.get('execution_time', 0)
        }
    except Exception as e:
        print(f"Error in /retrieve endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === ENDPOINT BENCHMARK ===
@app.post("/benchmark")
async def run_benchmark(input: QueryInput):
    try:
        benchmark_start = time.time()
        
        # 1. Retrieval
        retrieval_result = retrieve_from_chroma(input.query)
        context_items = retrieval_result['context_items']
        retrieved_chunks = retrieval_result['retrieved_chunks']
        retrieval_time = retrieval_result.get('execution_time', 0)
        
        # 2. Generation (nếu có context)
        if context_items:
            generation_result = generate_response_with_gemini(input.query, context_items)
            answer = generation_result['answer']
            generation_time = generation_result.get('execution_time', 0)
        else:
            answer = "Không tìm thấy dữ liệu liên quan."
            generation_time = 0
        
        # 3. Tính tổng thời gian
        total_time = time.time() - benchmark_start
        
        return {
            "query": input.query,
            "answer": answer,
            "retrieved_chunks": retrieved_chunks,
            "retrieval_time": retrieval_time,
            "generation_time": generation_time,
            "total_time": total_time
        }
    except Exception as e:
        print(f"Error in /benchmark endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === ENDPOINT KIỂM TRA TRẠNG THÁI ===
@app.get("/status")
async def status():
    try:
        collection_count = collection.count()
        return {
            "status": "ok", 
            "message": "API đang hoạt động bình thường",
            "database": {
                "status": "connected",
                "collection": COLLECTION_NAME,
                "documents_count": collection_count
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"API gặp sự cố: {str(e)}",
            "database": {
                "status": "disconnected" 
            }
        }

# === ENDPOINT CHẠY BENCHMARK VỚI TẬP DỮ LIỆU ===
@app.post("/run-benchmark")
async def run_full_benchmark(file_path: str = "benchmark.json", output_dir: str = "benchmark_results"):
    try:
        # Tạo thư mục kết quả nếu chưa tồn tại
        os.makedirs(output_dir, exist_ok=True)
        
        # Đọc file benchmark
        with open(file_path, 'r', encoding='utf-8') as f:
            benchmark_data = json.load(f)
        
        results = []
        
        # Tạo tên file kết quả với timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = os.path.join(output_dir, f"benchmark_results_{timestamp}.csv")
        
        # Chạy từng câu hỏi trong benchmark
        total_questions = len(benchmark_data.get('benchmark', []))
        print(f"Bắt đầu chạy benchmark với {total_questions} câu hỏi...")
        
        for i, item in enumerate(benchmark_data.get('benchmark', [])):
            question_id = item.get('id', f"q{i+1}")
            question = item.get('question', '')
            expected_answer = item.get('ground_truth', '')
            expected_contexts = item.get('contexts', [])
            
            print(f"Đang xử lý câu hỏi {i+1}/{total_questions}: {question_id}")
            
            # Gọi endpoint benchmark
            try:
                response = await run_benchmark(QueryInput(query=question))
                
                # Xử lý kết quả
                retrieval_time = response.get('retrieval_time', 0)
                generation_time = response.get('generation_time', 0)
                total_time = response.get('total_time', 0)
                answer = response.get('answer', '')
                retrieved_chunks = response.get('retrieved_chunks', [])
                
                # Tính retrieval score
                retrieval_score = 0
                if expected_contexts:
                    matches = set()
                    for retrieved in retrieved_chunks:
                        for expected in expected_contexts:
                            if expected in retrieved:
                                matches.add(expected)
                    print("Chunk tìm được:", retrieved_chunks)
                    print("Chunk mong đợi:", expected_contexts)
                    retrieval_score = len(matches) / len(expected_contexts) if expected_contexts else 0
                
                # Lưu kết quả
                result = {
                    'question_id': question_id,
                    'question': question,
                    'expected_contexts': ','.join(expected_contexts),
                    'retrieved_contexts': ','.join(retrieved_chunks),
                    'retrieval_score': retrieval_score,
                    'retrieval_time': retrieval_time,
                    'generation_time': generation_time,
                    'total_time': total_time,
                    'expected_answer': expected_answer[:500],  # Giới hạn để không quá dài
                    'answer': answer[:500],  # Giới hạn để không quá dài
                    'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                
                results.append(result)
                
                # Cập nhật file CSV sau mỗi câu hỏi
                df = pd.DataFrame(results)
                df.to_csv(csv_path, index=False, encoding='utf-8-sig')
                
                # In thông tin
                print(f"  - Thời gian: Retrieval={retrieval_time:.2f}s, Generation={generation_time:.2f}s, Total={total_time:.2f}s")
                print(f"  - Retrieval score: {retrieval_score:.2f}")
                
            except Exception as e:
                print(f"Lỗi khi xử lý câu hỏi {question_id}: {str(e)}")
                continue
        
        # Tính toán thống kê
        if results:
            avg_retrieval_time = sum(r['retrieval_time'] for r in results) / len(results)
            avg_generation_time = sum(r['generation_time'] for r in results) / len(results)
            avg_total_time = sum(r['total_time'] for r in results) / len(results)
            avg_retrieval_score = sum(r['retrieval_score'] for r in results) / len(results)
            
            # Thêm hàng tổng kết vào DataFrame
            summary = {
                'question_id': 'SUMMARY',
                'question': f'Avg scores for {len(results)} questions',
                'expected_contexts': '',
                'retrieved_contexts': '',
                'retrieval_score': avg_retrieval_score,
                'retrieval_time': avg_retrieval_time,
                'generation_time': avg_generation_time,
                'total_time': avg_total_time,
                'expected_answer': '',
                'answer': '',
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            results.append(summary)
            
            # Lưu lại file kết quả cuối cùng
            df = pd.DataFrame(results)
            df.to_csv(csv_path, index=False, encoding='utf-8-sig')
        
        return {
            "message": f"Benchmark đã hoàn thành với {len(results)-1} câu hỏi",
            "file_path": csv_path,
            "stats": {
                "avg_retrieval_time": avg_retrieval_time,
                "avg_generation_time": avg_generation_time,
                "avg_total_time": avg_total_time,
                "avg_retrieval_score": avg_retrieval_score
            }
        }
    
    except Exception as e:
        print(f"Error in /run-benchmark endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)