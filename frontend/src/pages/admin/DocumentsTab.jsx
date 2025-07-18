import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Trash2, Upload, FileText, Eye, Calendar, FileSymlink, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle, FolderOpen, File, FileImage, Brain, ChevronDown, ChevronUp, Shield, ShieldAlert, Info, Zap, Settings, PlayCircle, SkipForward } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatDate } from '../../utils/formatUtils';
import { getApiBaseUrl } from '../../apiService';
import axios from 'axios';

const DocumentsTab = ({
    documents,
    isLoading,
    documentFilter,
    setDocumentFilter,
    handleDeleteDocument
}) => {
    // State cho tab chính
    const [activeMainTab, setActiveMainTab] = useState('upload');

    // State cho upload modes
    const [uploadMode, setUploadMode] = useState('manual');

    // State cho auto processing (PDF/Word)
    const [documentFile, setDocumentFile] = useState(null);
    const [documentProcessingId, setDocumentProcessingId] = useState(null);
    const [documentProcessingStatus, setDocumentProcessingStatus] = useState(null);
    const [isProcessingDocument, setIsProcessingDocument] = useState(false);

    // State cho metadata của cả 2 mode
    const [uploadMetadata, setUploadMetadata] = useState({
        doc_id: '',
        doc_type: 'Thông tư',
        doc_title: '',
        effective_date: '',
        document_scope: 'Quốc gia'
    });

    // State cho manual mode - upload folder
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [folderFiles, setFolderFiles] = useState([]);
    const [folderMetadata, setFolderMetadata] = useState(null);
    const [isUploadingManual, setIsUploadingManual] = useState(false);

    // State cho chunk info tab
    const [selectedDocForChunks, setSelectedDocForChunks] = useState(null);
    const [chunkInfo, setChunkInfo] = useState(null);
    const [loadingChunks, setLoadingChunks] = useState(false);

    // State cho related chunks analysis
    const [relatedChunksInfo, setRelatedChunksInfo] = useState(null);
    const [loadingRelatedChunks, setLoadingRelatedChunks] = useState(false);
    const [llmAnalysisResult, setLlmAnalysisResult] = useState(null);
    const [isAnalyzingWithLLM, setIsAnalyzingWithLLM] = useState(false);
    const [chunksToInvalidate, setChunksToInvalidate] = useState([]);
    const [isInvalidatingChunks, setIsInvalidatingChunks] = useState(false);
    const [showRelatedChunksPanel, setShowRelatedChunksPanel] = useState(false);

    // State cho system relationship scan
    const [systemRelationshipDocs, setSystemRelationshipDocs] = useState([]);
    const [isScanningSystem, setIsScanningSystem] = useState(false);
    const [currentProcessingDoc, setCurrentProcessingDoc] = useState(null);
    const [currentDocIndex, setCurrentDocIndex] = useState(0);

    const API_BASE_URL = getApiBaseUrl();

    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    // Theo dõi trạng thái xử lý tài liệu
    useEffect(() => {
        let interval;
        if (documentProcessingId && isProcessingDocument) {
            interval = setInterval(async () => {
                try {
                    const response = await axios.get(`${API_BASE_URL}/document-processing-status/${documentProcessingId}`);
                    const status = response.data;

                    setDocumentProcessingStatus(status);

                    if (status.status === 'completed' || status.status === 'failed') {
                        setIsProcessingDocument(false);
                        clearInterval(interval);

                        if (status.status === 'completed') {
                            const result = status.result;
                            const metadata = result?.metadata;
                            const autoDetected = result?.auto_detected;

                            if (metadata || autoDetected) {
                                console.log('Tự động điền metadata từ kết quả Gemini:', { metadata, autoDetected });
                                setUploadMetadata({
                                    doc_id: autoDetected?.doc_id || metadata?.doc_id || '',
                                    doc_type: autoDetected?.doc_type || metadata?.doc_type || 'Thông tư',
                                    doc_title: autoDetected?.doc_title || metadata?.doc_title || '',
                                    effective_date: autoDetected?.effective_date || metadata?.effective_date || '',
                                    document_scope: metadata?.document_scope || 'Quốc gia'
                                });
                            }

                            // Kiểm tra và xử lý related documents
                            const relatedDocuments = metadata?.related_documents || [];
                            if (relatedDocuments.length > 0) {
                                console.log('Phát hiện related documents:', relatedDocuments);
                                await fetchRelatedChunksInfo(relatedDocuments);
                                setShowRelatedChunksPanel(true);
                            }

                            const fileType = status.file_type?.toUpperCase() || 'TÀI LIỆU';
                            const fileName = status.original_filename || 'file';

                            Swal.fire({
                                title: `Phân tích ${fileType} hoàn thành`,
                                html: `
                                    <div class="text-left">
                                        <p><strong>Tệp:</strong> ${fileName}</p>
                                        <p><strong>Kết quả:</strong> ${status.message}</p>
                                        <p><strong>Số chunk:</strong> ${status.result?.chunks_count || 0}</p>
                                        <p><strong>Văn bản liên quan:</strong> ${status.result?.related_documents_count || 0}</p>
                                        <div class="mt-2 p-2 bg-blue-50 rounded">
                                            <p class="text-sm font-medium text-blue-700">Thông tin được phát hiện tự động:</p>
                                            <p class="text-xs text-blue-600">Mã văn bản: ${autoDetected?.doc_id || 'Không xác định'}</p>
                                            <p class="text-xs text-blue-600">Loại: ${autoDetected?.doc_type || 'Không xác định'}</p>
                                            <p class="text-xs text-blue-600">Ngày hiệu lực: ${autoDetected?.effective_date || 'Không xác định'}</p>
                                        </div>
                                        ${relatedDocuments.length > 0 ?
                                        `<p class="text-sm text-orange-600 mt-2">⚠️ Phát hiện ${relatedDocuments.length} văn bản liên quan. Vui lòng kiểm tra phần "Phân tích văn bản liên quan" bên dưới.</p>`
                                        : ''}
                                        <p class="text-sm text-gray-600 mt-2">Thông tin đã được tự động điền vào biểu mẫu. Vui lòng kiểm tra và phê duyệt nếu hài lòng.</p>
                                    </div>
                                `,
                                icon: 'success',
                                confirmButtonColor: '#10b981'
                            });
                        } else {
                            Swal.fire({
                                title: `Lỗi phân tích ${status.file_type?.toUpperCase() || 'tài liệu'}`,
                                text: status.message || 'Có lỗi xảy ra trong quá trình phân tích',
                                icon: 'error',
                                confirmButtonColor: '#10b981'
                            });
                        }
                    }
                } catch (error) {
                    console.error('Lỗi khi kiểm tra trạng thái xử lý tài liệu:', error);
                }
            }, 2000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [documentProcessingId, isProcessingDocument, API_BASE_URL]);

    // Reset state khi chuyển mode
    useEffect(() => {
        if (uploadMode === 'manual') {
            setDocumentFile(null);
            setDocumentProcessingId(null);
            setDocumentProcessingStatus(null);
            setIsProcessingDocument(false);
        } else {
            setSelectedFolder(null);
            setFolderFiles([]);
            setFolderMetadata(null);
        }

        setUploadMetadata({
            doc_id: '',
            doc_type: 'Thông tư',
            doc_title: '',
            effective_date: '',
            document_scope: 'Quốc gia'
        });

        // Reset related chunks state
        setRelatedChunksInfo(null);
        setLlmAnalysisResult(null);
        setChunksToInvalidate([]);
        setShowRelatedChunksPanel(false);
    }, [uploadMode]);

    // Reset khi chuyển tab
    useEffect(() => {
        if (activeMainTab !== 'upload') {
            // Reset system scan state khi không ở upload tab
            setSystemRelationshipDocs([]);
            setCurrentProcessingDoc(null);
            setCurrentDocIndex(0);
            setRelatedChunksInfo(null);
            setLlmAnalysisResult(null);
            setChunksToInvalidate([]);
            setShowRelatedChunksPanel(false);
        }
    }, [activeMainTab]);

    // Lấy thông tin chunks của document
    const fetchChunkInfo = async (docId) => {
        try {
            setLoadingChunks(true);
            const response = await axios.get(`${API_BASE_URL}/documents/${docId}/chunks`);
            setChunkInfo(response.data);
        } catch (error) {
            console.error('Lỗi khi tải thông tin chunks:', error);
            Swal.fire({
                title: 'Lỗi',
                text: 'Không thể tải thông tin chunks',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        } finally {
            setLoadingChunks(false);
        }
    };

    // Lấy thông tin chunks liên quan từ related documents
    const fetchRelatedChunksInfo = async (relatedDocuments) => {
        try {
            setLoadingRelatedChunks(true);
            console.log('Đang fetch thông tin chunks liên quan cho:', relatedDocuments);

            const relatedChunksData = [];

            for (const relatedDoc of relatedDocuments) {
                const docId = relatedDoc.doc_id;
                try {
                    // Tìm chunks trong ChromaDB dựa trên doc_id
                    const response = await axios.post(`${API_BASE_URL}/search-related-chunks`, {
                        doc_id: docId,
                        relationship: relatedDoc.relationship,
                        description: relatedDoc.description
                    });

                    if (response.data.chunks && response.data.chunks.length > 0) {
                        relatedChunksData.push({
                            doc_id: docId,
                            relationship: relatedDoc.relationship,
                            description: relatedDoc.description,
                            chunks: response.data.chunks,
                            exists_in_db: true
                        });
                    } else {
                        relatedChunksData.push({
                            doc_id: docId,
                            relationship: relatedDoc.relationship,
                            description: relatedDoc.description,
                            chunks: [],
                            exists_in_db: false
                        });
                    }
                } catch (error) {
                    console.error(`Lỗi khi tìm chunks cho ${docId}:`, error);
                    relatedChunksData.push({
                        doc_id: docId,
                        relationship: relatedDoc.relationship,
                        description: relatedDoc.description,
                        chunks: [],
                        exists_in_db: false,
                        error: error.message
                    });
                }
            }

            setRelatedChunksInfo(relatedChunksData);
            console.log('Thông tin chunks liên quan:', relatedChunksData);

        } catch (error) {
            console.error('Lỗi khi fetch thông tin chunks liên quan:', error);
        } finally {
            setLoadingRelatedChunks(false);
        }
    };

    // Gọi LLM phân tích chunks cần vô hiệu hóa
    const analyzeChunksWithLLM = async () => {
        if (!relatedChunksInfo || !currentProcessingDoc) {
            return;
        }

        try {
            setIsAnalyzingWithLLM(true);
            console.log('Bắt đầu phân tích với LLM...');

            // Chuẩn bị dữ liệu cho LLM
            const newDocumentContent = currentProcessingDoc.metadata;
            const existingChunks = relatedChunksInfo
                .filter(item => item.exists_in_db && item.chunks.length > 0)
                .flatMap(item => item.chunks);

            const analysisData = {
                new_document: {
                    doc_id: newDocumentContent.doc_id,
                    doc_type: newDocumentContent.doc_type,
                    doc_title: newDocumentContent.doc_title,
                    effective_date: newDocumentContent.effective_date,
                    chunks: newDocumentContent.chunks,
                    related_documents: currentProcessingDoc.related_documents
                },
                existing_chunks: existingChunks,
                analysis_type: 'invalidation_check'
            };

            const response = await axios.post(`${API_BASE_URL}/analyze-chunks-for-invalidation`, analysisData);

            setLlmAnalysisResult(response.data);
            setChunksToInvalidate(response.data.chunks_to_invalidate || []);

            console.log('Kết quả phân tích LLM:', response.data);

            Swal.fire({
                title: 'Phân tích hoàn thành',
                html: `
                    <div class="text-left">
                        <p><strong>LLM đã phân tích:</strong></p>
                        <p>• Tổng chunks được kiểm tra: ${existingChunks.length}</p>
                        <p>• Chunks cần vô hiệu hóa: ${response.data.chunks_to_invalidate?.length || 0}</p>
                        <p class="text-sm text-gray-600 mt-2">Vui lòng xem kết quả chi tiết bên dưới.</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonColor: '#10b981'
            });

        } catch (error) {
            console.error('Lỗi khi phân tích với LLM:', error);
            Swal.fire({
                title: 'Lỗi phân tích',
                text: error.response?.data?.detail || 'Không thể phân tích với LLM',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        } finally {
            setIsAnalyzingWithLLM(false);
        }
    };

    // Thực hiện vô hiệu hóa chunks
    const executeChunkInvalidation = async () => {
        if (chunksToInvalidate.length === 0) {
            Swal.fire({
                title: 'Không có chunks để vô hiệu hóa',
                text: 'Danh sách chunks cần vô hiệu hóa đang trống.',
                icon: 'warning',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        const confirmResult = await Swal.fire({
            title: 'Xác nhận vô hiệu hóa',
            html: `
                <div class="text-left">
                    <p>Bạn có chắc chắn muốn vô hiệu hóa <strong>${chunksToInvalidate.length}</strong> chunks?</p>
                    <p class="text-sm text-gray-600 mt-2">Hành động này sẽ:</p>
                    <ul class="text-sm text-gray-600 list-disc list-inside mt-1">
                        <li>Vô hiệu hóa cache liên quan trong MongoDB</li>
                        <li>Cập nhật validity status trong ChromaDB</li>
                        <li>Không thể hoàn tác</li>
                    </ul>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Vô hiệu hóa',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280'
        });

        if (!confirmResult.isConfirmed) return;

        try {
            setIsInvalidatingChunks(true);
            console.log('Bắt đầu vô hiệu hóa chunks:', chunksToInvalidate);

            const response = await axios.post(`${API_BASE_URL}/invalidate-chunks`, {
                chunk_ids: chunksToInvalidate.map(c => c.chunk_id),
                reason: 'Superseded by new document from system scan',
                new_document_id: currentProcessingDoc?.doc_id
            });

            Swal.fire({
                title: 'Vô hiệu hóa thành công',
                html: `
                    <div class="text-left">
                        <p><strong>Đã vô hiệu hóa:</strong></p>
                        <p>• ${response.data.invalidated_cache_count} cache entries</p>
                        <p>• ${response.data.invalidated_chunks_count} chunks</p>
                        <p class="text-sm text-gray-600 mt-2">Hệ thống đã được cập nhật.</p>
                    </div>
                `,
                icon: 'success',
                confirmButtonColor: '#10b981'
            });

            // Reset related chunks state cho document hiện tại
            setRelatedChunksInfo(null);
            setLlmAnalysisResult(null);
            setChunksToInvalidate([]);
            setShowRelatedChunksPanel(false);

        } catch (error) {
            console.error('Lỗi khi vô hiệu hóa chunks:', error);
            Swal.fire({
                title: 'Lỗi vô hiệu hóa',
                text: error.response?.data?.detail || 'Không thể vô hiệu hóa chunks',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        } finally {
            setIsInvalidatingChunks(false);
        }
    };

    // Toggle chunk invalidation status
    const toggleChunkInvalidation = (chunkId) => {
        setChunksToInvalidate(prev => {
            const exists = prev.find(c => c.chunk_id === chunkId);
            if (exists) {
                return prev.filter(c => c.chunk_id !== chunkId);
            } else {
                // Tìm chunk info từ relatedChunksInfo
                const chunkInfo = relatedChunksInfo
                    .flatMap(item => item.chunks)
                    .find(chunk => chunk.chunk_id === chunkId);

                if (chunkInfo) {
                    return [...prev, chunkInfo];
                }
                return prev;
            }
        });
    };

    // Scan toàn bộ hệ thống tìm relationships
    const handleSystemRelationshipScan = async () => {
        const confirmResult = await Swal.fire({
            title: 'Scan mối quan hệ trong hệ thống',
            html: `
                <div class="text-left">
                    <p>Tính năng này sẽ:</p>
                    <ul class="list-disc list-inside mt-2 text-sm">
                        <li>Đọc metadata của tất cả documents</li>
                        <li>Tìm các mối quan hệ (replaces, amends, replaced_by, amended_by)</li>
                        <li>Đưa ra danh sách documents cần xử lý</li>
                        <li>Cho phép bạn xem và quyết định từng document một</li>
                    </ul>
                    <p class="text-gray-600 text-sm mt-2">Sau đó bạn có thể xử lý từng document để vô hiệu hóa chunks cần thiết.</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Bắt đầu scan',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#6b7280'
        });

        if (!confirmResult.isConfirmed) return;

        try {
            setIsScanningSystem(true);

            const response = await axios.post(`${API_BASE_URL}/scan-system-relationships`);

            setSystemRelationshipDocs(response.data.documents_with_relationships);
            setCurrentDocIndex(0);

            Swal.fire({
                title: 'Scan hoàn thành',
                html: `
                    <div class="text-left">
                        <p><strong>Kết quả scan:</strong></p>
                        <p>• Tổng documents: ${response.data.total_documents}</p>
                        <p>• Documents có relationships: ${response.data.documents_with_relationships.length}</p>
                        <p class="text-sm text-gray-600 mt-2">
                            ${response.data.documents_with_relationships.length > 0
                        ? 'Bạn có thể xem và xử lý từng document bên dưới.'
                        : 'Không có document nào cần xử lý.'
                    }
                        </p>
                    </div>
                `,
                icon: response.data.documents_with_relationships.length > 0 ? 'success' : 'info',
                confirmButtonColor: '#10b981'
            });

        } catch (error) {
            console.error('Lỗi khi scan hệ thống:', error);
            Swal.fire({
                title: 'Lỗi scan hệ thống',
                text: error.response?.data?.detail || 'Không thể scan hệ thống',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        } finally {
            setIsScanningSystem(false);
        }
    };

    // Xử lý document cụ thể từ system scan
    const handleProcessDocument = async (document, index) => {
        try {
            setCurrentProcessingDoc(document);
            setCurrentDocIndex(index);

            console.log(`Bắt đầu xử lý document ${document.doc_id}:`, document);

            const response = await axios.post(`${API_BASE_URL}/process-document-relationships`, {
                document_metadata: document.metadata,
                related_documents: document.related_documents
            });

            setRelatedChunksInfo(response.data.related_chunks_data);
            setShowRelatedChunksPanel(true);

            console.log('Kết quả xử lý document:', response.data);

        } catch (error) {
            console.error('Lỗi khi xử lý document:', error);
            Swal.fire({
                title: 'Lỗi xử lý document',
                text: error.response?.data?.detail || 'Không thể xử lý document',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        }
    };

    // Chuyển sang document tiếp theo
    const handleNextDocument = () => {
        if (currentDocIndex < systemRelationshipDocs.length - 1) {
            // Reset state trước khi chuyển
            setRelatedChunksInfo(null);
            setLlmAnalysisResult(null);
            setChunksToInvalidate([]);
            setShowRelatedChunksPanel(false);
            setCurrentProcessingDoc(null);

            // Chuyển sang document tiếp theo
            const nextIndex = currentDocIndex + 1;
            const nextDoc = systemRelationshipDocs[nextIndex];
            handleProcessDocument(nextDoc, nextIndex);
        }
    };

    // Bỏ qua document hiện tại
    const handleSkipDocument = () => {
        if (currentDocIndex < systemRelationshipDocs.length - 1) {
            handleNextDocument();
        } else {
            // Đã hết documents
            setSystemRelationshipDocs([]);
            setCurrentProcessingDoc(null);
            setCurrentDocIndex(0);
            setRelatedChunksInfo(null);
            setLlmAnalysisResult(null);
            setChunksToInvalidate([]);
            setShowRelatedChunksPanel(false);

            Swal.fire({
                title: 'Hoàn thành xử lý',
                text: 'Đã xử lý hết tất cả documents có relationships',
                icon: 'success',
                confirmButtonColor: '#10b981'
            });
        }
    };

    // Lấy icon tệp dựa trên extension
    const getFileIcon = (fileName) => {
        const extension = fileName?.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'pdf':
                return <FileImage size={16} className="text-red-500" />;
            case 'doc':
            case 'docx':
                return <FileText size={16} className="text-blue-500" />;
            case 'md':
                return <FileText size={16} className="text-green-500" />;
            default:
                return <File size={16} className="text-gray-500" />;
        }
    };

    // Render system relationship scan status
    const renderSystemRelationshipStatus = () => {
        if (systemRelationshipDocs.length === 0) return null;

        return (
            <motion.div
                className="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 overflow-hidden"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center">
                        <Settings size={20} className="mr-2" />
                        <h4 className="font-semibold">System Relationship Scan</h4>
                        <span className="ml-2 px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                            {currentDocIndex + 1}/{systemRelationshipDocs.length}
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            setSystemRelationshipDocs([]);
                            setCurrentProcessingDoc(null);
                            setCurrentDocIndex(0);
                            setRelatedChunksInfo(null);
                            setLlmAnalysisResult(null);
                            setChunksToInvalidate([]);
                            setShowRelatedChunksPanel(false);
                        }}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <XCircle size={16} />
                    </button>
                </div>

                <div className="p-5">
                    <div className="bg-white rounded-lg border border-purple-100 p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-gray-800">Documents cần xử lý</h5>
                            <span className="text-sm text-gray-600">{systemRelationshipDocs.length} documents</span>
                        </div>

                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {systemRelationshipDocs.map((doc, index) => (
                                <div
                                    key={doc.doc_id}
                                    className={`p-3 rounded-lg border transition-all cursor-pointer ${index === currentDocIndex
                                            ? 'border-purple-300 bg-purple-50'
                                            : index < currentDocIndex
                                                ? 'border-green-200 bg-green-50'
                                                : 'border-gray-200 bg-gray-50'
                                        }`}
                                    onClick={() => handleProcessDocument(doc, index)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${index === currentDocIndex
                                                        ? 'bg-purple-600 text-white'
                                                        : index < currentDocIndex
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-gray-400 text-white'
                                                    }`}>
                                                    {index < currentDocIndex ? '✓' : index + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-800 truncate">{String(doc.doc_id)}</p>
                                                    <p className="text-xs text-gray-600 truncate">{String(doc.doc_title || '')}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {doc.related_documents?.length || 0} relationships
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {index === currentDocIndex && (
                                            <PlayCircle size={16} className="text-purple-600 flex-shrink-0" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {currentProcessingDoc && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-800">
                                            Đang xử lý: {String(currentProcessingDoc.doc_id)}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {currentProcessingDoc.related_documents?.length || 0} văn bản liên quan
                                        </p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={handleSkipDocument}
                                            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors flex items-center"
                                        >
                                            <SkipForward size={14} className="mr-1" />
                                            Bỏ qua
                                        </button>
                                        {currentDocIndex < systemRelationshipDocs.length - 1 && (
                                            <button
                                                onClick={handleNextDocument}
                                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                                            >
                                                Tiếp theo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    };

    // Render phần phân tích văn bản liên quan
    const renderRelatedChunksAnalysis = () => {
        if (!showRelatedChunksPanel) return null;

        return (
            <motion.div
                className="mb-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 overflow-hidden"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center">
                        <Brain size={20} className="mr-2" />
                        <h4 className="font-semibold">Phân tích văn bản liên quan</h4>
                        <span className="ml-2 px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                            AI Assistant
                        </span>
                        {currentProcessingDoc && (
                            <span className="ml-2 px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                                {String(currentProcessingDoc.doc_id)}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setShowRelatedChunksPanel(false)}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <XCircle size={16} />
                    </button>
                </div>

                <div className="p-5">
                    {loadingRelatedChunks && (
                        <div className="flex items-center justify-center py-8">
                            <div className="flex items-center space-x-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-600"></div>
                                <span className="text-orange-700 font-medium">Đang tải thông tin chunks liên quan...</span>
                            </div>
                        </div>
                    )}

                    {relatedChunksInfo && !loadingRelatedChunks && (
                        <div className="space-y-4">
                            {/* Summary Card */}
                            <div className="bg-white rounded-lg border border-orange-100 p-4">
                                <div className="flex items-center mb-3">
                                    <Info size={16} className="text-orange-600 mr-2" />
                                    <h5 className="font-medium text-gray-800">Tóm tắt phân tích</h5>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {relatedChunksInfo.length}
                                        </div>
                                        <div className="text-gray-600">Văn bản liên quan</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-600">
                                            {relatedChunksInfo.filter(doc => doc.exists_in_db).length}
                                        </div>
                                        <div className="text-gray-600">Tồn tại trong DB</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-600">
                                            {relatedChunksInfo.reduce((sum, doc) => sum + (doc.chunks?.length || 0), 0)}
                                        </div>
                                        <div className="text-gray-600">Tổng chunks</div>
                                    </div>
                                </div>
                            </div>

                            {/* Related Documents List */}
                            {relatedChunksInfo.map((relatedDoc, index) => (
                                <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="flex items-center">
                                                    <FileText size={16} className="text-blue-600 mr-2" />
                                                    <h5 className="font-medium text-gray-800">
                                                        {String(relatedDoc.doc_id)}
                                                    </h5>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${relatedDoc.relationship === 'references' ? 'bg-blue-100 text-blue-800' :
                                                    relatedDoc.relationship === 'replaces' ? 'bg-red-100 text-red-800' :
                                                        relatedDoc.relationship === 'amends' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {String(relatedDoc.relationship)}
                                                </span>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${relatedDoc.exists_in_db
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {relatedDoc.exists_in_db
                                                    ? `${relatedDoc.chunks?.length || 0} chunks`
                                                    : 'Không tồn tại trong DB'
                                                }
                                            </span>
                                        </div>

                                        <p className="text-sm text-gray-600 mt-2">
                                            {String(relatedDoc.description)}
                                        </p>

                                        {relatedDoc.error && (
                                            <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                                                <p className="text-sm text-red-600">
                                                    ⚠️ Lỗi: {String(relatedDoc.error)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {relatedDoc.exists_in_db && relatedDoc.chunks?.length > 0 && (
                                        <div className="p-4">
                                            <button
                                                onClick={() => {
                                                    const expandedDiv = document.getElementById(`chunks-${index}`);
                                                    const icon = document.getElementById(`icon-${index}`);
                                                    if (expandedDiv.style.display === 'none') {
                                                        expandedDiv.style.display = 'block';
                                                        icon.style.transform = 'rotate(180deg)';
                                                    } else {
                                                        expandedDiv.style.display = 'none';
                                                        icon.style.transform = 'rotate(0deg)';
                                                    }
                                                }}
                                                className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium mb-3 transition-colors"
                                            >
                                                <ChevronDown id={`icon-${index}`} size={16} className="mr-1 transition-transform" />
                                                Xem chi tiết {relatedDoc.chunks?.length || 0} chunks (với full content)
                                            </button>

                                            <div id={`chunks-${index}`} style={{ display: 'none' }} className="space-y-3">
                                                {relatedDoc.chunks?.slice(0, 5).map((chunk, chunkIndex) => (
                                                    <div key={chunkIndex} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-medium text-gray-800">
                                                                {String(chunk.chunk_id)}
                                                            </span>
                                                            <span className="text-xs text-gray-500">#{chunkIndex + 1}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-600 line-clamp-2">
                                                            {String(chunk.content_summary || chunk.content?.substring(0, 100) + '...')}
                                                        </p>
                                                        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                                                            <span>Loại: {String(chunk.chunk_type)}</span>
                                                            <span>{String(chunk.effective_date)}</span>
                                                            <span>Content: {chunk.content?.length || 0} ký tự</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {relatedDoc.chunks?.length > 5 && (
                                                    <div className="text-center">
                                                        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                                            ... và {relatedDoc.chunks?.length - 5} chunks khác
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* AI Analysis Button */}
                            {relatedChunksInfo.some(doc => doc.exists_in_db && doc.chunks?.length > 0) && !llmAnalysisResult && (
                                <div className="bg-white rounded-lg border border-orange-200 p-4">
                                    <div className="flex items-center mb-3">
                                        <Zap size={16} className="text-orange-600 mr-2" />
                                        <h5 className="font-medium text-gray-800">Phân tích thông minh với AI</h5>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Sử dụng AI để phân tích và xác định chunks nào cần vô hiệu hóa dựa trên mối quan hệ pháp lý.
                                        AI sẽ nhận đầy đủ nội dung chunks để phân tích chính xác.
                                    </p>
                                    <button
                                        onClick={analyzeChunksWithLLM}
                                        disabled={isAnalyzingWithLLM}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg font-medium hover:from-orange-700 hover:to-amber-700 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isAnalyzingWithLLM ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                                                AI đang phân tích chunks...
                                            </>
                                        ) : (
                                            <>
                                                <Brain size={16} className="mr-2" />
                                                Phân tích với AI
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* LLM Analysis Results */}
                            {llmAnalysisResult && (
                                <motion.div
                                    className="bg-white rounded-lg border border-blue-200 overflow-hidden"
                                    variants={fadeInVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
                                        <div className="flex items-center">
                                            <Settings size={16} className="mr-2" />
                                            <h5 className="font-medium">Kết quả phân tích AI</h5>
                                        </div>
                                    </div>

                                    <div className="p-4">
                                        <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
                                            <p className="text-sm text-blue-800 font-medium mb-2">📋 Tóm tắt phân tích:</p>
                                            <p className="text-sm text-blue-700">
                                                {String(llmAnalysisResult.analysis_summary)}
                                            </p>
                                        </div>

                                        {llmAnalysisResult.chunks_to_invalidate && llmAnalysisResult.chunks_to_invalidate.length > 0 ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h6 className="font-medium text-gray-800 flex items-center">
                                                        <ShieldAlert size={16} className="text-red-600 mr-2" />
                                                        Chunks cần vô hiệu hóa ({llmAnalysisResult.chunks_to_invalidate.length})
                                                    </h6>
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => setChunksToInvalidate(llmAnalysisResult.chunks_to_invalidate)}
                                                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                                        >
                                                            Chọn tất cả
                                                        </button>
                                                        <button
                                                            onClick={() => setChunksToInvalidate([])}
                                                            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                                                        >
                                                            Bỏ chọn tất cả
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid gap-3">
                                                    {llmAnalysisResult.chunks_to_invalidate.map((chunk, index) => (
                                                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                                                            <div className="p-3">
                                                                <label className="flex items-start space-x-3 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={chunksToInvalidate.some(c => c.chunk_id === chunk.chunk_id)}
                                                                        onChange={() => toggleChunkInvalidation(chunk.chunk_id)}
                                                                        className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <span className="font-medium text-gray-800 break-all">
                                                                                {String(chunk.chunk_id)}
                                                                            </span>
                                                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                                                                Confidence: {Math.round((chunk.confidence || 0) * 100)}%
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-red-700 bg-red-50 p-2 rounded border border-red-200">
                                                                            <strong>Lý do:</strong> {String(chunk.reason)}
                                                                        </p>
                                                                    </div>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                                                    <button
                                                        onClick={executeChunkInvalidation}
                                                        disabled={isInvalidatingChunks || chunksToInvalidate.length === 0}
                                                        className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isInvalidatingChunks ? (
                                                            <>
                                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                                                                Đang vô hiệu hóa...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <XCircle size={16} className="mr-2" />
                                                                Vô hiệu hóa {chunksToInvalidate.length} chunks
                                                            </>
                                                        )}
                                                    </button>

                                                    {/* Nút để chuyển sang document tiếp theo */}
                                                    {systemRelationshipDocs.length > 0 && currentDocIndex < systemRelationshipDocs.length - 1 && (
                                                        <button
                                                            onClick={handleNextDocument}
                                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
                                                        >
                                                            Tiếp theo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-6">
                                                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                                                    <Shield size={24} className="text-green-600" />
                                                </div>
                                                <h6 className="font-medium text-gray-800 mb-2">Không có chunks cần vô hiệu hóa</h6>
                                                <p className="text-sm text-gray-600 mb-4">
                                                    AI đã phân tích và không tìm thấy chunks nào cần vô hiệu hóa.
                                                    Văn bản này không thay thế hoàn toàn các chunks hiện có.
                                                </p>

                                                {/* Nút để chuyển sang document tiếp theo */}
                                                {systemRelationshipDocs.length > 0 && currentDocIndex < systemRelationshipDocs.length - 1 && (
                                                    <button
                                                        onClick={handleNextDocument}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center mx-auto"
                                                    >
                                                        Chuyển sang document tiếp theo
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        );
    };

    // Render trạng thái xử lý
    const renderProcessingStatus = () => {
        if (!documentProcessingStatus) return null;

        const { status, progress, message, result, file_type, original_filename } = documentProcessingStatus;
        const fileType = file_type?.toUpperCase() || 'TÀI LIỆU';
        const fileName = original_filename || 'tệp';

        return (
            <motion.div
                className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
                    <h4 className="font-medium flex items-center">
                        <Clock size={16} className="mr-2" />
                        Trạng thái xử lý {fileType}
                    </h4>
                </div>

                <div className="p-5">
                    <div className="mb-3 flex items-center text-sm text-gray-600">
                        {getFileIcon(fileName)}
                        <span className="ml-2 font-medium">{fileName}</span>
                    </div>

                    {status === 'processing' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Gemini AI đang phân tích {fileType}...</span>
                                <span className="text-sm font-medium text-blue-600">{Math.round(progress || 0)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${progress || 0}%` }}
                                ></div>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-blue-600 mr-2"></div>
                                {String(message)}
                            </div>
                        </div>
                    )}

                    {status === 'completed' && (
                        <div className="space-y-4">
                            <div className="flex items-center text-green-600">
                                <CheckCircle size={16} className="mr-2" />
                                <span className="font-medium">Hoàn thành phân tích {fileType}</span>
                            </div>
                            <p className="text-sm text-gray-600">{String(message)}</p>

                            {result && (
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                        <div className="flex items-center">
                                            <FileText size={14} className="text-green-600 mr-1" />
                                            <span className="font-medium text-gray-700">Số chunks:</span>
                                            <span className="ml-2 text-green-600 font-medium">{result.chunks_count}</span>
                                        </div>
                                        <div className="flex items-center">
                                            <FileSymlink size={14} className="text-blue-600 mr-1" />
                                            <span className="font-medium text-gray-700">Văn bản liên quan:</span>
                                            <span className="ml-2 text-blue-600 font-medium">{result.related_documents_count}</span>
                                        </div>
                                    </div>

                                    {result.auto_detected && (
                                        <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-200">
                                            <p className="text-xs font-medium text-blue-700 mb-2">Thông tin được phát hiện tự động:</p>
                                            <div className="text-xs text-blue-600 space-y-1">
                                                <p><strong>Mã văn bản:</strong> {String(result.auto_detected.doc_id || 'Không xác định')}</p>
                                                <p><strong>Loại:</strong> {String(result.auto_detected.doc_type || 'Không xác định')}</p>
                                                <p><strong>Ngày hiệu lực:</strong> {String(result.auto_detected.effective_date || 'Không xác định')}</p>
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-xs text-gray-500 italic break-words">
                                        {String(result.processing_summary)}
                                    </p>
                                </div>
                            )}

                            <div className="flex space-x-3">
                                <button
                                    onClick={handleApproveDocumentChunks}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={documentProcessingStatus?.embedded_to_chroma}
                                >
                                    <CheckCircle size={16} className="mr-2" />
                                    {documentProcessingStatus?.embedded_to_chroma ? 'Đã phê duyệt' : 'Phê duyệt và embedding'}
                                </button>

                                {!documentProcessingStatus?.embedded_to_chroma && (
                                    <button
                                        onClick={handleRegenerateDocumentChunks}
                                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors flex items-center"
                                    >
                                        <RefreshCw size={16} className="mr-2" />
                                        Tạo lại chunks
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {status === 'failed' && (
                        <div className="space-y-3">
                            <div className="flex items-center text-red-600">
                                <XCircle size={16} className="mr-2" />
                                <span className="font-medium">Lỗi xử lý {fileType}</span>
                            </div>
                            <p className="text-sm text-red-600 break-words">{String(message)}</p>
                            <button
                                onClick={() => {
                                    setDocumentProcessingId(null);
                                    setDocumentProcessingStatus(null);
                                }}
                                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        );
    };

    // Xử lý chọn folder cho manual mode
    const handleFolderSelect = async (event) => {
        const files = Array.from(event.target.files);
        console.log('Số tệp được chọn:', files.length);

        if (files.length === 0) {
            console.log('Không có tệp nào được chọn');
            return;
        }

        const metadataFile = files.find(file =>
            file.webkitRelativePath.endsWith('metadata.json')
        );

        if (!metadataFile) {
            Swal.fire({
                title: 'Cấu trúc thư mục không hợp lệ',
                text: 'Thư mục phải chứa tệp metadata.json',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        try {
            console.log('Đang đọc metadata.json...');
            const metadataText = await metadataFile.text();
            const metadata = JSON.parse(metadataText);
            console.log('Metadata đã đọc:', metadata);

            const chunkFiles = files.filter(file =>
                !file.webkitRelativePath.endsWith('metadata.json') &&
                (file.name.endsWith('.md') || file.name.endsWith('.txt'))
            );

            console.log('Số tệp chunk tìm thấy:', chunkFiles.length);

            if (chunkFiles.length === 0) {
                Swal.fire({
                    title: 'Không tìm thấy tệp chunk',
                    text: 'Thư mục phải chứa ít nhất một tệp chunk (.md hoặc .txt)',
                    icon: 'error',
                    confirmButtonColor: '#10b981'
                });
                return;
            }

            console.log('Tự động điền biểu mẫu từ metadata...');
            setUploadMetadata({
                doc_id: metadata.doc_id || '',
                doc_type: metadata.doc_type || 'Thông tư',
                doc_title: metadata.doc_title || '',
                effective_date: metadata.effective_date || '',
                document_scope: metadata.document_scope || 'Quốc gia'
            });

            setSelectedFolder(metadataFile.webkitRelativePath.split('/')[0]);
            setFolderFiles(chunkFiles);
            setFolderMetadata(metadata);

            console.log('Đã cập nhật state với thư mục được chọn');

        } catch (error) {
            console.error('Lỗi khi đọc metadata:', error);
            Swal.fire({
                title: 'Lỗi đọc metadata',
                text: 'Không thể đọc tệp metadata.json. Vui lòng kiểm tra định dạng JSON.',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        }
    };

    // Xử lý upload manual mode
    const handleManualUpload = async (e) => {
        e.preventDefault();

        if (!selectedFolder || folderFiles.length === 0) {
            Swal.fire({
                title: 'Chưa chọn thư mục',
                text: 'Vui lòng chọn thư mục chứa chunks và metadata.json',
                icon: 'warning',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        if (!uploadMetadata.doc_id || !uploadMetadata.doc_title || !uploadMetadata.effective_date) {
            Swal.fire({
                title: 'Thông tin chưa đủ',
                text: 'Vui lòng điền đầy đủ thông tin bắt buộc',
                icon: 'warning',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        try {
            setIsUploadingManual(true);
            console.log('Bắt đầu tải lên thủ công với', folderFiles.length, 'tệp chunk');

            const formData = new FormData();
            formData.append('metadata', JSON.stringify(uploadMetadata));

            folderFiles.forEach((file) => {
                formData.append('chunks', file);
            });

            console.log('Đang gửi yêu cầu upload-document...');
            const response = await axios.post(`${API_BASE_URL}/upload-document`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log('Tải lên thành công:', response.data);

            Swal.fire({
                title: 'Tải lên thành công',
                text: `Đã tải lên văn bản ${response.data.doc_id} với ${folderFiles.length} chunks và nhúng vào ChromaDB`,
                icon: 'success',
                confirmButtonColor: '#10b981'
            });

            // Reset form
            setSelectedFolder(null);
            setFolderFiles([]);
            setFolderMetadata(null);
            setUploadMetadata({
                doc_id: '',
                doc_type: 'Thông tư',
                doc_title: '',
                effective_date: '',
                document_scope: 'Quốc gia'
            });

            // Làm mới danh sách tài liệu
            window.location.reload();

        } catch (error) {
            console.error('Lỗi tải lên thủ công:', error);
            Swal.fire({
                title: 'Lỗi tải lên',
                text: error.response?.data?.detail || 'Không thể tải lên văn bản',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        } finally {
            setIsUploadingManual(false);
        }
    };

    // Xử lý upload tài liệu tự động (PDF/Word)
    const handleDocumentUpload = async (e) => {
        e.preventDefault();

        if (!documentFile) {
            Swal.fire({
                title: 'Chưa chọn tệp',
                text: 'Vui lòng chọn tệp tài liệu để phân tích',
                icon: 'warning',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        const doc_id_input = uploadMetadata.doc_id || 'auto_detect';
        const doc_title_input = uploadMetadata.doc_title || 'auto_detect';
        const effective_date_input = uploadMetadata.effective_date || 'auto_detect';

        try {
            setIsProcessingDocument(true);

            const formData = new FormData();
            formData.append('file', documentFile);
            formData.append('doc_id', doc_id_input);
            formData.append('doc_type', uploadMetadata.doc_type);
            formData.append('doc_title', doc_title_input);
            formData.append('effective_date', effective_date_input);
            formData.append('document_scope', uploadMetadata.document_scope);

            console.log('Đang tải lên tài liệu để Gemini phân tích với tự động phát hiện...');
            const response = await axios.post(`${API_BASE_URL}/upload-document-auto`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setDocumentProcessingId(response.data.processing_id);

            const fileType = response.data.file_type?.toUpperCase() || 'TÀI LIỆU';
            const fileName = response.data.original_filename || documentFile.name;

            Swal.fire({
                title: `Bắt đầu phân tích ${fileType}`,
                html: `
                    <div class="text-left">
                        <p class="mb-2"><strong>Tệp:</strong> ${fileName}</p>
                        <p>Hệ thống đang sử dụng <strong>Gemini AI</strong> để:</p>
                        <ul class="list-disc list-inside mt-2 text-sm">
                            <li>Trích xuất nội dung từ ${fileType}</li>
                            <li>Tự động phát hiện: mã văn bản, loại, tiêu đề, ngày hiệu lực</li>
                            <li>Phân tích và chia nhỏ văn bản theo logic</li>
                            <li>Trích xuất thông tin văn bản liên quan</li>
                            <li>Tạo metadata hoàn chỉnh</li>
                        </ul>
                        <p class="text-gray-600 text-sm mt-2">Vui lòng chờ khoảng 1-5 phút...</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonColor: '#10b981',
                allowOutsideClick: false
            });

        } catch (error) {
            console.error('Lỗi khi tải lên tài liệu:', error);
            setIsProcessingDocument(false);

            Swal.fire({
                title: 'Lỗi tải lên tài liệu',
                text: error.response?.data?.detail || 'Không thể tải lên tệp',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        }
    };

    // Phê duyệt document chunks và nhúng vào ChromaDB
    const handleApproveDocumentChunks = async () => {
        if (!documentProcessingId) return;

        const status = documentProcessingStatus;
        const fileType = status?.file_type?.toUpperCase() || 'TÀI LIỆU';

        Swal.fire({
            title: 'Xác nhận phê duyệt',
            html: `
                <div class="text-left">
                    <p>Bạn có chắc chắn muốn phê duyệt kết quả chia chunk ${fileType} này?</p>
                    <p class="text-sm text-gray-600 mt-2">
                        Sau khi phê duyệt, dữ liệu sẽ được nhúng vào ChromaDB và có thể sử dụng ngay.
                    </p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Phê duyệt và embedding',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#6b7280'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    console.log('Đang phê duyệt document chunks và nhúng vào ChromaDB...');
                    const response = await axios.post(`${API_BASE_URL}/approve-document-chunks/${documentProcessingId}`);

                    Swal.fire({
                        title: 'Thành công',
                        text: response.data.message,
                        icon: 'success',
                        confirmButtonColor: '#10b981'
                    });

                    // Reset state và làm mới danh sách tài liệu
                    setDocumentProcessingId(null);
                    setDocumentProcessingStatus(null);
                    setDocumentFile(null);
                    setUploadMetadata({
                        doc_id: '',
                        doc_type: 'Thông tư',
                        doc_title: '',
                        effective_date: '',
                        document_scope: 'Quốc gia'
                    });

                    // Reset related chunks state
                    setRelatedChunksInfo(null);
                    setLlmAnalysisResult(null);
                    setChunksToInvalidate([]);
                    setShowRelatedChunksPanel(false);

                    // Làm mới danh sách tài liệu
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);

                } catch (error) {
                    console.error('Lỗi khi phê duyệt document chunks:', error);
                    Swal.fire({
                        title: 'Lỗi phê duyệt',
                        text: error.response?.data?.detail || 'Không thể phê duyệt chunks',
                        icon: 'error',
                        confirmButtonColor: '#10b981'
                    });
                }
            }
        });
    };

    // Tạo lại document chunks
    const handleRegenerateDocumentChunks = async () => {
        if (!documentProcessingId) return;

        const status = documentProcessingStatus;
        const fileType = status?.file_type?.toUpperCase() || 'TÀI LIỆU';

        Swal.fire({
            title: 'Xác nhận tạo lại',
            text: `Bạn có chắc chắn muốn tạo lại chunks ${fileType}? Kết quả hiện tại sẽ bị xóa và bạn cần tải lên lại tệp.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Tạo lại',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#6b7280'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    console.log('Đang tạo lại document chunks...');
                    const response = await axios.post(`${API_BASE_URL}/regenerate-document-chunks/${documentProcessingId}`);

                    Swal.fire({
                        title: 'Đã xóa kết quả cũ',
                        text: response.data.message,
                        icon: 'info',
                        confirmButtonColor: '#10b981'
                    });

                    // Reset state để tải lên lại
                    setDocumentProcessingId(null);
                    setDocumentProcessingStatus(null);
                    setRelatedChunksInfo(null);
                    setLlmAnalysisResult(null);
                    setChunksToInvalidate([]);
                    setShowRelatedChunksPanel(false);

                } catch (error) {
                    console.error('Lỗi khi tạo lại document chunks:', error);
                    Swal.fire({
                        title: 'Lỗi tạo lại',
                        text: error.response?.data?.detail || 'Không thể tạo lại chunks',
                        icon: 'error',
                        confirmButtonColor: '#10b981'
                    });
                }
            }
        });
    };

    // Render tab tải lên dữ liệu
    const renderUploadTab = () => (
        <div className="space-y-6">
            {/* System Scan Button */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-medium text-purple-700 mb-1 flex items-center">
                            <Settings size={16} className="mr-2" />
                            Scan mối quan hệ toàn hệ thống
                        </h4>
                        <p className="text-sm text-purple-600">
                            Tìm các documents có relationships và xử lý từng document để vô hiệu hóa chunks cần thiết
                        </p>
                    </div>
                    <button
                        onClick={handleSystemRelationshipScan}
                        disabled={isScanningSystem}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isScanningSystem ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                                Đang scan...
                            </>
                        ) : (
                            <>
                                <Settings size={16} className="mr-2" />
                                Scan hệ thống
                            </>
                        )}
                    </button>
                </div>
            </div>

            {renderSystemRelationshipStatus()}
            {renderProcessingStatus()}
            {renderRelatedChunksAnalysis()}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Chọn phương thức tải lên
                </label>
                <div className="grid grid-cols-1 gap-3">
                    <label className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                            type="radio"
                            name="uploadMode"
                            value="auto"
                            checked={uploadMode === 'auto'}
                            onChange={(e) => setUploadMode(e.target.value)}
                            className="mt-0.5 mr-3"
                        />
                        <div>
                            <span className="text-sm font-medium text-gray-700 flex items-center">
                                <File size={16} className="mr-2" />
                                Tự động chia chunk bằng Gemini AI
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                                Tải lên tệp PDF/Word/Markdown, Gemini AI sẽ tự động phân tích, phát hiện metadata và chia chunk
                            </p>
                        </div>
                    </label>
                    <label className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                            type="radio"
                            name="uploadMode"
                            value="manual"
                            checked={uploadMode === 'manual'}
                            onChange={(e) => setUploadMode(e.target.value)}
                            className="mt-0.5 mr-3"
                        />
                        <div>
                            <span className="text-sm font-medium text-gray-700 flex items-center">
                                <FolderOpen size={16} className="mr-2" />
                                Tải lên thư mục đã chia chunk sẵn
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                                Chọn thư mục chứa chunks (.md) và metadata.json. Tự động đọc thông tin và nhúng vào ChromaDB.
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            {uploadMode === 'auto' ? (
                <form onSubmit={handleDocumentUpload} className="space-y-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
                        <div className="text-center">
                            <div className="mb-4">
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <label htmlFor="document-upload" className="cursor-pointer">
                                <span className="text-lg font-medium text-green-600 hover:text-green-500">
                                    Chọn tệp PDF, Word hoặc Markdown
                                </span>
                                <input
                                    id="document-upload"
                                    name="document-upload"
                                    type="file"
                                    className="sr-only"
                                    onChange={(e) => setDocumentFile(e.target.files[0])}
                                    accept=".pdf,.doc,.docx,.md"
                                    disabled={isProcessingDocument}
                                />
                            </label>
                            <p className="mt-2 text-sm text-gray-500">
                                hoặc kéo và thả tệp vào đây
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Hỗ trợ: PDF, Word (.doc, .docx), Markdown (.md) - Tối đa 10MB
                            </p>
                        </div>

                        {documentFile && (
                            <div className="mt-4 p-3 bg-green-50 rounded border">
                                <p className="text-sm font-medium text-green-700 flex items-center">
                                    {getFileIcon(documentFile.name)}
                                    <span className="ml-2">Đã chọn tệp:</span>
                                </p>
                                <p className="text-sm text-green-600 break-words">
                                    {documentFile.name} ({(documentFile.size / 1024 / 1024).toFixed(2)} MB)
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Gemini sẽ tự động phân tích và điền thông tin bên dưới
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center">
                            <AlertCircle size={16} className="text-blue-500 mr-2" />
                            Thông tin văn bản (Gemini sẽ tự động trích xuất và điền)
                        </h4>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mã văn bản
                                </label>
                                <input
                                    type="text"
                                    value={uploadMetadata.doc_id}
                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_id: e.target.value })}
                                    placeholder="Gemini sẽ tự động phát hiện..."
                                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-gray-50"
                                    disabled={isProcessingDocument}
                                />
                                <p className="mt-1 text-xs text-gray-500">Để trống để Gemini tự động phát hiện</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Loại văn bản
                                </label>
                                <select
                                    value={uploadMetadata.doc_type}
                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_type: e.target.value })}
                                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-gray-50"
                                    disabled={isProcessingDocument}
                                >
                                    <option value="Thông tư">Thông tư</option>
                                    <option value="Nghị định">Nghị định</option>
                                    <option value="Quyết định">Quyết định</option>
                                    <option value="Pháp lệnh">Pháp lệnh</option>
                                    <option value="Luật">Luật</option>
                                </select>
                                <p className="mt-1 text-xs text-gray-500">Gemini sẽ tự động điều chỉnh</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tiêu đề văn bản
                                </label>
                                <textarea
                                    value={uploadMetadata.doc_title}
                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_title: e.target.value })}
                                    placeholder="Gemini sẽ tự động trích xuất tiêu đề..."
                                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-gray-50 resize-none"
                                    rows="3"
                                    disabled={isProcessingDocument}
                                />
                                <p className="mt-1 text-xs text-gray-500">Để trống để Gemini tự động trích xuất</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Ngày hiệu lực
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadMetadata.effective_date}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, effective_date: e.target.value })}
                                        placeholder="DD-MM-YYYY"
                                        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-gray-50"
                                        disabled={isProcessingDocument}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Gemini tự động phát hiện từ văn bản</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Phạm vi áp dụng
                                    </label>
                                    <select
                                        value={uploadMetadata.document_scope}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, document_scope: e.target.value })}
                                        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-gray-50"
                                        disabled={isProcessingDocument}
                                    >
                                        <option value="Quốc gia">Quốc gia</option>
                                        <option value="Địa phương">Địa phương</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isProcessingDocument || !documentFile}
                        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                        {isProcessingDocument ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                                <span>Đang phân tích với Gemini AI...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={18} className="mr-2" />
                                <span>Phân tích tự động với Gemini AI</span>
                            </>
                        )}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleManualUpload} className="space-y-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
                        <div className="text-center">
                            <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <label htmlFor="folder-upload" className="cursor-pointer">
                                <span className="text-lg font-medium text-green-600 hover:text-green-500">
                                    Chọn thư mục
                                </span>
                                <input
                                    id="folder-upload"
                                    name="folder-upload"
                                    type="file"
                                    className="sr-only"
                                    webkitdirectory=""
                                    multiple
                                    onChange={handleFolderSelect}
                                    disabled={isUploadingManual}
                                />
                            </label>
                            <p className="mt-2 text-sm text-gray-500">
                                Thư mục phải chứa metadata.json và các tệp chunks (.md)
                            </p>
                        </div>

                        {selectedFolder && (
                            <div className="mt-4 p-3 bg-green-50 rounded border">
                                <p className="text-sm font-medium text-green-700 flex items-center">
                                    <FolderOpen size={14} className="mr-2" />
                                    Đã chọn thư mục:
                                </p>
                                <p className="text-sm text-green-600 break-words">
                                    {selectedFolder} ({folderFiles.length} tệp chunk)
                                </p>
                                {folderMetadata && (
                                    <p className="text-xs text-gray-500 mt-1 break-words">
                                        Metadata: {String(folderMetadata.doc_id)} - {String(folderMetadata.doc_title)}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-4">
                            Thông tin văn bản (tự động điền từ metadata.json)
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mã văn bản</label>
                                <input
                                    type="text"
                                    value={uploadMetadata.doc_id}
                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_id: e.target.value })}
                                    placeholder="Tự động điền từ metadata.json"
                                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                    required
                                    disabled={isUploadingManual}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Loại văn bản</label>
                                <select
                                    value={uploadMetadata.doc_type}
                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_type: e.target.value })}
                                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                                    disabled={isUploadingManual}
                                >
                                    <option value="Thông tư">Thông tư</option>
                                    <option value="Nghị định">Nghị định</option>
                                    <option value="Quyết định">Quyết định</option>
                                    <option value="Pháp lệnh">Pháp lệnh</option>
                                    <option value="Luật">Luật</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
                                <textarea
                                    value={uploadMetadata.doc_title}
                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_title: e.target.value })}
                                    placeholder="Tự động điền từ metadata.json"
                                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-none"
                                    rows="3"
                                    required
                                    disabled={isUploadingManual}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hiệu lực</label>
                                    <input
                                        type="text"
                                        value={uploadMetadata.effective_date}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, effective_date: e.target.value })}
                                        placeholder="DD-MM-YYYY"
                                        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                        required
                                        disabled={isUploadingManual}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Định dạng: DD-MM-YYYY</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phạm vi áp dụng</label>
                                    <select
                                        value={uploadMetadata.document_scope}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, document_scope: e.target.value })}
                                        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                                        disabled={isUploadingManual}
                                    >
                                        <option value="Quốc gia">Quốc gia</option>
                                        <option value="Địa phương">Địa phương</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isUploadingManual || !selectedFolder}
                        className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                        {isUploadingManual ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                                <span>Đang tải lên và nhúng...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={18} className="mr-2" />
                                <span>Tải lên thư mục và nhúng vào ChromaDB</span>
                            </>
                        )}
                    </button>
                </form>
            )}

            <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center">
                    <AlertCircle size={14} className="mr-1" />
                    Hướng dẫn
                </h4>
                <div className="text-xs text-blue-600 space-y-1">
                    {uploadMode === 'auto' ? (
                        <>
                            <p>Tải lên tệp PDF/Word/Markdown, Gemini AI sẽ tự động phân tích và chia chunk theo logic</p>
                            <p>AI sẽ trích xuất và tự động điền: mã văn bản, tiêu đề, ngày hiệu lực</p>
                            <p>AI cũng tìm các văn bản liên quan và tạo metadata hoàn chỉnh</p>
                            <p>Bạn có thể để trống metadata để Gemini tự động phát hiện hoàn toàn</p>
                            <p>Nếu có văn bản liên quan, hệ thống sẽ phân tích để xác định chunks cần vô hiệu hóa</p>
                            <p>Kiểm tra kết quả trước khi phê duyệt để nhúng vào ChromaDB</p>
                            <p>Có thể tạo lại nếu kết quả chưa hài lòng</p>
                        </>
                    ) : (
                        <>
                            <p>Chọn thư mục chứa tệp metadata.json và các tệp chunk (.md)</p>
                            <p>Hệ thống sẽ tự động đọc metadata.json để điền biểu mẫu</p>
                            <p>Sau khi tải lên, dữ liệu sẽ được nhúng ngay vào ChromaDB</p>
                            <p>Cấu trúc thư mục: tên_thư_mục/metadata.json + chunk_1.md + chunk_2.md + ...</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    // Render tab xem thông tin chunks với validity status
    const renderChunkInfoTab = () => (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chọn văn bản để xem chi tiết chunks
                </label>
                <select
                    value={selectedDocForChunks || ''}
                    onChange={(e) => {
                        const docId = e.target.value;
                        setSelectedDocForChunks(docId);
                        if (docId) {
                            fetchChunkInfo(docId);
                        } else {
                            setChunkInfo(null);
                        }
                    }}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                >
                    <option value="">-- Chọn văn bản --</option>
                    {documents.map(doc => (
                        <option key={doc.doc_id} value={doc.doc_id}>
                            {String(doc.doc_id)}
                        </option>
                    ))}
                </select>
            </div>

            {loadingChunks && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                </div>
            )}

            {chunkInfo && !loadingChunks && (
                <div className="space-y-4">
                    <motion.div
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                        variants={fadeInVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <h3 className="font-medium text-gray-700 mb-3 flex items-center">
                            <Info size={16} className="mr-2 text-blue-600" />
                            Thông tin tổng quan
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-gray-600">Mã văn bản:</span>
                                <span className="ml-2 break-words">{String(chunkInfo.doc_info.doc_id)}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600">Loại:</span>
                                <span className="ml-2">{String(chunkInfo.doc_info.doc_type)}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="font-medium text-gray-600">Tiêu đề:</span>
                                <span className="ml-2 break-words">{String(chunkInfo.doc_info.doc_title)}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600">Ngày hiệu lực:</span>
                                <span className="ml-2">{String(chunkInfo.doc_info.effective_date)}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600">Tổng chunks:</span>
                                <span className="ml-2 text-green-600 font-medium">{chunkInfo.doc_info.total_chunks}</span>
                            </div>
                        </div>
                    </motion.div>

                    <div>
                        <h3 className="font-medium text-gray-700 mb-3 flex items-center">
                            <FileText size={16} className="mr-2 text-green-600" />
                            Chi tiết các chunks
                        </h3>
                        <div className="space-y-3">
                            {chunkInfo.chunks.map((chunk, index) => (
                                <motion.div
                                    key={chunk.chunk_id}
                                    className="border border-gray-200 rounded-lg overflow-hidden"
                                    variants={fadeInVariants}
                                    initial="hidden"
                                    animate="visible"
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-medium text-gray-800 break-words">
                                                {String(chunk.chunk_id)}
                                            </h4>
                                            <div className="flex space-x-2">
                                                {/* Trạng thái tồn tại */}
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${chunk.exists
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {chunk.exists ? 'Tồn tại' : 'Không tồn tại'}
                                                </span>

                                                {/* Trạng thái validity */}
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${chunk.validity_status === 'valid'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-orange-100 text-orange-800'
                                                    }`}>
                                                    {chunk.validity_status === 'valid' ? 'Còn hiệu lực' : 'Đã vô hiệu hóa'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-sm text-gray-600 mb-3 break-words">
                                            <span className="font-medium">Mô tả:</span> {String(chunk.content_summary)}
                                        </div>

                                        <div className="text-xs text-gray-500 mb-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <span><span className="font-medium">Loại:</span> {String(chunk.chunk_type)}</span>
                                                <span><span className="font-medium">Số từ:</span> {chunk.word_count}</span>
                                                <span><span className="font-medium">Cache liên quan:</span> {chunk.related_cache_count || 0}</span>
                                                {chunk.file_path && (
                                                    <span className="col-span-2"><span className="font-medium">Đường dẫn:</span> {String(chunk.file_path)}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Thông tin vô hiệu hóa */}
                                        {chunk.validity_status === 'invalid' && chunk.invalidation_info && (
                                            <motion.div
                                                className="bg-orange-50 rounded-lg p-3 mb-3 border border-orange-200"
                                                variants={fadeInVariants}
                                                initial="hidden"
                                                animate="visible"
                                            >
                                                <div className="flex items-center mb-2">
                                                    <ShieldAlert size={14} className="text-orange-600 mr-2" />
                                                    <p className="text-xs font-medium text-orange-800">Thông tin vô hiệu hóa:</p>
                                                </div>
                                                <div className="text-xs text-orange-700 space-y-1">
                                                    {chunk.invalidation_info.reason && (
                                                        <p><span className="font-medium">Lý do:</span> {String(chunk.invalidation_info.reason)}</p>
                                                    )}
                                                    {chunk.invalidation_info.invalidated_by && (
                                                        <p><span className="font-medium">Bởi văn bản:</span> {String(chunk.invalidation_info.invalidated_by)}</p>
                                                    )}
                                                    {chunk.invalidation_info.invalidated_at && (
                                                        <p><span className="font-medium">Thời gian:</span> {
                                                            new Date(chunk.invalidation_info.invalidated_at).toLocaleString('vi-VN')
                                                        }</p>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Nội dung chunk */}
                                        {chunk.exists && chunk.content && (
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-medium text-gray-600">📄 Nội dung:</p>
                                                    <button
                                                        onClick={() => {
                                                            const contentDiv = document.getElementById(`content-${index}`);
                                                            const button = document.getElementById(`toggle-${index}`);
                                                            if (contentDiv.style.maxHeight === 'none') {
                                                                contentDiv.style.maxHeight = '10rem';
                                                                button.textContent = 'Xem thêm';
                                                            } else {
                                                                contentDiv.style.maxHeight = 'none';
                                                                button.textContent = 'Thu gọn';
                                                            }
                                                        }}
                                                        id={`toggle-${index}`}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                        Xem thêm
                                                    </button>
                                                </div>
                                                <div
                                                    id={`content-${index}`}
                                                    className="text-sm text-gray-700 overflow-y-auto whitespace-pre-wrap break-words transition-all duration-300"
                                                    style={{ maxHeight: '10rem' }}
                                                >
                                                    {String(chunk.content)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!chunkInfo && !loadingChunks && selectedDocForChunks && (
                <div className="text-center py-8 text-gray-500">
                    <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                    <p>Không có thông tin chunk để hiển thị</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Panel trái - Upload và Chunk Info */}
                <motion.div
                    className="bg-white rounded-xl shadow-sm border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="border-b border-gray-100">
                        <div className="flex">
                            <button
                                onClick={() => setActiveMainTab('upload')}
                                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeMainTab === 'upload'
                                    ? 'border-green-600 text-green-600 bg-green-50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Upload size={16} className="inline mr-2" />
                                Tải lên dữ liệu
                            </button>
                            <button
                                onClick={() => setActiveMainTab('chunks')}
                                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeMainTab === 'chunks'
                                    ? 'border-green-600 text-green-600 bg-green-50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <FileText size={16} className="inline mr-2" />
                                Xem thông tin chunks
                            </button>
                        </div>
                    </div>

                    <div className="p-5">
                        {activeMainTab === 'upload' ? renderUploadTab() : renderChunkInfoTab()}
                    </div>
                </motion.div>

                {/* Panel phải - Danh sách văn bản */}
                <motion.div
                    className="bg-white rounded-xl shadow-sm border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-semibold flex items-center">
                            <FileText size={18} className="text-green-600 mr-2" />
                            Danh sách văn bản ({documents.length})
                        </h2>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Tìm kiếm văn bản..."
                                value={documentFilter}
                                onChange={(e) => setDocumentFilter(e.target.value)}
                                className="py-1.5 pl-8 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                            <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        </div>
                    </div>

                    <div className="p-5 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                        {isLoading ? (
                            <div className="py-4 flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {documents
                                    .filter(doc =>
                                        String(doc.doc_id).toLowerCase().includes(documentFilter.toLowerCase()) ||
                                        String(doc.doc_title || '').toLowerCase().includes(documentFilter.toLowerCase())
                                    )
                                    .map((document) => (
                                        <motion.div
                                            key={document.doc_id}
                                            className="border border-gray-200 rounded-lg hover:shadow-sm transition-all duration-200 hover:border-gray-300"
                                            variants={fadeInVariants}
                                            initial="hidden"
                                            animate="visible"
                                            whileHover={{ scale: 1.01 }}
                                        >
                                            <div className="p-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-sm font-medium text-gray-900 flex items-center mb-1">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 flex-shrink-0 ${document.doc_type === 'Luật' ? 'bg-red-100 text-red-800' :
                                                                document.doc_type === 'Nghị định' ? 'bg-blue-100 text-blue-800' :
                                                                    document.doc_type === 'Thông tư' ? 'bg-green-100 text-green-800' :
                                                                        document.doc_type === 'Quyết định' ? 'bg-yellow-100 text-yellow-800' :
                                                                            'bg-purple-100 text-purple-800'
                                                                }`}>
                                                                {String(document.doc_type)}
                                                            </span>
                                                            <span className="break-words">{String(document.doc_id)}</span>
                                                        </h3>
                                                        <p className="text-sm text-gray-600 break-words line-clamp-2">
                                                            {String(document.doc_title)}
                                                        </p>
                                                    </div>
                                                    <div className="flex space-x-1 flex-shrink-0 ml-2">
                                                        <button
                                                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                            onClick={() => {
                                                                setSelectedDocForChunks(document.doc_id);
                                                                setActiveMainTab('chunks');
                                                                fetchChunkInfo(document.doc_id);
                                                            }}
                                                            title="Xem chi tiết"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                            onClick={() => handleDeleteDocument(document.doc_id)}
                                                            title="Xóa"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                                    <div className="flex items-center">
                                                        <Calendar size={12} className="mr-1 flex-shrink-0" />
                                                        <span className="break-words">
                                                            Ngày hiệu lực: {String(document.effective_date || 'Không xác định')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                                                        <div className="flex items-center">
                                                            <FileSymlink size={12} className="mr-1" />
                                                            <span>{document.chunks_count || 0} chunks</span>
                                                        </div>
                                                        {document.related_documents_count > 0 && (
                                                            <div className="flex items-center">
                                                                <FileText size={12} className="mr-1" />
                                                                <span>{document.related_documents_count} văn bản liên quan</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}

                                {documents.filter(doc =>
                                    String(doc.doc_id).toLowerCase().includes(documentFilter.toLowerCase()) ||
                                    String(doc.doc_title || '').toLowerCase().includes(documentFilter.toLowerCase())
                                ).length === 0 && (
                                        <div className="py-10 text-center">
                                            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-3">
                                                <FileText size={24} className="text-gray-400" />
                                            </div>
                                            <p className="text-gray-500 text-sm">Không tìm thấy văn bản nào</p>
                                            {documentFilter && (
                                                <p className="text-gray-400 text-xs mt-1">
                                                    Thử tìm kiếm với từ khóa khác
                                                </p>
                                            )}
                                        </div>
                                    )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default DocumentsTab;