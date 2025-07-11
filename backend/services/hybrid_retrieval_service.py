import time
import numpy as np
from typing import List, Dict, Any, Tuple
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import ES_CONFIG, TOP_K
from database.elasticsearch_client import elasticsearch_client
from services.retrieval_service import retrieval_service

class HybridRetrievalService:
    def __init__(self):
        """Khởi tạo hybrid retrieval sử dụng cả Elasticsearch và Vector search"""
        self.es_client = elasticsearch_client
        self.vector_service = retrieval_service
        self.elastic_weight = ES_CONFIG.ELASTIC_WEIGHT
        self.vector_weight = ES_CONFIG.VECTOR_WEIGHT
        
        print(f"🔄 Hybrid Retrieval initialized: ES({self.elastic_weight}) + Vector({self.vector_weight})")

    def _normalize_scores(self, scores: List[float]) -> List[float]:
        """Chuẩn hóa scores về range [0, 1]"""
        if not scores:
            return []
        
        scores = np.array(scores)
        min_score = scores.min()
        max_score = scores.max()
        
        if max_score == min_score:
            return [1.0] * len(scores)
        
        normalized = (scores - min_score) / (max_score - min_score)
        return normalized.tolist()

    def _merge_results(self, elastic_results: List[Dict], vector_results: List[Dict], 
                      top_k: int = TOP_K) -> List[Dict]:
        """Merge và rank kết quả từ cả hai sources"""
        
        # Tạo mapping từ chunk_id đến kết quả
        elastic_map = {result["chunk_id"]: result for result in elastic_results}
        vector_map = {result["chunk_id"]: result for result in vector_results}
        
        # Lấy tất cả unique chunk_ids
        all_chunk_ids = set(elastic_map.keys()) | set(vector_map.keys())
        
        # Chuẩn hóa scores
        elastic_scores = [result.get("score", 0) for result in elastic_results]
        vector_scores = [result.get("score", 0) for result in vector_results]
        
        norm_elastic_scores = self._normalize_scores(elastic_scores)
        norm_vector_scores = self._normalize_scores(vector_scores)
        
        # Tạo mapping normalized scores
        elastic_norm_map = {elastic_results[i]["chunk_id"]: norm_elastic_scores[i] 
                           for i in range(len(elastic_results))}
        vector_norm_map = {vector_results[i]["chunk_id"]: norm_vector_scores[i] 
                          for i in range(len(vector_results))}
        
        # Tính hybrid scores
        merged_results = []
        for chunk_id in all_chunk_ids:
            elastic_score = elastic_norm_map.get(chunk_id, 0)
            vector_score = vector_norm_map.get(chunk_id, 0)
            
            # Hybrid score với trọng số
            hybrid_score = (self.elastic_weight * elastic_score + 
                           self.vector_weight * vector_score)
            
            # Lấy thông tin từ source có score cao hơn
            if elastic_score >= vector_score and chunk_id in elastic_map:
                result = elastic_map[chunk_id].copy()
                result["search_method"] = "elasticsearch"
            elif chunk_id in vector_map:
                result = vector_map[chunk_id].copy()
                result["search_method"] = "vector"
            else:
                continue  # Skip nếu không có data
            
            result["hybrid_score"] = hybrid_score
            result["elastic_score"] = elastic_score
            result["vector_score"] = vector_score
            
            merged_results.append(result)
        
        # Sort theo hybrid score và trả về top_k
        merged_results.sort(key=lambda x: x["hybrid_score"], reverse=True)
        return merged_results[:top_k]

    def search(self, query: str, use_cache: bool = True, top_k: int = TOP_K) -> Dict[str, Any]:
        """Thực hiện hybrid search"""
        start_time = time.time()
        
        print(f"🔍 Hybrid search: '{query}' (top_k={top_k})")
        
        try:
            # 1. Kiểm tra cache trước (từ vector service)
            if use_cache:
                cache_result = self.vector_service._check_cache(query)
                if cache_result:
                    print("✅ Cache hit - trả về từ cache")
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
            
            # 2. Elasticsearch search
            elastic_start = time.time()
            elastic_response = self.es_client.search_documents(
                query=query, 
                size=top_k * 2  # Lấy nhiều hơn để merge
            )
            elastic_time = time.time() - elastic_start
            
            # 3. Vector search
            vector_start = time.time()
            vector_response = self.vector_service.retrieve(query, use_cache=False)
            vector_time = time.time() - vector_start
            
            # 4. Chuẩn bị dữ liệu cho merge
            elastic_results = []
            for hit in elastic_response.get("hits", []):
                elastic_results.append({
                    "chunk_id": hit["chunk_id"],
                    "score": hit["score"],
                    "metadata": hit["source"],
                    "highlights": hit.get("highlights", {})
                })
            
            vector_results = []
            vector_chunks = vector_response.get("retrieved_chunks", [])
            vector_scores = vector_response.get("relevance_scores", {})
            
            for chunk_id in vector_chunks:
                vector_results.append({
                    "chunk_id": chunk_id,
                    "score": vector_scores.get(chunk_id, 0.5),
                    "metadata": {},
                    "highlights": {}
                })
            
            # 5. Merge results
            merged_results = self._merge_results(elastic_results, vector_results, top_k)
            
            # 6. Format output
            context_items = []
            retrieved_chunks = []
            relevance_scores = {}
            
            for result in merged_results:
                chunk_id = result["chunk_id"]
                retrieved_chunks.append(chunk_id)
                relevance_scores[chunk_id] = result["hybrid_score"]
                
                # Tạo context text (cần lấy từ ChromaDB hoặc ES)
                if result["search_method"] == "elasticsearch":
                    # Lấy full content từ ES hoặc ChromaDB
                    context_text = f"[Elasticsearch] {result['metadata'].get('content_summary', '')}"
                else:
                    context_text = f"[Vector] Chunk {chunk_id}"
                
                context_items.append(context_text)
            
            total_time = time.time() - start_time
            
            print(f"🎯 Hybrid search completed:")
            print(f"   - Elasticsearch: {len(elastic_results)} results ({elastic_time:.3f}s)")
            print(f"   - Vector search: {len(vector_results)} results ({vector_time:.3f}s)")
            print(f"   - Merged: {len(merged_results)} results")
            print(f"   - Total time: {total_time:.3f}s")
            
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
                    "elastic_time": elastic_time,
                    "vector_time": vector_time
                }
            }
            
        except Exception as e:
            print(f"❌ Lỗi hybrid search: {str(e)}")
            # Fallback về vector search
            print("🔄 Fallback to vector search only")
            return self.vector_service.retrieve(query, use_cache=use_cache)

    def index_document_to_elasticsearch(self, doc_id: str, chunks_data: List[Dict]) -> bool:
        """Index document chunks vào Elasticsearch"""
        try:
            print(f"📥 Indexing document {doc_id} to Elasticsearch...")
            
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
                print(f"✅ Indexed {len(es_documents)} chunks to Elasticsearch")
            else:
                print(f"❌ Failed to index to Elasticsearch")
                
            return success
            
        except Exception as e:
            print(f"❌ Error indexing to Elasticsearch: {str(e)}")
            return False

    def delete_document_from_elasticsearch(self, doc_id: str) -> bool:
        """Xóa document khỏi Elasticsearch"""
        try:
            success = self.es_client.delete_documents_by_doc_id(doc_id)
            if success:
                print(f"✅ Deleted document {doc_id} from Elasticsearch")
            return success
        except Exception as e:
            print(f"❌ Error deleting from Elasticsearch: {str(e)}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Lấy thống kê của hybrid system"""
        try:
            es_stats = self.es_client.get_index_stats()
            vector_stats = self.vector_service.get_cache_stats()
            
            return {
                "elasticsearch": es_stats,
                "vector_search": vector_stats,
                "hybrid_config": {
                    "elastic_weight": self.elastic_weight,
                    "vector_weight": self.vector_weight,
                    "top_k": TOP_K
                }
            }
        except Exception as e:
            return {"error": str(e)}

# Singleton instance
hybrid_retrieval_service = HybridRetrievalService()