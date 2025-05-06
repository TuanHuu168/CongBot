import time
import json
import sys
import os
import re
from typing import List, Dict, Tuple, Optional, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import TOP_K, MAX_TOKENS_PER_DOC
from database.chroma_client import chroma_client
from database.mongodb_client import mongodb_client
from models.cache import CacheModel, CacheCreate, CacheStatus

class RetrievalService:
    def __init__(self):
        """Khởi tạo dịch vụ retrieval"""
        self.chroma = chroma_client
        self.db = mongodb_client.get_database()
        self.text_cache_collection = self.db.text_cache
        
        # Kiểm tra cache collection
        try:
            cache_count = self.text_cache_collection.count_documents({})
            print(f"Cache collection hiện có {cache_count} documents")
            
            # Kiểm tra index
            indexes = list(self.text_cache_collection.list_indexes())
            print(f"Cache collection có {len(indexes)} indexes")
            
            # Kiểm tra ChromaDB cache collection
            try:
                cache_collection = self.chroma.client.get_or_create_collection(
                    name="cache_questions",
                    embedding_function=self.chroma.embedding_function
                )
                chroma_count = cache_collection.count()
                print(f"ChromaDB cache collection có {chroma_count} documents")
            except Exception as e:
                print(f"Không thể lấy thông tin ChromaDB cache: {str(e)}")
                
        except Exception as e:
            print(f"Lỗi khi kiểm tra cache collection: {str(e)}")
    
    def _normalize_question(self, query: str) -> str:
        # Loại bỏ dấu câu
        normalized = re.sub(r'[.,;:!?()"\']', '', query.lower())

        # Loại bỏ khoảng trắng thừa
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return normalized
    
    def _extract_keywords(self, query: str) -> List[str]:
        # Đây là bản triển khai đơn giản, có thể cải thiện bằng NLP
        normalized = self._normalize_question(query)
        # Chỉ lấy các từ có độ dài >= 3
        keywords = [word for word in normalized.split() if len(word) >= 3]
        # Loại bỏ các từ trùng lặp
        return list(set(keywords))
    
    def _format_context(self, results: Dict[str, Any]) -> Tuple[List[str], List[str]]:
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
        """
        Kiểm tra cache dựa trên ngữ nghĩa (semantic) của câu hỏi.
        """
        print(f"Đang kiểm tra cache cho query: '{query}'")
        
        # 1. Chuẩn hóa câu hỏi
        normalized_query = self._normalize_question(query)
        print(f"Normalized query: '{normalized_query}'")
        
        try:
            # 2. Kiểm tra exact match trong MongoDB (phương pháp 1)
            print(f"Đang kiểm tra exact match trong MongoDB (phương pháp 1)...")
            # Thêm điều kiện validityStatus
            exact_match = self.text_cache_collection.find_one({
                "normalizedQuestion": normalized_query,
                "validityStatus": CacheStatus.VALID
            })
            
            if exact_match:
                print(f"Tìm thấy exact match trong cache cho query: '{query}'")
                # Cập nhật hitCount và lastUsed (nếu có)
                try:
                    self.text_cache_collection.update_one(
                        {"_id": exact_match["_id"]},
                        {
                            "$inc": {"hitCount": 1},
                            "$set": {"lastUsed": time.time()}
                        }
                    )
                except Exception as e:
                    print(f"Không thể cập nhật hitCount/lastUsed: {str(e)}")
                    
                return dict(exact_match)
                
            # 3. Kiểm tra exact match trong MongoDB (phương pháp 2 - chuỗi chính xác)
            print(f"Đang kiểm tra exact match (phương pháp 2)...")
            exact_match_raw = self.text_cache_collection.find_one({
                "questionText": query,
                "validityStatus": CacheStatus.VALID
            })
            
            if exact_match_raw:
                print(f"Tìm thấy exact match (raw) trong cache cho query: '{query}'")
                # Cập nhật hitCount và lastUsed (nếu có)
                try:
                    self.text_cache_collection.update_one(
                        {"_id": exact_match_raw["_id"]},
                        {
                            "$inc": {"hitCount": 1},
                            "$set": {"lastUsed": time.time()}
                        }
                    )
                except Exception as e:
                    print(f"Không thể cập nhật hitCount/lastUsed: {str(e)}")
                    
                return dict(exact_match_raw)
            
            print("Không tìm thấy exact match, thực hiện semantic search...")
            
            # 4. Kiểm tra semantic match trong ChromaDB
            try:
                print("Đang kiểm tra cache trong ChromaDB...")
                # Định dạng query theo chuẩn
                query_text = f"query: {query}"
                
                # Tìm kiếm trong collection cache_questions
                try:
                    cache_collection = self.chroma.client.get_or_create_collection(
                        name="cache_questions",
                        embedding_function=self.chroma.embedding_function
                    )
                    
                    # Thực hiện similarity search
                    cache_results = cache_collection.query(
                        query_texts=[query_text],
                        n_results=1,  # Chỉ lấy kết quả tương đồng nhất
                        include=["documents", "metadatas", "distances"]
                    )
                    
                    # Kiểm tra xem có kết quả nào không
                    if (cache_results["ids"] and len(cache_results["ids"][0]) > 0 and
                        cache_results["distances"] and len(cache_results["distances"][0]) > 0):
                        
                        # Lấy cache_id và distance
                        cache_id = cache_results["ids"][0][0]
                        distance = cache_results["distances"][0][0]
                        
                        # Chuyển đổi distance thành similarity score
                        similarity_score = 1.0 - min(distance, 1.0)
                        
                        # Ngưỡng tương đồng (có thể điều chỉnh)
                        SIMILARITY_THRESHOLD = 0.85
                        
                        print(f"ChromaDB cache match: id={cache_id}, score={similarity_score:.4f}")
                        
                        # Kiểm tra xem độ tương đồng có vượt ngưỡng không
                        if similarity_score >= SIMILARITY_THRESHOLD:
                            # Lấy thông tin cache từ MongoDB - không kiểm tra validityStatus
                            cache_result = self.text_cache_collection.find_one({
                                "cacheId": cache_id
                            })
                            
                            if cache_result:
                                print(f"Tìm thấy semantic match trong cache với score {similarity_score:.4f}")
                                # Cập nhật hitCount và lastUsed
                                try:
                                    self.text_cache_collection.update_one(
                                        {"_id": cache_result["_id"]},
                                        {
                                            "$inc": {"hitCount": 1},
                                            "$set": {"lastUsed": time.time()}
                                        }
                                    )
                                except Exception as e:
                                    print(f"Không thể cập nhật hitCount/lastUsed: {str(e)}")
                                
                                return dict(cache_result)
                            else:
                                print(f"Tìm thấy trong ChromaDB nhưng không tìm thấy trong MongoDB: {cache_id}")
                    
                except Exception as ce:
                    print(f"Lỗi khi truy vấn cache collection trong ChromaDB: {str(ce)}")
                
                print("Không tìm thấy semantic match, tiếp tục với text search...")
                
            except Exception as e:
                print(f"Lỗi khi thực hiện semantic search: {str(e)}")
            
        except Exception as e:
            print(f"Lỗi khi kiểm tra cache: {str(e)}")
        
        return None
    
    
    def _extract_document_ids(self, chunk_ids: List[str]) -> List[str]:
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
        # Tạo cache ID ngẫu nhiên
        cache_id = f"cache_{int(time.time() * 1000)}"
        
        print(f"Tạo cache entry mới với ID {cache_id}")
        
        # Tạo danh sách tài liệu liên quan với điểm số
        relevant_documents = []
        for chunk_id in chunks:
            score = relevance_scores.get(chunk_id, 0.5)  # Mặc định 0.5 nếu không có điểm
            relevant_documents.append({"chunkId": chunk_id, "score": score})
        
        # Trích xuất ID văn bản
        doc_ids = self._extract_document_ids(chunks)
        
        # Trích xuất từ khóa
        keywords = self._extract_keywords(query)
        
        # Tạo cache entry - thêm trường validityStatus
        cache_data = {
            "cacheId": cache_id,
            "questionText": query,
            "normalizedQuestion": self._normalize_question(query),
            "answer": answer,
            "relevantDocuments": relevant_documents,
            "validityStatus": CacheStatus.VALID,  # Thêm trường này
            "relatedDocIds": doc_ids,
            "keywords": keywords,
            "expiresAt": None  # Hoặc có thể thêm thời gian hết hạn
        }
        
        # Lưu vào MongoDB
        try:
            self.text_cache_collection.insert_one(cache_data)
            print(f"Đã lưu cache entry vào MongoDB")
        except Exception as e:
            print(f"Lỗi khi lưu cache vào MongoDB: {str(e)}")
            return ""
        
        # Tạo vector embedding và lưu vào ChromaDB
        success = self._add_to_chroma_cache(cache_id, query, doc_ids)
        if not success:
            print("Không thể thêm vào ChromaDB cache, nhưng vẫn lưu trong MongoDB")
        
        return cache_id
    
    def _add_to_chroma_cache(self, cache_id: str, query: str, related_doc_ids: List[str]) -> bool:
        query_text = f"query: {query}"
        
        # Chuyển list thành string để tránh lỗi với ChromaDB
        related_docs_str = ",".join(related_doc_ids) if related_doc_ids else ""
        
        # Bao gồm validityStatus trong metadata
        metadata = {
            "validityStatus": CacheStatus.VALID,  # Thêm trường này
            "relatedDocIds": related_docs_str  # Lưu dưới dạng chuỗi phân cách bằng dấu phẩy
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
            print(f"Đã thêm cache entry vào ChromaDB thành công")
            return True
        except Exception as e:
            print(f"Lỗi khi thêm cache vào ChromaDB: {str(e)}")
            return False
    
    def _invalidate_cache_for_document(self, doc_id: str) -> int:
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
        start_time = time.time()
        
        print(f"Thực hiện truy vấn: '{query}', use_cache={use_cache}")
        
        # Kiểm tra cache nếu cần
        if use_cache:
            try:
                print("Bắt đầu kiểm tra cache...")
                cache_result = self._check_cache(query)
                if cache_result:
                    print("Tìm thấy kết quả trong cache, trả về kết quả cache.")
                    
                    # Lấy retrieved_chunks từ relevantDocuments nếu có
                    retrieved_chunks = []
                    for doc in cache_result.get("relevantDocuments", []):
                        if "chunkId" in doc:
                            retrieved_chunks.append(doc["chunkId"])
                    
                    return {
                        "answer": cache_result["answer"],
                        "context_items": [],  # Không cần context_items khi dùng cache
                        "retrieved_chunks": retrieved_chunks,  # Thêm retrieved_chunks vào kết quả
                        "source": "cache",
                        "cache_id": cache_result["cacheId"],
                        "execution_time": time.time() - start_time
                    }
                    
                print("Không tìm thấy trong cache, tiếp tục với ChromaDB.")
            except Exception as e:
                print(f"Lỗi khi kiểm tra cache, bỏ qua và tiếp tục tìm kiếm: {str(e)}")
        else:
            print("Bỏ qua kiểm tra cache theo yêu cầu.")
        
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
        print(f"Đang thêm kết quả vào cache cho query: '{query}'")
        cache_id = self._create_cache_entry(query, answer, chunks, relevance_scores)
        if cache_id:
            print(f"Đã thêm vào cache với ID: {cache_id}")
        else:
            print("Không thể thêm vào cache")
        return cache_id
    
    def invalidate_document_cache(self, doc_id: str) -> int:
        # Nếu không có trường validityStatus, thì có thể dùng phương pháp khác
        # như thêm trường mới hoặc xóa cache
        result = self.text_cache_collection.delete_many({"relatedDocIds": doc_id})
        
        # Cập nhật hoặc xóa trong ChromaDB
        try:
            # Lấy tất cả cache IDs bị ảnh hưởng trước khi xóa trong MongoDB
            affected_caches = list(self.text_cache_collection.find(
                {"relatedDocIds": doc_id},
                {"cacheId": 1}
            ))
            
            cache_ids = [cache["cacheId"] for cache in affected_caches]
            
            # Xóa trong ChromaDB
            if cache_ids:
                cache_collection = self.chroma.client.get_collection(
                    name="cache_questions",
                    embedding_function=self.chroma.embedding_function
                )
                
                try:
                    cache_collection.delete(ids=cache_ids)
                    print(f"Đã xóa {len(cache_ids)} cache entries trong ChromaDB")
                except Exception as e:
                    print(f"Lỗi khi xóa cache trong ChromaDB: {str(e)}")
        
        except Exception as e:
            print(f"Lỗi khi vô hiệu hóa cache: {str(e)}")
        
        return result.deleted_count

# Singleton instance
retrieval_service = RetrievalService()