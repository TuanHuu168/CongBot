"""
Dịch vụ truy xuất và tìm kiếm thông tin từ các văn bản
"""
import time
import json
import sys
import os
import re
from typing import List, Dict, Tuple, Optional, Any

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import TOP_K, MAX_TOKENS_PER_DOC
from database.chroma_client import chroma_client
from database.mongodb_client import mongodb_client
from models.cache import CacheModel, CacheCreate, CacheStatus

class RetrievalService:
    """Dịch vụ truy xuất thông tin từ các văn bản pháp luật"""
    
    def __init__(self):
        """Khởi tạo dịch vụ retrieval"""
        self.chroma = chroma_client
        self.db = mongodb_client.get_database()
        self.text_cache_collection = self.db.text_cache
    
    def _normalize_question(self, query: str) -> str:
        """Chuẩn hóa câu hỏi để tìm kiếm và so sánh tốt hơn"""
        # Loại bỏ dấu câu
        normalized = re.sub(r'[.,;:!?()"\']', '', query.lower())
        # Loại bỏ các từ stopwords (có thể mở rộng danh sách này)
        stopwords = ['là', 'và', 'của', 'có', 'được', 'trong', 'cho', 'tôi', 'tại', 'vì', 'từ', 'với']
        for word in stopwords:
            normalized = re.sub(r'\b' + word + r'\b', '', normalized)
        # Loại bỏ khoảng trắng thừa
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return normalized
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Trích xuất từ khóa từ câu hỏi"""
        # Đây là bản triển khai đơn giản, có thể cải thiện bằng NLP
        normalized = self._normalize_question(query)
        # Chỉ lấy các từ có độ dài >= 3
        keywords = [word for word in normalized.split() if len(word) >= 3]
        # Loại bỏ các từ trùng lặp
        return list(set(keywords))
    
    def _format_context(self, results: Dict[str, Any]) -> Tuple[List[str], List[str]]:
        """Định dạng kết quả truy vấn để sử dụng trong context"""
        context_items = []
        retrieved_chunks = []
        
        if results.get("documents") and len(results["documents"]) > 0:
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
        
        return context_items, retrieved_chunks
    
    def _check_cache(self, query: str) -> Optional[Dict[str, Any]]:
        """Kiểm tra cache cho câu hỏi hiện tại"""
        normalized_query = self._normalize_question(query)
        
        # Tìm kiếm trong cache bằng cả so khớp chính xác và text search
        cache_result = self.text_cache_collection.find_one({
            "normalizedQuestion": normalized_query,
            "validityStatus": "valid"
        })
        
        if not cache_result:
            # Thử tìm với text search
            cache_result = self.text_cache_collection.find_one({
                "$text": {"$search": normalized_query},
                "validityStatus": "valid"
            })
        
        if cache_result:
            # Cập nhật hitCount và lastUsed
            self.text_cache_collection.update_one(
                {"_id": cache_result["_id"]},
                {
                    "$inc": {"hitCount": 1},
                    "$set": {"lastUsed": time.time()}
                }
            )
            
            # Chuyển từ BSON sang dict Python
            return dict(cache_result)
        
        return None
    
    def _extract_document_ids(self, chunk_ids: List[str]) -> List[str]:
        """Trích xuất ID của các văn bản từ chunk IDs"""
        doc_ids = []
        for chunk_id in chunk_ids:
            # Định dạng chunk_id: {doc_id}_{chunk_specific_part}
            parts = chunk_id.split('_', 1)
            if len(parts) > 0:
                doc_id_parts = []
                for part in parts[:-1]:  # Bỏ phần cuối cùng (chunk specific)
                    doc_id_parts.append(part)
                doc_id = "_".join(doc_id_parts)
                if doc_id not in doc_ids:
                    doc_ids.append(doc_id)
        
        return doc_ids
    
    def _create_cache_entry(self, query: str, answer: str, chunks: List[str], relevance_scores: Dict[str, float]) -> str:
        """Tạo cache mới cho câu hỏi và câu trả lời"""
        # Tạo cache ID ngẫu nhiên
        cache_id = f"cache_{int(time.time() * 1000)}"
        
        # Tạo danh sách tài liệu liên quan với điểm số
        relevant_documents = []
        for chunk_id in chunks:
            score = relevance_scores.get(chunk_id, 0.5)  # Mặc định 0.5 nếu không có điểm
            relevant_documents.append({"chunkId": chunk_id, "score": score})
        
        # Trích xuất ID văn bản
        doc_ids = self._extract_document_ids(chunks)
        
        # Trích xuất từ khóa
        keywords = self._extract_keywords(query)
        
        # Tạo cache entry
        cache_data = CacheCreate(
            cacheId=cache_id,
            questionText=query,
            normalizedQuestion=self._normalize_question(query),
            answer=answer,
            relevantDocuments=relevant_documents,
            relatedDocIds=doc_ids,
            keywords=keywords
        )
        
        # Lưu vào MongoDB
        self.text_cache_collection.insert_one(cache_data.dict(by_alias=True))
        
        # Tạo vector embedding và lưu vào ChromaDB
        self._add_to_chroma_cache(cache_id, query, doc_ids)
        
        return cache_id
    
    def _add_to_chroma_cache(self, cache_id: str, query: str, related_doc_ids: List[str]) -> bool:
        """Thêm câu hỏi vào ChromaDB cache"""
        query_text = f"query: {query}"
        metadata = {
            "validityStatus": "valid",
            "relatedDocIds": related_doc_ids
        }
        
        # Sử dụng collection riêng cho cache
        try:
            cache_collection = self.chroma.client.get_or_create_collection(
                name="cache_questions",
                embedding_function=self.chroma.embedding_function
            )
            
            cache_collection.add(
                ids=[cache_id],
                documents=[query_text],
                metadatas=[metadata]
            )
            return True
        except Exception as e:
            print(f"Lỗi khi thêm cache vào ChromaDB: {str(e)}")
            return False
    
    def _invalidate_cache_for_document(self, doc_id: str) -> int:
        """Vô hiệu hóa tất cả cache liên quan đến văn bản có ID cụ thể"""
        result = self.text_cache_collection.update_many(
            {"relatedDocIds": doc_id},
            {"$set": {"validityStatus": CacheStatus.INVALID}}
        )
        
        # Đánh dấu là invalid trong ChromaDB
        try:
            cache_collection = self.chroma.client.get_collection(
                name="cache_questions",
                embedding_function=self.chroma.embedding_function
            )
            
            # Lấy tất cả cache IDs bị ảnh hưởng
            affected_caches = self.text_cache_collection.find(
                {"relatedDocIds": doc_id},
                {"cacheId": 1}
            )
            
            cache_ids = [cache["cacheId"] for cache in affected_caches]
            
            # Cập nhật metadata trong ChromaDB
            for cache_id in cache_ids:
                try:
                    cache_collection.update(
                        ids=[cache_id],
                        metadatas=[{"validityStatus": "invalid"}]
                    )
                except Exception as e:
                    print(f"Lỗi khi cập nhật cache {cache_id} trong ChromaDB: {str(e)}")
        
        except Exception as e:
            print(f"Lỗi khi vô hiệu hóa cache trong ChromaDB: {str(e)}")
        
        return result.modified_count
    
    def retrieve(self, query: str, use_cache: bool = True) -> Dict[str, Any]:
        """Truy xuất thông tin cho câu hỏi"""
        start_time = time.time()
        
        # Kiểm tra cache
        if use_cache:
            cache_result = self._check_cache(query)
            if cache_result:
                return {
                    "answer": cache_result["answer"],
                    "context_items": [doc["chunkId"] for doc in cache_result.get("relevantDocuments", [])],
                    "source": "cache",
                    "cache_id": cache_result["cacheId"],
                    "execution_time": time.time() - start_time
                }
        
        # Nếu không có trong cache, truy vấn từ ChromaDB
        try:
            # Chuẩn bị query
            query_text = f"query: {query}"
            
            # Thực hiện truy vấn
            results = self.chroma.collection.query(
                query_texts=[query_text],
                n_results=TOP_K,
                include=["documents", "metadatas", "distances"]
            )
            
            # Xử lý kết quả
            context_items, retrieved_chunks = self._format_context(results)
            
            # Tạo map giữa chunk_id và relevance score
            relevance_scores = {}
            if results.get("distances") and len(results["distances"]) > 0:
                distances = results["distances"][0]
                metadatas = results["metadatas"][0]
                
                for i, (distance, meta) in enumerate(zip(distances, metadatas)):
                    if 'chunk_id' in meta:
                        # Chuyển đổi distance thành relevance score (1.0 - distance)
                        # Giả sử khoảng cách cosine, nên càng nhỏ càng tốt
                        relevance_scores[meta['chunk_id']] = 1.0 - min(distance, 1.0)
            
            return {
                "context_items": context_items,
                "retrieved_chunks": retrieved_chunks,
                "source": "chroma",
                "relevance_scores": relevance_scores,
                "execution_time": time.time() - start_time
            }
        except Exception as e:
            print(f"Lỗi khi truy vấn ChromaDB: {str(e)}")
            return {
                "context_items": [],
                "retrieved_chunks": [],
                "source": "error",
                "error": str(e),
                "execution_time": time.time() - start_time
            }
    
    def search_keyword(self, keyword: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Tìm kiếm văn bản dựa trên từ khóa"""
        try:
            # Tìm kiếm trong text_cache
            results = self.text_cache_collection.find(
                {"$text": {"$search": keyword}, "validityStatus": "valid"},
                {"score": {"$meta": "textScore"}}
            ).sort([("score", {"$meta": "textScore"})]).limit(limit)
            
            return list(results)
        except Exception as e:
            print(f"Lỗi khi tìm kiếm từ khóa: {str(e)}")
            return []
    
    def add_to_cache(self, query: str, answer: str, chunks: List[str], relevance_scores: Dict[str, float]) -> str:
        """Thêm kết quả vào cache"""
        return self._create_cache_entry(query, answer, chunks, relevance_scores)
    
    def invalidate_document_cache(self, doc_id: str) -> int:
        """Vô hiệu hóa cache cho văn bản cụ thể"""
        return self._invalidate_cache_for_document(doc_id)

# Singleton instance
retrieval_service = RetrievalService()