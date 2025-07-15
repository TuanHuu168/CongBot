import time
import json
import sys
import os
import re
import numpy as np
from datetime import datetime
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Any, Tuple

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import TOP_K, MAX_TOKENS_PER_DOC, EMBEDDING_MODEL_NAME, ES_CONFIG
from database.chroma_client import chroma_client
from database.mongodb_client import mongodb_client
from database.elasticsearch_client import elasticsearch_client
from models.cache import CacheModel, CacheCreate, CacheStatus
from services.activity_service import activity_service, ActivityType

class RetrievalService:
    def __init__(self):
        """Khởi tạo dịch vụ truy xuất hybrid (Vector + Elasticsearch)"""
        self.chroma = chroma_client
        self.es_client = elasticsearch_client
        self.db = mongodb_client.get_database()
        self.text_cache_collection = self.db.text_cache
        
        # Cấu hình trọng số cho hybrid search
        self.elastic_weight = ES_CONFIG.ELASTIC_WEIGHT
        self.vector_weight = ES_CONFIG.VECTOR_WEIGHT
        
        print(f"RetrievalService khởi tạo với:")
        print(f"- Embedding model: {EMBEDDING_MODEL_NAME}")
        print(f"- Hybrid weights: ES({self.elastic_weight}) + Vector({self.vector_weight})")
        
        # Kiểm tra các collections
        try:
            cache_count = self.text_cache_collection.count_documents({})
            print(f"- MongoDB cache collection: {cache_count} documents")
            
            cache_collection = self.chroma.get_cache_collection()
            if cache_collection:
                chroma_count = cache_collection.count()
                print(f"- ChromaDB cache collection: {chroma_count} documents")
                
            es_stats = self.es_client.get_index_stats()
            print(f"- Elasticsearch index: {es_stats.get('document_count', 0)} documents")
        except Exception as e:
            print(f"Lỗi kiểm tra cache: {str(e)}")
    
    def _normalize_question(self, query):
        """Chuẩn hóa câu hỏi để so sánh"""
        normalized = re.sub(r'[.,;:!?()"\']', '', query.lower())
        return re.sub(r'\s+', ' ', normalized).strip()
    
    def _extract_keywords(self, query):
        """Trích xuất từ khóa từ câu hỏi"""
        normalized = self._normalize_question(query)
        keywords = [word for word in normalized.split() if len(word) >= 3]
        return list(set(keywords))
    
    def _normalize_scores(self, scores: List[float]) -> List[float]:
        """Chuẩn hóa scores về range [0, 1] bằng min-max normalization"""
        if not scores:
            return []
        
        scores = np.array(scores)
        min_score = scores.min()
        max_score = scores.max()
        
        if max_score == min_score:
            return [1.0] * len(scores)
        
        normalized = (scores - min_score) / (max_score - min_score)
        return normalized.tolist()
    
    def _fetch_full_content_for_chunks(self, chunk_ids: List[str]) -> Dict[str, str]:
        """Lấy full content cho các chunks từ ChromaDB"""
        try:
            collection = self.chroma.get_main_collection()
            if not collection:
                print("Không thể lấy main collection từ ChromaDB")
                return {}
            
            # Lấy full content từ ChromaDB
            result = collection.get(
                ids=chunk_ids,
                include=["documents", "metadatas"]
            )
            
            content_map = {}
            if result and result.get("documents"):
                for i, chunk_id in enumerate(result["ids"]):
                    if i < len(result["documents"]):
                        doc = result["documents"][i]
                        # Bỏ prefix "passage: " nếu có
                        if doc.startswith("passage: "):
                            doc = doc[9:]
                        content_map[chunk_id] = doc
            
            print(f"Đã lấy full content cho {len(content_map)} chunks")
            return content_map
            
        except Exception as e:
            print(f"Lỗi fetch full content từ ChromaDB: {str(e)}")
            return {}
    
    def _merge_results(self, elastic_results: List[Dict], vector_results: List[Dict], 
                    top_k: int = TOP_K) -> List[Dict]:
        
        print(f"Đang merge {len(elastic_results)} kết quả ES và {len(vector_results)} kết quả Vector...")
        
        # Filter kết quả từ elasticsearch
        valid_elastic_results = []
        for result in elastic_results:
            # Kiểm tra validity
            chunk_id = result.get("chunk_id")
            if self._is_chunk_valid(chunk_id):
                valid_elastic_results.append(result)
            else:
                print(f"Filtered invalid chunk from ES: {chunk_id}")
        
        # Filter kết quả từ chromadb 
        valid_vector_results = []
        for result in vector_results:
            # Kiểm tra validity
            metadata = result.get("metadata", {})
            if metadata.get("validity_status") != "invalid":
                valid_vector_results.append(result)
            else:
                print(f"Filtered invalid chunk from Vector: {metadata.get('chunk_id', 'unknown')}")
        
        print(f"After filtering: ES {len(valid_elastic_results)}/{len(elastic_results)}, Vector {len(valid_vector_results)}/{len(vector_results)}")
        
        # Tạo mapping từ chunk_id đến kết quả
        elastic_map = {result["chunk_id"]: result for result in valid_elastic_results}
        vector_map = {result["chunk_id"]: result for result in valid_vector_results}
        
        all_chunk_ids = set(elastic_map.keys()) | set(vector_map.keys())
        print(f"Tổng cộng {len(all_chunk_ids)} unique VALID chunks từ cả hai sources")
        
        # Thu thập tất cả raw scores
        elastic_scores = [elastic_map[cid]["score"] for cid in elastic_map.keys()]
        vector_scores = [vector_map[cid]["score"] for cid in vector_map.keys()]
        
        print(f"Valid scores - ES range: {min(elastic_scores) if elastic_scores else 0:.3f} - {max(elastic_scores) if elastic_scores else 0:.3f}")
        print(f"Valid scores - Vector range: {min(vector_scores) if vector_scores else 0:.3f} - {max(vector_scores) if vector_scores else 0:.3f}")
        
        # Normalize scores về [0,1] dựa trên min-max của từng loại
        normalized_elastic_scores = self._normalize_scores(elastic_scores) if elastic_scores else []
        normalized_vector_scores = self._normalize_scores(vector_scores) if vector_scores else []
        
        # Tạo mapping cho normalized scores
        elastic_norm_map = {}
        if normalized_elastic_scores:
            elastic_norm_map = dict(zip(elastic_map.keys(), normalized_elastic_scores))
        
        vector_norm_map = {}
        if normalized_vector_scores:
            vector_norm_map = dict(zip(vector_map.keys(), normalized_vector_scores))
        
        merged_results = []
        for chunk_id in all_chunk_ids:
            # Lấy normalized scores
            elastic_score = elastic_norm_map.get(chunk_id, 0)
            vector_score = vector_norm_map.get(chunk_id, 0)
            
            # Hybrid score với weights = 0.5
            elastic_weight = 0.5
            vector_weight = 0.5
            hybrid_score = (elastic_weight * elastic_score + vector_weight * vector_score)
            
            # Tạo result object
            result = {
                "chunk_id": chunk_id,
                "hybrid_score": hybrid_score,
                "elastic_score": elastic_score,
                "vector_score": vector_score,
                "raw_elastic_score": elastic_map.get(chunk_id, {}).get("score", 0),
                "raw_vector_score": vector_map.get(chunk_id, {}).get("score", 0)
            }
            
            # Thêm metadata và search method
            if chunk_id in elastic_map and chunk_id in vector_map:
                result["search_method"] = "hybrid"
                es_meta = elastic_map[chunk_id].get("metadata", {})
                vec_meta = vector_map[chunk_id].get("metadata", {})
                result["metadata"] = {**es_meta, **vec_meta}
                result["highlights"] = elastic_map[chunk_id].get("highlights", {})
            elif chunk_id in vector_map:
                result["search_method"] = "vector"
                result["metadata"] = vector_map[chunk_id].get("metadata", {})
                result["highlights"] = {}
            else:  # chunk_id in elastic_map
                result["search_method"] = "elasticsearch"
                result["metadata"] = elastic_map[chunk_id].get("metadata", {})
                result["highlights"] = elastic_map[chunk_id].get("highlights", {})
            
            merged_results.append(result)
        
        # Sort theo hybrid score
        merged_results.sort(key=lambda x: x["hybrid_score"], reverse=True)
        final_results = merged_results[:top_k]
        
        print(f"Đã merge và chọn {len(final_results)} valid chunks tốt nhất")
        
        return final_results

    def _is_chunk_valid(self, chunk_id: str) -> bool:
        """Kiểm tra chunk có valid không bằng cách query ChromaDB main collection"""
        try:
            collection = self.chroma.get_main_collection()
            if not collection:
                return True  # Default là valid nếu không check được
            
            result = collection.get(
                ids=[chunk_id],
                include=["metadatas"]
            )
            
            if result and result.get("ids") and len(result["ids"]) > 0:
                metadata = result["metadatas"][0]
                validity_status = metadata.get("validity_status")
                
                if validity_status == "invalid":
                    return False
                else:
                    return True  # valid hoặc None đều coi là valid
            else:
                # Chunk không tồn tại
                return False
                
        except Exception as e:
            print(f"Lỗi check validity cho {chunk_id}: {str(e)}")
            return True  # Default là valid nếu có lỗi
    
    def _format_context(self, results):
        """Format kết quả truy xuất thành context và chunks, filter invalid chunks"""
        context_items = []
        retrieved_chunks = []
        
        if results.get("documents") and len(results["documents"]) > 0:
            documents = results["documents"][0]
            metadatas = results["metadatas"][0]
            
            for doc, meta in zip(documents, metadatas):
                # Filter ra chunks bị invalid
                validity_status = meta.get("validity_status")
                if validity_status == "invalid":
                    print(f"Bỏ qua chunk bị invalid: {meta.get('chunk_id', 'unknown')}")
                    continue
                
                # Loại bỏ prefix "passage: "
                if doc.startswith("passage: "):
                    doc = doc[9:]
                
                # Tạo thông tin nguồn
                source_info = f"(Nguồn: {meta.get('doc_type', '')} {meta.get('doc_id', '')}"
                if meta.get('effective_date'):
                    source_info += f", có hiệu lực từ {meta['effective_date']}"
                source_info += ")"
                
                # Lưu chunk_id và context
                if 'chunk_id' in meta:
                    retrieved_chunks.append(meta['chunk_id'])
                
                context_items.append(f"{doc} {source_info}")
        
        return context_items, retrieved_chunks
    
    def _check_cache(self, query):
        """Kiểm tra cache cho câu hỏi"""
        print(f"Kiểm tra cache cho: '{query}'")
        
        normalized_query = self._normalize_question(query)
        
        try:
            # 1. Exact match trong MongoDB
            exact_match = self.text_cache_collection.find_one({
                "$or": [
                    {"normalizedQuestion": normalized_query},
                    {"questionText": query}
                ],
                "validityStatus": CacheStatus.VALID
            })
            
            if exact_match:
                print("Tìm thấy exact match trong MongoDB cache")
                self._update_cache_usage(exact_match["_id"])
                return dict(exact_match)
            
            # 2. Semantic search trong ChromaDB
            print("Không có exact match, thực hiện semantic search...")
            cache_collection = self.chroma.get_cache_collection()
            
            if not cache_collection:
                print("Không thể lấy cache collection")
                return None
            
            query_text = f"query: {query}"
            cache_results = cache_collection.query(
                query_texts=[query_text],
                n_results=1,
                include=["documents", "metadatas", "distances"]
            )
            
            if (cache_results["ids"] and len(cache_results["ids"][0]) > 0 and
                cache_results["distances"] and len(cache_results["distances"][0]) > 0):
                
                cache_id = cache_results["ids"][0][0]
                distance = cache_results["distances"][0][0]
                similarity_score = 1.0 - min(distance, 1.0)
                
                print(f"ChromaDB semantic match: score={similarity_score:.4f}")
                
                # Ngưỡng tương đồng
                if similarity_score >= 0.85:
                    metadata = cache_results["metadatas"][0][0] if cache_results["metadatas"] else {}
                    if metadata.get("validityStatus") != "invalid":
                        cache_result = self.text_cache_collection.find_one({
                            "cacheId": cache_id,
                            "validityStatus": CacheStatus.VALID
                        })
                        
                        if cache_result:
                            print(f"Tìm thấy semantic match với score {similarity_score:.4f}")
                            self._update_cache_usage(cache_result["_id"])
                            return dict(cache_result)
            
            print("Không tìm thấy cache phù hợp")
            return None
            
        except Exception as e:
            print(f"Lỗi kiểm tra cache: {str(e)}")
            return None
    
    def _update_cache_usage(self, cache_id):
        """Cập nhật thống kê sử dụng cache"""
        try:
            self.text_cache_collection.update_one(
                {"_id": cache_id},
                {
                    "$inc": {"hitCount": 1},
                    "$set": {"lastUsed": datetime.now()}
                }
            )
        except Exception as e:
            print(f"Lỗi cập nhật cache usage: {str(e)}")
    
    def _extract_document_ids(self, chunk_ids):
        """Trích xuất document IDs từ chunk IDs"""
        doc_ids = []
        for chunk_id in chunk_ids:
            parts = chunk_id.split('_', 1)
            if len(parts) > 0:
                doc_id_parts = []
                for part in parts[:-1]:
                    doc_id_parts.append(part)
                doc_id = "_".join(doc_id_parts)
                if doc_id not in doc_ids:
                    doc_ids.append(doc_id)
        return doc_ids
    
    def _create_cache_entry(self, query, answer, chunks, relevance_scores):
        """Tạo entry cache mới"""
        cache_id = f"cache_{int(time.time() * 1000)}"
        print(f"Tạo cache entry: {cache_id}")
        
        # Chuẩn bị dữ liệu
        relevant_documents = [
            {"chunkId": chunk_id, "score": relevance_scores.get(chunk_id, 0.5)}
            for chunk_id in chunks
        ]
        doc_ids = self._extract_document_ids(chunks)
        keywords = self._extract_keywords(query)
        
        cache_data = {
            "cacheId": cache_id,
            "questionText": query,
            "normalizedQuestion": self._normalize_question(query),
            "answer": answer,
            "relevantDocuments": relevant_documents,
            "validityStatus": CacheStatus.VALID,
            "relatedDocIds": doc_ids,
            "keywords": keywords,
            "hitCount": 0,
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
            "lastUsed": datetime.now(),
            "expiresAt": None
        }
        
        try:
            # Lưu vào MongoDB
            result = self.text_cache_collection.insert_one(cache_data)
            print("Đã lưu cache vào MongoDB")
            
            # Lưu vào ChromaDB
            self._add_to_chroma_cache(cache_id, query, doc_ids)
            return cache_id
            
        except Exception as e:
            print(f"Lỗi tạo cache: {str(e)}")
            return ""
    
    def _add_to_chroma_cache(self, cache_id, query, related_doc_ids):
        """Thêm cache vào ChromaDB"""
        query_text = f"query: {query}"
        metadata = {
            "validityStatus": str(CacheStatus.VALID),
            "relatedDocIds": ",".join(related_doc_ids) if related_doc_ids else ""
        }
        
        try:
            success = self.chroma.add_documents_to_cache(
                ids=[cache_id],
                documents=[query_text],
                metadatas=[metadata]
            )
            
            if success:
                print("Đã thêm cache vào ChromaDB")
                return True
            else:
                print("Lỗi thêm cache vào ChromaDB")
                return False
                
        except Exception as e:
            print(f"Lỗi ChromaDB cache: {str(e)}")
            return False
    
    def retrieve(self, query, use_cache=True, search_method="hybrid"):
        start_time = time.time()
        
        # Kiểm tra cache
        if use_cache:
            cache_result = self._check_cache(query)
            if cache_result:
                print("Trả về kết quả từ cache")
                retrieved_chunks = [
                    doc["chunkId"] for doc in cache_result.get("relevantDocuments", [])
                    if "chunkId" in doc
                ]
                
                return {
                    "answer": cache_result["answer"],
                    "context_items": [],
                    "retrieved_chunks": retrieved_chunks,
                    "source": "cache",
                    "cache_id": cache_result["cacheId"],
                    "execution_time": time.time() - start_time,
                    "search_method": "cache"
                }
        
        try:
            if search_method == "vector":
                # Chỉ sử dụng Vector search
                return self._vector_search_only(query, start_time)
            elif search_method == "elasticsearch":
                # Chỉ sử dụng Elasticsearch
                return self._elasticsearch_search_only(query, start_time)
            else:
                # Hybrid search (mặc định)
                return self._hybrid_search(query, start_time)
                
        except Exception as e:
            print(f"Lỗi trong retrieval: {str(e)}")
            return {
                "context_items": [],
                "retrieved_chunks": [],
                "source": "error",
                "error": str(e),
                "execution_time": time.time() - start_time,
                "search_method": "error"
            }
    
    def _vector_search_only(self, query, start_time):
        """Vector search với filter validity"""
        print("Thực hiện Vector search từ ChromaDB với filter validity")
        try:
            query_text = f"query: {query}"
            
            # Search với where filter để chỉ lấy valid chunks
            results = self.chroma.search_main(
                query_text=query_text,
                n_results=TOP_K * 2,  # Lấy nhiều hơn để sau khi filter vẫn đủ
                include=["documents", "metadatas", "distances"]
            )
            
            # Manual filter vì ChromaDB where có thể không hoạt động với vector search
            if results and results.get("metadatas"):
                filtered_docs = []
                filtered_metadatas = []
                filtered_distances = []
                filtered_ids = []
                
                for i, metadata in enumerate(results["metadatas"][0]):
                    if metadata.get("validity_status") != "invalid":
                        filtered_docs.append(results["documents"][0][i])
                        filtered_metadatas.append(metadata)
                        filtered_distances.append(results["distances"][0][i])
                        filtered_ids.append(results["ids"][0][i])
                
                # Tạo lại results object với data đã filter
                filtered_results = {
                    "documents": [filtered_docs] if filtered_docs else [[]],
                    "metadatas": [filtered_metadatas] if filtered_metadatas else [[]],
                    "distances": [filtered_distances] if filtered_distances else [[]],
                    "ids": [filtered_ids] if filtered_ids else [[]]
                }
                
                print(f"Filtered vector results: {len(filtered_docs)}/{len(results['documents'][0])} valid chunks")
                
                # Chỉ lấy top K sau khi filter
                for key in filtered_results:
                    if filtered_results[key] and len(filtered_results[key][0]) > TOP_K:
                        filtered_results[key] = [filtered_results[key][0][:TOP_K]]
                
                results = filtered_results
            
            context_items, retrieved_chunks = self._format_context(results)
            
            # Tính relevance scores
            relevance_scores = {}
            if results.get("distances") and len(results["distances"]) > 0:
                distances = results["distances"][0]
                metadatas = results["metadatas"][0]
                
                for distance, meta in zip(distances, metadatas):
                    if 'chunk_id' in meta:
                        relevance_scores[meta['chunk_id']] = 1.0 - min(distance, 1.0)
            
            print(f"Vector search hoàn tất: {len(context_items)} contexts, {len(retrieved_chunks)} VALID chunks")
            
            return {
                "context_items": context_items,
                "retrieved_chunks": retrieved_chunks,
                "source": "vector",
                "relevance_scores": relevance_scores,
                "execution_time": time.time() - start_time,
                "search_method": "vector"
            }
            
        except Exception as e:
            print(f"Lỗi Vector search: {str(e)}")
            return {
                "context_items": [],
                "retrieved_chunks": [],
                "source": "error",
                "error": str(e),
                "execution_time": time.time() - start_time,
                "search_method": "vector_error"
            }
    
    def _elasticsearch_search_only(self, query, start_time):
        """Elasticsearch search với filter validity"""
        print("Thực hiện Elasticsearch search với filter validity")
        try:
            es_response = self.es_client.search_documents(
                query=query, 
                size=TOP_K * 2  # Lấy nhiều hơn để filter
            )
            
            context_items = []
            retrieved_chunks = []
            relevance_scores = {}
            valid_hits = []
            
            for hit in es_response.get("hits", []):
                chunk_id = hit["chunk_id"]
                
                # Check validity của chunk
                if self._is_chunk_valid(chunk_id):
                    valid_hits.append(hit)
                else:
                    print(f"Filtered invalid chunk from ES: {chunk_id}")
            
            # Chỉ lấy top K chunks valid
            for hit in valid_hits[:TOP_K]:
                chunk_id = hit["chunk_id"]
                retrieved_chunks.append(chunk_id)
                relevance_scores[chunk_id] = hit["score"]
                
                # Tạo context text từ ES metadata
                source = hit["source"]
                context_text = f"[ES] {source.get('content_summary', '')} (Doc: {source.get('doc_id', '')})"
                context_items.append(context_text)
            
            print(f"Elasticsearch search hoàn tất: {len(valid_hits)}/{len(es_response.get('hits', []))} valid chunks, {len(context_items)} contexts")
            
            return {
                "context_items": context_items,
                "retrieved_chunks": retrieved_chunks,
                "source": "elasticsearch",
                "relevance_scores": relevance_scores,
                "execution_time": time.time() - start_time,
                "search_method": "elasticsearch",
                "stats": {
                    "total_hits": es_response.get("total", 0),
                    "valid_hits": len(valid_hits),
                    "max_score": es_response.get("max_score", 0)
                }
            }
            
        except Exception as e:
            print(f"Lỗi Elasticsearch search: {str(e)}")
            return {
                "context_items": [],
                "retrieved_chunks": [],
                "source": "error",
                "error": str(e),
                "execution_time": time.time() - start_time,
                "search_method": "elasticsearch_error"
            }
    
    def _hybrid_search(self, query, start_time):
        """Thực hiện Hybrid search (Vector + Elasticsearch)"""
        search_size = TOP_K * 2
        
        # 1. Elasticsearch search
        elastic_start = time.time()
        try:
            elastic_response = self.es_client.search_documents(
                query=query, 
                size=search_size
            )
            elastic_time = time.time() - elastic_start
            
            elastic_results = []
            for hit in elastic_response.get("hits", []):
                elastic_results.append({
                    "chunk_id": hit["chunk_id"],
                    "score": hit["score"],
                    "metadata": hit["source"],
                    "highlights": hit.get("highlights", {})
                })
                
            print(f"Elasticsearch: {len(elastic_results)} results ({elastic_time:.3f}s)")
            
        except Exception as e:
            print(f"Lỗi Elasticsearch trong hybrid: {str(e)}")
            elastic_results = []
            elastic_time = 0
        
        # 2. Vector search
        vector_start = time.time()
        try:
            query_text = f"query: {query}"
            vector_response = self.chroma.search_main(
                query_text=query_text,
                n_results=search_size,
                include=["documents", "metadatas", "distances"]
            )
            vector_time = time.time() - vector_start
            
            vector_results = []
            if vector_response and vector_response.get("metadatas"):
                metadatas = vector_response["metadatas"][0]
                distances = vector_response.get("distances", [[]])[0]
                
                for i, meta in enumerate(metadatas):
                    if 'chunk_id' in meta:
                        score = 1.0 - min(distances[i] if i < len(distances) else 0.5, 1.0)
                        vector_results.append({
                            "chunk_id": meta['chunk_id'],
                            "score": score,
                            "metadata": meta,
                            "highlights": {}
                        })
                        
            print(f"Vector search: {len(vector_results)} results ({vector_time:.3f}s)")
            
        except Exception as e:
            print(f"Lỗi Vector search trong hybrid: {str(e)}")
            vector_results = []
            vector_time = 0
        
        # 3. Merge và lấy top chunks tốt nhất với validity filter
        merge_start = time.time()
        merged_results = self._merge_results(elastic_results, vector_results, TOP_K*2)
        merge_time = time.time() - merge_start
        
        # 4. Fetch full content cho tất cả chunks được chọn
        content_start = time.time()
        selected_chunk_ids = [result["chunk_id"] for result in merged_results]
        full_contents = self._fetch_full_content_for_chunks(selected_chunk_ids)
        content_time = time.time() - content_start
        
        print(f"Content fetch: {len(full_contents)} chunks with full content ({content_time:.3f}s)")
        
        # 5. Format output với full content cho Gemini
        context_items = []
        retrieved_chunks = []
        relevance_scores = {}
        
        for result in merged_results:
            chunk_id = result["chunk_id"]
            retrieved_chunks.append(chunk_id)
            relevance_scores[chunk_id] = result["hybrid_score"]
            
            # Sử dụng full content từ ChromaDB
            full_content = full_contents.get(chunk_id, "")
            if full_content:
                # Tạo thông tin nguồn chi tiết
                metadata = result.get("metadata", {})
                source_info = f"(Nguồn: {metadata.get('doc_type', 'Văn bản')} {metadata.get('doc_id', '')}"
                if metadata.get('effective_date'):
                    source_info += f", có hiệu lực từ {metadata['effective_date']}"
                if metadata.get('doc_title'):
                    source_info += f" - {metadata['doc_title'][:100]}..."
                source_info += f", Search: {result.get('search_method', 'hybrid')})"
                
                context_items.append(f"{full_content}\n\n{source_info}")
            else:
                # Fallback nếu không lấy được full content
                print(f"Cảnh báo: Không lấy được full content cho chunk {chunk_id}")
                context_text = f"[Lỗi] Không thể lấy nội dung cho chunk {chunk_id}"
                context_items.append(context_text)
        
        total_time = time.time() - start_time
        
        print(f"- Elasticsearch: {len(elastic_results)} results ({elastic_time:.3f}s)")
        print(f"- Vector search: {len(vector_results)} results ({vector_time:.3f}s)")
        print(f"- Merged: {len(merged_results)} chunks ({merge_time:.3f}s)")
        
        print(f"ID của {len(merged_results)} chunks được chọn:")
        for i, result in enumerate(merged_results):
            metadata = result.get('metadata', {})
            validity = metadata.get('validity_status', 'valid')
            print(f"  {i+1}. {result['chunk_id']}: hybrid={result['hybrid_score']:.3f} "
                f"(ES={result['elastic_score']:.3f}, Vec={result['vector_score']:.3f}, "
                f"Method={result.get('search_method', 'unknown')}, Validity={validity})")
        
        return {
            "context_items": context_items,
            "retrieved_chunks": retrieved_chunks,
            "source": "hybrid",
            "relevance_scores": relevance_scores,
            "execution_time": total_time,
            "search_method": "hybrid",
            "stats": {
                "elasticsearch_results": len(elastic_results),
                "vector_results": len(vector_results),
                "merged_results": len(merged_results),
                "final_context_items": len(context_items),
                "elastic_time": elastic_time,
                "vector_time": vector_time,
                "merge_time": merge_time,
                "content_fetch_time": content_time,
                "validity_filtered": True,
                "weights": {
                    "elasticsearch": self.elastic_weight,
                    "vector": self.vector_weight
                }
            }
        }
    
    def add_to_cache(self, query, answer, chunks, relevance_scores):
        """Thêm kết quả vào cache"""
        print(f"Thêm kết quả vào cache cho: '{query}'")
        cache_id = self._create_cache_entry(query, answer, chunks, relevance_scores)
        if cache_id:
            print(f"Cache ID: {cache_id}")
        return cache_id
    
    def index_document_to_elasticsearch(self, doc_id: str, chunks_data: List[Dict]) -> bool:
        """Index document chunks vào Elasticsearch"""
        try:
            print(f"Indexing document {doc_id} vào Elasticsearch...")
            
            # Chuẩn bị documents cho ES
            es_documents = []
            for chunk in chunks_data:
                doc = {
                    "chunk_id": chunk.get("chunk_id"),
                    "doc_id": doc_id,
                    "doc_type": chunk.get("doc_type", ""),
                    "doc_title": chunk.get("doc_title", ""),
                    "content": chunk.get("content", ""),
                    "content_summary": chunk.get("content_summary", ""),
                    "effective_date": chunk.get("effective_date", ""),
                    "status": chunk.get("status", "active"),
                    "document_scope": chunk.get("document_scope", ""),
                    "chunk_type": chunk.get("chunk_type", ""),
                    "chunk_index": chunk.get("chunk_index", 0),
                    "total_chunks": chunk.get("total_chunks", 1),
                    "keywords": chunk.get("keywords", []),
                    "created_at": chunk.get("created_at", "")
                }
                es_documents.append(doc)
            
            # Bulk index
            success = self.es_client.bulk_index_documents(es_documents)
            
            if success:
                print(f"Đã index {len(es_documents)} chunks vào Elasticsearch")
            else:
                print(f"Thất bại khi index vào Elasticsearch")
                
            return success
            
        except Exception as e:
            print(f"Lỗi index vào Elasticsearch: {str(e)}")
            return False

    def delete_document_from_elasticsearch(self, doc_id: str) -> bool:
        """Xóa document khỏi Elasticsearch"""
        try:
            success = self.es_client.delete_documents_by_doc_id(doc_id)
            if success:
                print(f"Đã xóa document {doc_id} khỏi Elasticsearch")
            return success
        except Exception as e:
            print(f"Lỗi xóa khỏi Elasticsearch: {str(e)}")
            return False
    
    def invalidate_document_cache(self, doc_id):
        """Vô hiệu hóa cache liên quan đến document"""
        print(f"Vô hiệu hóa cache cho document: {doc_id}")
        
        # Vô hiệu hóa trong MongoDB
        result = self.text_cache_collection.update_many(
            {"relatedDocIds": doc_id},
            {"$set": {"validityStatus": CacheStatus.INVALID}}
        )
        
        # Vô hiệu hóa trong ChromaDB
        try:
            affected_caches = list(self.text_cache_collection.find(
                {"relatedDocIds": doc_id},
                {"cacheId": 1}
            ))
            
            cache_ids = [cache["cacheId"] for cache in affected_caches]
            
            if cache_ids:
                cache_collection = self.chroma.get_cache_collection()
                if cache_collection:
                    for cache_id in cache_ids:
                        try:
                            cache_collection.update(
                                ids=[cache_id],
                                metadatas=[{"validityStatus": CacheStatus.INVALID}]
                            )
                        except Exception as e:
                            print(f"Lỗi update ChromaDB cache {cache_id}: {str(e)}")
        
        except Exception as e:
            print(f"Lỗi vô hiệu hóa ChromaDB cache: {str(e)}")
        
        # Log activity
        activity_service.log_activity(
            ActivityType.CACHE_INVALIDATE,
            f"Vô hiệu hóa cache cho document {doc_id}: {result.modified_count} entries",
            metadata={
                "doc_id": doc_id,
                "affected_count": result.modified_count,
                "action": "invalidate_document_cache"
            }
        )
        
        print(f"Đã vô hiệu hóa {result.modified_count} cache entries")
        return result.modified_count
    
    def clear_all_cache(self):
        """Xóa toàn bộ cache"""
        try:
            print("Đang xóa toàn bộ cache...")
            
            # Xóa MongoDB cache
            total_before = self.text_cache_collection.count_documents({})
            result = self.text_cache_collection.delete_many({})
            deleted_count = result.deleted_count
            print(f"Đã xóa {deleted_count} entries trong MongoDB")
            
            # Xóa ChromaDB cache
            try:
                cache_collection = self.chroma.get_cache_collection()
                if cache_collection:
                    chroma_count_before = cache_collection.count()
                    all_ids = cache_collection.get(include=[])["ids"]
                    if all_ids:
                        cache_collection.delete(ids=all_ids)
                        print(f"Đã xóa {len(all_ids)} cache từ ChromaDB")
            except Exception as ce:
                print(f"Lỗi xóa ChromaDB cache: {str(ce)}")
            
            # Log activity
            activity_service.log_activity(
                ActivityType.CACHE_CLEAR,
                f"Đã xóa toàn bộ cache: {deleted_count} entries",
                metadata={
                    "mongodb_deleted": deleted_count,
                    "mongodb_before": total_before
                }
            )
            
            return deleted_count
            
        except Exception as e:
            print(f"Lỗi xóa cache: {str(e)}")
            activity_service.log_activity(
                ActivityType.CACHE_CLEAR,
                f"Lỗi xóa cache: {str(e)}",
                metadata={"error": str(e), "success": False}
            )
            raise e
    
    def clear_all_invalid_cache(self):
        """Xóa cache không hợp lệ"""
        try:
            print("Đang xóa cache không hợp lệ...")
            
            # Lấy danh sách cache IDs không hợp lệ
            invalid_caches = list(self.text_cache_collection.find(
                {"validityStatus": "invalid"}, 
                {"cacheId": 1}
            ))
            invalid_cache_ids = [cache["cacheId"] for cache in invalid_caches if "cacheId" in cache]
            
            print(f"Tìm thấy {len(invalid_cache_ids)} cache không hợp lệ")
            
            # Xóa trong MongoDB
            result = self.text_cache_collection.delete_many({"validityStatus": "invalid"})
            deleted_count = result.deleted_count
            print(f"Đã xóa {deleted_count} cache không hợp lệ trong MongoDB")
            
            # Xóa trong ChromaDB
            if invalid_cache_ids:
                try:
                    cache_collection = self.chroma.get_cache_collection()
                    if cache_collection:
                        cache_collection.delete(ids=invalid_cache_ids)
                        print(f"Đã xóa {len(invalid_cache_ids)} cache không hợp lệ trong ChromaDB")
                except Exception as ce:
                    print(f"Lỗi xóa ChromaDB invalid cache: {str(ce)}")
            
            # Log activity
            activity_service.log_activity(
                ActivityType.CACHE_CLEAR,
                f"Đã xóa cache không hợp lệ: {deleted_count} entries",
                metadata={
                    "deleted_count": deleted_count,
                    "invalid_cache_ids": invalid_cache_ids,
                    "action": "clear_invalid_cache"
                }
            )
            
            return deleted_count
            
        except Exception as e:
            print(f"Lỗi xóa cache không hợp lệ: {str(e)}")
            activity_service.log_activity(
                ActivityType.CACHE_CLEAR,
                f"Lỗi xóa cache không hợp lệ: {str(e)}",
                metadata={"error": str(e), "success": False}
            )
            raise e
    
    def get_cache_stats(self):
        """Lấy thống kê cache"""
        try:
            total_count = self.text_cache_collection.count_documents({})
            valid_count = self.text_cache_collection.count_documents({"validityStatus": CacheStatus.VALID})
            invalid_count = self.text_cache_collection.count_documents({"validityStatus": CacheStatus.INVALID})
            
            # Tính hit rate
            hits_sum = 0
            try:
                pipeline = [{"$group": {"_id": None, "totalHits": {"$sum": "$hitCount"}}}]
                result = list(self.text_cache_collection.aggregate(pipeline))
                if result:
                    hits_sum = result[0]["totalHits"]
            except Exception as e:
                print(f"Lỗi tính hitCount: {str(e)}")
            
            hit_rate = 0
            if total_count > 0 and hits_sum > 0:
                hit_rate = hits_sum / (hits_sum + total_count)
            
            return {
                "total_count": total_count,
                "valid_count": valid_count,
                "invalid_count": invalid_count,
                "hit_rate": hit_rate
            }
            
        except Exception as e:
            print(f"Lỗi lấy cache stats: {str(e)}")
            return {
                "total_count": 0,
                "valid_count": 0,
                "invalid_count": 0,
                "hit_rate": 0,
                "error": str(e)
            }
    
    def get_stats(self) -> Dict[str, Any]:
        """Lấy thống kê của hybrid system"""
        try:
            es_stats = self.es_client.get_index_stats()
            cache_stats = self.get_cache_stats()
            
            return {
                "elasticsearch": es_stats,
                "cache_system": cache_stats,
                "hybrid_config": {
                    "elastic_weight": self.elastic_weight,
                    "vector_weight": self.vector_weight,
                    "top_k": TOP_K,
                    "embedding_model": EMBEDDING_MODEL_NAME
                }
            }
        except Exception as e:
            return {"error": str(e)}
            
    def delete_expired_cache(self):
        """Xóa tất cả cache đã hết hạn"""
        try:
            print("Đang xóa cache đã hết hạn...")
            now = datetime.now()
            
            # Tìm cache đã hết hạn
            expired_caches = list(self.text_cache_collection.find(
                {"expiresAt": {"$lt": now}},
                {"cacheId": 1}
            ))
            expired_cache_ids = [cache["cacheId"] for cache in expired_caches if "cacheId" in cache]
            
            print(f"Tìm thấy {len(expired_cache_ids)} cache đã hết hạn")
            
            # Xóa trong MongoDB
            result = self.text_cache_collection.delete_many({"expiresAt": {"$lt": now}})
            deleted_count = result.deleted_count
            
            # Xóa trong ChromaDB
            if expired_cache_ids:
                try:
                    cache_collection = self.chroma.get_cache_collection()
                    if cache_collection:
                        cache_collection.delete(ids=expired_cache_ids)
                        print(f"Đã xóa {len(expired_cache_ids)} expired cache trong ChromaDB")
                except Exception as e:
                    print(f"Lỗi xóa expired cache trong ChromaDB: {str(e)}")
            
            print(f"Đã xóa {deleted_count} cache entries đã hết hạn")
            return deleted_count
            
        except Exception as e:
            print(f"Lỗi xóa expired cache: {str(e)}")
            raise e

    def search_keyword(self, keyword, limit=10):
        """Tìm kiếm cache bằng từ khóa"""
        try:
            print(f"Tìm kiếm cache với từ khóa: '{keyword}'")
            
            # Tìm kiếm bằng text search và keyword matching
            results = []
            
            # Method 1: Text search nếu có text index
            try:
                text_results = list(self.text_cache_collection.find(
                    {"$text": {"$search": keyword}, "validityStatus": CacheStatus.VALID},
                    {"score": {"$meta": "textScore"}}
                ).sort([("score", {"$meta": "textScore"})]).limit(limit))
                results.extend(text_results)
            except Exception as e:
                print(f"Text search không khả dụng: {str(e)}")
            
            # Method 2: Regex search nếu text search không hoạt động
            if not results:
                regex_pattern = {"$regex": keyword, "$options": "i"}
                regex_results = list(self.text_cache_collection.find({
                    "$or": [
                        {"questionText": regex_pattern},
                        {"normalizedQuestion": regex_pattern},
                        {"keywords": {"$in": [keyword.lower()]}}
                    ],
                    "validityStatus": CacheStatus.VALID
                }).limit(limit))
                results.extend(regex_results)
            
            # Method 3: Keyword array search
            if not results:
                keyword_results = list(self.text_cache_collection.find({
                    "keywords": {"$in": [keyword.lower()]},
                    "validityStatus": CacheStatus.VALID
                }).limit(limit))
                results.extend(keyword_results)
            
            print(f"Tìm thấy {len(results)} cache entries cho từ khóa '{keyword}'")
            return results
            
        except Exception as e:
            print(f"Lỗi tìm kiếm cache: {str(e)}")
            return []

# Singleton instance
retrieval_service = RetrievalService()