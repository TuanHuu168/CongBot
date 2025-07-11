import os
import json
import sys
from typing import List, Dict, Any, Optional
import numpy as np
np.float_ = np.float64

from elasticsearch import Elasticsearch

from elasticsearch.exceptions import ConnectionError, NotFoundError
from urllib.parse import urlparse

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import ES_CONFIG

class ElasticsearchClient:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ElasticsearchClient, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.client = None
            self.index_name = "legal_documents"
            self._initialized = True
            self.initialize()

    def initialize(self):
        """Khởi tạo Elasticsearch client cho Bonsai"""
        if self.client is not None:
            return
            
        try:
            # Parse Bonsai URL
            bonsai_url = ES_CONFIG.BONSAI_URL
            parsed_url = urlparse(bonsai_url)
            
            # Tạo kết nối với Bonsai
            self.client = Elasticsearch(
                hosts=[{
                    'host': parsed_url.hostname,
                    'port': parsed_url.port or 443,
                    'use_ssl': True,
                    'verify_certs': True,
                    'ssl_show_warn': False
                }],
                http_auth=(parsed_url.username, parsed_url.password),
                timeout=30,
                max_retries=3,
                retry_on_timeout=True
            )
            
            # Test kết nối
            if self.client.ping():
                print(f"✅ Đã kết nối thành công với Bonsai Elasticsearch")
                self._create_index_if_not_exists()
            else:
                print("❌ Không thể kết nối với Bonsai Elasticsearch")
                self.client = None
                
        except Exception as e:
            print(f"❌ Lỗi kết nối Bonsai Elasticsearch: {str(e)}")
            self.client = None

    def _create_index_if_not_exists(self):
        """Tạo index nếu chưa tồn tại"""
        try:
            if not self.client.indices.exists(index=self.index_name):
                # Mapping cho legal documents
                mapping = {
                    "mappings": {
                        "properties": {
                            "chunk_id": {"type": "keyword"},
                            "doc_id": {"type": "keyword"},
                            "doc_type": {"type": "keyword"},
                            "doc_title": {"type": "text", "analyzer": "vietnamese"},
                            "content": {
                                "type": "text", 
                                "analyzer": "vietnamese",
                                "search_analyzer": "vietnamese"
                            },
                            "content_summary": {"type": "text", "analyzer": "vietnamese"},
                            "effective_date": {"type": "date", "format": "dd-MM-yyyy||yyyy-MM-dd"},
                            "status": {"type": "keyword"},
                            "document_scope": {"type": "keyword"},
                            "chunk_type": {"type": "keyword"},
                            "chunk_index": {"type": "integer"},
                            "total_chunks": {"type": "integer"},
                            "keywords": {"type": "keyword"},
                            "created_at": {"type": "date"}
                        }
                    },
                    "settings": {
                        "analysis": {
                            "analyzer": {
                                "vietnamese": {
                                    "tokenizer": "standard",
                                    "filter": ["lowercase", "stop"]
                                }
                            }
                        },
                        "number_of_shards": 1,
                        "number_of_replicas": 0
                    }
                }
                
                self.client.indices.create(index=self.index_name, body=mapping)
                print(f"✅ Đã tạo index '{self.index_name}' trong Elasticsearch")
            else:
                print(f"✅ Index '{self.index_name}' đã tồn tại")
                
        except Exception as e:
            print(f"❌ Lỗi tạo index: {str(e)}")

    def get_client(self):
        """Lấy Elasticsearch client"""
        if not self.client:
            self.initialize()
        return self.client

    def index_document(self, doc_id: str, document: Dict[str, Any]) -> bool:
        """Index một document vào Elasticsearch"""
        try:
            if not self.client:
                return False
                
            response = self.client.index(
                index=self.index_name,
                id=doc_id,
                body=document
            )
            return response.get('result') in ['created', 'updated']
            
        except Exception as e:
            print(f"❌ Lỗi index document {doc_id}: {str(e)}")
            return False

    def bulk_index_documents(self, documents: List[Dict[str, Any]]) -> bool:
        """Bulk index nhiều documents"""
        try:
            if not self.client or not documents:
                return False
                
            from elasticsearch.helpers import bulk
            
            # Chuẩn bị bulk data
            bulk_data = []
            for doc in documents:
                bulk_data.append({
                    "_index": self.index_name,
                    "_id": doc.get("chunk_id"),
                    "_source": doc
                })
            
            # Thực hiện bulk index
            success_count, failed_items = bulk(
                self.client,
                bulk_data,
                chunk_size=100,
                request_timeout=60
            )
            
            print(f"✅ Bulk index: {success_count} thành công, {len(failed_items)} thất bại")
            return len(failed_items) == 0
            
        except Exception as e:
            print(f"❌ Lỗi bulk index: {str(e)}")
            return False

    def search_documents(self, query: str, size: int = 10, filters: Dict = None) -> Dict[str, Any]:
        """Tìm kiếm documents với BM25 scoring"""
        try:
            if not self.client:
                return {"hits": [], "total": 0}
            
            # Xây dựng query
            search_query = {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": ["content^2", "doc_title^1.5", "content_summary"],
                                    "type": "best_fields",
                                    "fuzziness": "AUTO"
                                }
                            }
                        ]
                    }
                },
                "size": size,
                "_source": {
                    "excludes": ["content"]  # Không trả về full content để tối ưu
                },
                "highlight": {
                    "fields": {
                        "content": {},
                        "doc_title": {}
                    }
                }
            }
            
            # Thêm filters nếu có
            if filters:
                filter_clauses = []
                for field, value in filters.items():
                    if isinstance(value, list):
                        filter_clauses.append({"terms": {field: value}})
                    else:
                        filter_clauses.append({"term": {field: value}})
                
                if filter_clauses:
                    search_query["query"]["bool"]["filter"] = filter_clauses
            
            # Thực hiện search
            response = self.client.search(
                index=self.index_name,
                body=search_query
            )
            
            # Format kết quả
            hits = []
            for hit in response["hits"]["hits"]:
                result = {
                    "chunk_id": hit["_id"],
                    "score": hit["_score"],
                    "source": hit["_source"],
                    "highlights": hit.get("highlight", {})
                }
                hits.append(result)
            
            return {
                "hits": hits,
                "total": response["hits"]["total"]["value"],
                "max_score": response["hits"]["max_score"]
            }
            
        except Exception as e:
            print(f"❌ Lỗi search Elasticsearch: {str(e)}")
            return {"hits": [], "total": 0}

    def get_document_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Lấy document theo ID"""
        try:
            if not self.client:
                return None
                
            response = self.client.get(
                index=self.index_name,
                id=doc_id
            )
            return response["_source"]
            
        except NotFoundError:
            return None
        except Exception as e:
            print(f"❌ Lỗi get document {doc_id}: {str(e)}")
            return None

    def delete_documents_by_doc_id(self, doc_id: str) -> bool:
        """Xóa tất cả chunks của một document"""
        try:
            if not self.client:
                return False
                
            query = {
                "query": {
                    "term": {"doc_id": doc_id}
                }
            }
            
            response = self.client.delete_by_query(
                index=self.index_name,
                body=query
            )
            
            deleted_count = response.get("deleted", 0)
            print(f"✅ Đã xóa {deleted_count} chunks của document {doc_id}")
            return deleted_count > 0
            
        except Exception as e:
            print(f"❌ Lỗi xóa document {doc_id}: {str(e)}")
            return False

    def get_index_stats(self) -> Dict[str, Any]:
        """Lấy thống kê index"""
        try:
            if not self.client:
                return {}
                
            stats = self.client.indices.stats(index=self.index_name)
            return {
                "document_count": stats["indices"][self.index_name]["total"]["docs"]["count"],
                "index_size": stats["indices"][self.index_name]["total"]["store"]["size_in_bytes"],
                "status": "connected"
            }
            
        except Exception as e:
            print(f"❌ Lỗi lấy stats: {str(e)}")
            return {"status": "disconnected", "error": str(e)}

    def health_check(self) -> Dict[str, Any]:
        """Kiểm tra tình trạng Elasticsearch"""
        try:
            if not self.client:
                return {"status": "disconnected", "error": "Client not initialized"}
                
            # Ping cluster
            if not self.client.ping():
                return {"status": "disconnected", "error": "Ping failed"}
            
            # Lấy cluster health
            health = self.client.cluster.health()
            index_stats = self.get_index_stats()
            
            return {
                "status": "connected",
                "cluster_status": health["status"],
                "cluster_name": health["cluster_name"],
                "number_of_nodes": health["number_of_nodes"],
                "index_stats": index_stats
            }
            
        except Exception as e:
            return {"status": "error", "error": str(e)}

# Singleton instance
elasticsearch_client = ElasticsearchClient()

def get_elasticsearch_client():
    """Hàm helper để lấy Elasticsearch client"""
    return elasticsearch_client