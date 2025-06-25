import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Trash2, Upload, FileText, Eye, Calendar, FileSymlink, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatDate } from '../../utils/formatUtils';
import { getApiBaseUrl } from '../../apiService';
import axios from 'axios';

const DocumentsTab = ({
    documents,
    isLoading,
    documentFilter,
    setDocumentFilter,
    documentFiles,
    setDocumentFiles,
    uploadMetadata,
    setUploadMetadata,
    handleUploadDocument,
    handleDeleteDocument
}) => {
    // State cho upload modes
    const [uploadMode, setUploadMode] = useState('manual'); // 'manual' hoặc 'auto'
    
    // State cho PDF auto processing
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfProcessingId, setPdfProcessingId] = useState(null);
    const [pdfProcessingStatus, setPdfProcessingStatus] = useState(null);
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    
    // State cho metadata của PDF upload
    const [pdfMetadata, setPdfMetadata] = useState({
        doc_id: '',
        doc_type: 'Thông tư',
        doc_title: '',
        effective_date: '',
        document_scope: 'Quốc gia'
    });

    const API_BASE_URL = getApiBaseUrl();

    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    // Poll trạng thái PDF processing
    useEffect(() => {
        let interval;
        if (pdfProcessingId && isProcessingPdf) {
            interval = setInterval(async () => {
                try {
                    const response = await axios.get(`${API_BASE_URL}/pdf-processing-status/${pdfProcessingId}`);
                    const status = response.data;
                    
                    setPdfProcessingStatus(status);
                    
                    if (status.status === 'completed' || status.status === 'failed') {
                        setIsProcessingPdf(false);
                        clearInterval(interval);
                        
                        if (status.status === 'completed') {
                            Swal.fire({
                                title: 'Phân tích PDF hoàn thành',
                                html: `
                                    <div class="text-left">
                                        <p><strong>Kết quả:</strong> ${status.message}</p>
                                        <p><strong>Chunks:</strong> ${status.result?.chunks_count || 0}</p>
                                        <p><strong>Văn bản liên quan:</strong> ${status.result?.related_documents_count || 0}</p>
                                        <p class="text-sm text-gray-600 mt-2">Vui lòng kiểm tra kết quả và approve nếu hài lòng.</p>
                                    </div>
                                `,
                                icon: 'success',
                                confirmButtonColor: '#10b981'
                            });
                        } else {
                            Swal.fire({
                                title: 'Lỗi phân tích PDF',
                                text: status.message || 'Có lỗi xảy ra trong quá trình phân tích',
                                icon: 'error',
                                confirmButtonColor: '#10b981'
                            });
                        }
                    }
                } catch (error) {
                    console.error('Lỗi khi kiểm tra trạng thái PDF processing:', error);
                }
            }, 2000); // Poll mỗi 2 giây
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [pdfProcessingId, isProcessingPdf, API_BASE_URL]);

    // Reset PDF processing state khi chuyển mode
    useEffect(() => {
        if (uploadMode === 'manual') {
            setPdfFile(null);
            setPdfProcessingId(null);
            setPdfProcessingStatus(null);
            setIsProcessingPdf(false);
            setPdfMetadata({
                doc_id: '',
                doc_type: 'Thông tư',
                doc_title: '',
                effective_date: '',
                document_scope: 'Quốc gia'
            });
        }
    }, [uploadMode]);

    // Xử lý upload PDF tự động
    const handlePdfUpload = async (e) => {
        e.preventDefault();

        if (!pdfFile || !pdfMetadata.doc_id || !pdfMetadata.doc_title || !pdfMetadata.effective_date) {
            Swal.fire({
                title: 'Thông tin chưa đủ',
                text: 'Vui lòng nhập đầy đủ thông tin và chọn file PDF',
                icon: 'warning',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        // Kiểm tra định dạng effective_date
        const datePattern = /^\d{2}-\d{2}-\d{4}$/;
        if (!datePattern.test(pdfMetadata.effective_date)) {
            Swal.fire({
                title: 'Định dạng ngày không hợp lệ',
                text: 'Vui lòng nhập ngày theo định dạng DD-MM-YYYY',
                icon: 'warning',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        try {
            setIsProcessingPdf(true);

            const formData = new FormData();
            formData.append('file', pdfFile);
            formData.append('doc_id', pdfMetadata.doc_id);
            formData.append('doc_type', pdfMetadata.doc_type);
            formData.append('doc_title', pdfMetadata.doc_title);
            formData.append('effective_date', pdfMetadata.effective_date);
            formData.append('document_scope', pdfMetadata.document_scope);

            const response = await axios.post(`${API_BASE_URL}/upload-pdf-document`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setPdfProcessingId(response.data.processing_id);
            
            Swal.fire({
                title: 'Bắt đầu phân tích PDF',
                html: `
                    <div class="text-left">
                        <p>Hệ thống đang sử dụng <strong>Gemini AI</strong> để:</p>
                        <ul class="list-disc list-inside mt-2 text-sm">
                            <li>Phân tích và chia nhỏ văn bản theo logic</li>
                            <li>Trích xuất thông tin văn bản liên quan</li>
                            <li>Tạo metadata hoàn chỉnh</li>
                        </ul>
                        <p class="text-gray-600 text-sm mt-2">Vui lòng chờ khoảng 1-3 phút...</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonColor: '#10b981',
                allowOutsideClick: false
            });

        } catch (error) {
            console.error('Lỗi khi upload PDF:', error);
            setIsProcessingPdf(false);
            
            Swal.fire({
                title: 'Lỗi upload PDF',
                text: error.response?.data?.detail || 'Không thể upload file PDF',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        }
    };

    // Approve PDF chunks và embed vào ChromaDB
    const handleApprovePdfChunks = async () => {
        if (!pdfProcessingId) return;

        Swal.fire({
            title: 'Xác nhận approve',
            html: `
                <div class="text-left">
                    <p>Bạn có chắc chắn muốn approve kết quả chia chunk này?</p>
                    <p class="text-sm text-gray-600 mt-2">
                        Sau khi approve, dữ liệu sẽ được embed vào ChromaDB và có thể sử dụng ngay.
                    </p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Approve & Embed',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#6b7280'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await axios.post(`${API_BASE_URL}/approve-pdf-chunks/${pdfProcessingId}`);
                    
                    Swal.fire({
                        title: 'Thành công',
                        text: response.data.message,
                        icon: 'success',
                        confirmButtonColor: '#10b981'
                    });

                    // Reset state và refresh documents list
                    setPdfProcessingId(null);
                    setPdfProcessingStatus(null);
                    setPdfFile(null);
                    setPdfMetadata({
                        doc_id: '',
                        doc_type: 'Thông tư',
                        doc_title: '',
                        effective_date: '',
                        document_scope: 'Quốc gia'
                    });

                    // Trigger refresh documents list
                    window.location.reload();

                } catch (error) {
                    console.error('Lỗi khi approve PDF chunks:', error);
                    Swal.fire({
                        title: 'Lỗi approve',
                        text: error.response?.data?.detail || 'Không thể approve chunks',
                        icon: 'error',
                        confirmButtonColor: '#10b981'
                    });
                }
            }
        });
    };

    // Tạo lại PDF chunks
    const handleRegeneratePdfChunks = async () => {
        if (!pdfProcessingId) return;

        Swal.fire({
            title: 'Xác nhận tạo lại',
            text: 'Bạn có chắc chắn muốn tạo lại chunks? Kết quả hiện tại sẽ bị xóa và bạn cần upload lại file PDF.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Tạo lại',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#6b7280'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await axios.post(`${API_BASE_URL}/regenerate-pdf-chunks/${pdfProcessingId}`);
                    
                    Swal.fire({
                        title: 'Đã xóa kết quả cũ',
                        text: response.data.message,
                        icon: 'info',
                        confirmButtonColor: '#10b981'
                    });

                    // Reset state để upload lại
                    setPdfProcessingId(null);
                    setPdfProcessingStatus(null);

                } catch (error) {
                    console.error('Lỗi khi regenerate PDF chunks:', error);
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

    // Render processing status
    const renderProcessingStatus = () => {
        if (!pdfProcessingStatus) return null;

        const { status, progress, message, result } = pdfProcessingStatus;

        return (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                    <Clock size={16} className="mr-2" />
                    Trạng thái xử lý PDF
                </h4>
                
                {status === 'processing' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Gemini AI đang phân tích...</span>
                            <span className="text-sm font-medium text-blue-600">{Math.round(progress || 0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${progress || 0}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-gray-600 flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-blue-600 mr-2"></div>
                            {message}
                        </p>
                    </div>
                )}

                {status === 'completed' && (
                    <div className="space-y-3">
                        <div className="flex items-center text-green-600">
                            <CheckCircle size={16} className="mr-2" />
                            <span className="font-medium">Hoàn thành phân tích</span>
                        </div>
                        <p className="text-sm text-gray-600">{message}</p>
                        
                        {result && (
                            <div className="bg-white p-3 rounded border">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">Số chunks:</span>
                                        <span className="ml-2 text-green-600 font-medium">{result.chunks_count}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">Văn bản liên quan:</span>
                                        <span className="ml-2 text-blue-600 font-medium">{result.related_documents_count}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 italic">{result.processing_summary}</p>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={handleApprovePdfChunks}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center"
                                disabled={pdfProcessingStatus?.embedded_to_chroma}
                            >
                                <CheckCircle size={16} className="mr-2" />
                                {pdfProcessingStatus?.embedded_to_chroma ? 'Đã approve' : 'Approve & Embed'}
                            </button>
                            
                            {!pdfProcessingStatus?.embedded_to_chroma && (
                                <button
                                    onClick={handleRegeneratePdfChunks}
                                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition-colors flex items-center"
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
                            <span className="font-medium">Lỗi xử lý</span>
                        </div>
                        <p className="text-sm text-red-600">{message}</p>
                        <button
                            onClick={() => {
                                setPdfProcessingId(null);
                                setPdfProcessingStatus(null);
                            }}
                            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Document List */}
                <motion.div
                    className="md:col-span-2 bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-semibold flex items-center">
                            <FileText size={18} className="text-green-600 mr-2" />
                            Danh sách văn bản
                        </h2>

                        <div className="flex items-center space-x-2">
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
                    </div>

                    <div className="p-5">
                        {isLoading ? (
                            <div className="py-4 flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {documents
                                    .filter(doc => doc.doc_id.toLowerCase().includes(documentFilter.toLowerCase()) ||
                                        doc.doc_title?.toLowerCase().includes(documentFilter.toLowerCase()))
                                    .map((document) => (
                                        <div key={document.doc_id} className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                            <div className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-sm font-medium text-gray-900 flex items-center">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2">
                                                                {document.doc_type}
                                                            </span>
                                                            {document.doc_id}
                                                            {document.embedded_in_chroma && (
                                                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                    Đã embed
                                                                </span>
                                                            )}
                                                        </h3>
                                                        <p className="mt-1 text-sm text-gray-600">{document.doc_title}</p>
                                                    </div>
                                                    <div className="flex space-x-1">
                                                        <button
                                                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                            onClick={() => {/* View document */ }}
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                            onClick={() => handleDeleteDocument(document.doc_id)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                                    <div className="flex items-center">
                                                        <Calendar size={12} className="mr-1" />
                                                        <span>Ngày hiệu lực: {document.effective_date || 'Không xác định'}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-4">
                                                        <div className="flex items-center">
                                                            <FileSymlink size={12} className="mr-1" />
                                                            <span>{document.chunks_count || 0} chunks</span>
                                                        </div>
                                                        {document.related_documents_count > 0 && (
                                                            <div className="flex items-center">
                                                                <FileText size={12} className="mr-1" />
                                                                <span>{document.related_documents_count} liên quan</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                {documents.filter(doc => doc.doc_id.toLowerCase().includes(documentFilter.toLowerCase()) ||
                                    doc.doc_title?.toLowerCase().includes(documentFilter.toLowerCase())).length === 0 && (
                                        <div className="py-10 text-center">
                                            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-3">
                                                <FileText size={24} className="text-gray-400" />
                                            </div>
                                            <p className="text-gray-500 text-sm">Không tìm thấy văn bản nào</p>
                                        </div>
                                    )}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Upload Document */}
                <motion.div
                    className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100">
                        <h2 className="text-lg font-semibold flex items-center">
                            <Upload size={18} className="text-green-600 mr-2" />
                            Tải lên văn bản
                        </h2>
                    </div>

                    <div className="p-5">
                        {/* Mode Selection */}
                        <div className="mb-6">
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
                                        <span className="text-sm font-medium text-gray-700">Tự động chia chunk bằng AI</span>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Upload file PDF, Gemini AI sẽ tự động phân tích và chia nhỏ văn bản theo logic
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
                                        <span className="text-sm font-medium text-gray-700">Upload chunk đã chia sẵn</span>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Tải lên các file chunks đã được chia nhỏ thủ công (file .md)
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Hiển thị trạng thái processing nếu có */}
                        {renderProcessingStatus()}

                        {/* Form upload tùy theo mode */}
                        {uploadMode === 'auto' ? (
                            // Form upload PDF tự động
                            <form onSubmit={handlePdfUpload}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Mã văn bản
                                        </label>
                                        <input
                                            type="text"
                                            value={pdfMetadata.doc_id}
                                            onChange={(e) => setPdfMetadata({ ...pdfMetadata, doc_id: e.target.value })}
                                            placeholder="Ví dụ: 101_2018_TT_BTC"
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                            required
                                            disabled={isProcessingPdf}
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Format: số_năm_loại_cơquan</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Loại văn bản
                                        </label>
                                        <select
                                            value={pdfMetadata.doc_type}
                                            onChange={(e) => setPdfMetadata({ ...pdfMetadata, doc_type: e.target.value })}
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                                            disabled={isProcessingPdf}
                                        >
                                            <option value="Thông tư">Thông tư</option>
                                            <option value="Nghị định">Nghị định</option>
                                            <option value="Quyết định">Quyết định</option>
                                            <option value="Pháp lệnh">Pháp lệnh</option>
                                            <option value="Luật">Luật</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tiêu đề
                                        </label>
                                        <input
                                            type="text"
                                            value={pdfMetadata.doc_title}
                                            onChange={(e) => setPdfMetadata({ ...pdfMetadata, doc_title: e.target.value })}
                                            placeholder="Nhập tiêu đề văn bản"
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                            required
                                            disabled={isProcessingPdf}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Ngày hiệu lực
                                        </label>
                                        <input
                                            type="text"
                                            value={pdfMetadata.effective_date}
                                            onChange={(e) => setPdfMetadata({ ...pdfMetadata, effective_date: e.target.value })}
                                            placeholder="DD-MM-YYYY"
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                            required
                                            disabled={isProcessingPdf}
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Định dạng: DD-MM-YYYY</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Phạm vi áp dụng
                                        </label>
                                        <select
                                            value={pdfMetadata.document_scope}
                                            onChange={(e) => setPdfMetadata({ ...pdfMetadata, document_scope: e.target.value })}
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                                            disabled={isProcessingPdf}
                                        >
                                            <option value="Quốc gia">Quốc gia</option>
                                            <option value="Địa phương">Địa phương</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            File PDF
                                        </label>
                                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
                                            <div className="space-y-1 text-center">
                                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                <div className="flex text-sm text-gray-600">
                                                    <label htmlFor="pdf-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                                                        <span>Chọn file PDF</span>
                                                        <input
                                                            id="pdf-upload"
                                                            name="pdf-upload"
                                                            type="file"
                                                            className="sr-only"
                                                            onChange={(e) => setPdfFile(e.target.files[0])}
                                                            accept=".pdf"
                                                            disabled={isProcessingPdf}
                                                        />
                                                    </label>
                                                    <p className="pl-1">hoặc kéo và thả</p>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    Chỉ hỗ trợ file PDF (tối đa 10MB)
                                                </p>
                                            </div>
                                        </div>

                                        {pdfFile && (
                                            <div className="mt-2 p-2 bg-green-50 rounded border">
                                                <p className="text-xs font-medium text-green-700">Đã chọn file:</p>
                                                <p className="text-xs text-green-600 truncate">
                                                    {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <button
                                        type="submit"
                                        disabled={isProcessingPdf || !pdfFile}
                                        className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {isProcessingPdf ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                                <span>Đang phân tích với Gemini AI...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={16} className="mr-2" />
                                                <span>Upload PDF & Phân tích tự động</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            // Form upload chunks thủ công (giữ nguyên form cũ)
                            <form onSubmit={handleUploadDocument}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Mã văn bản
                                        </label>
                                        <input
                                            type="text"
                                            value={uploadMetadata.doc_id}
                                            onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_id: e.target.value })}
                                            placeholder="Ví dụ: 101_2018_TT_BTC"
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Loại văn bản
                                        </label>
                                        <select
                                            value={uploadMetadata.doc_type}
                                            onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_type: e.target.value })}
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                                        >
                                            <option value="Thông tư">Thông tư</option>
                                            <option value="Nghị định">Nghị định</option>
                                            <option value="Quyết định">Quyết định</option>
                                            <option value="Pháp lệnh">Pháp lệnh</option>
                                            <option value="Luật">Luật</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tiêu đề
                                        </label>
                                        <input
                                            type="text"
                                            value={uploadMetadata.doc_title}
                                            onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_title: e.target.value })}
                                            placeholder="Nhập tiêu đề văn bản"
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Ngày hiệu lực
                                        </label>
                                        <input
                                            type="text"
                                            value={uploadMetadata.effective_date}
                                            onChange={(e) => setUploadMetadata({ ...uploadMetadata, effective_date: e.target.value })}
                                            placeholder="DD-MM-YYYY"
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                            required
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Định dạng: DD-MM-YYYY</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Phạm vi áp dụng
                                        </label>
                                        <select
                                            value={uploadMetadata.document_scope}
                                            onChange={(e) => setUploadMetadata({ ...uploadMetadata, document_scope: e.target.value })}
                                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                                        >
                                            <option value="Quốc gia">Quốc gia</option>
                                            <option value="Địa phương">Địa phương</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tệp chunks
                                        </label>
                                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
                                            <div className="space-y-1 text-center">
                                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                <div className="flex text-sm text-gray-600">
                                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                                                        <span>Tải tệp lên</span>
                                                        <input
                                                            id="file-upload"
                                                            name="file-upload"
                                                            type="file"
                                                            className="sr-only"
                                                            multiple
                                                            onChange={(e) => setDocumentFiles(Array.from(e.target.files))}
                                                            accept=".md,.txt"
                                                        />
                                                    </label>
                                                    <p className="pl-1">hoặc kéo và thả</p>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    Tệp Markdown (.md)
                                                </p>
                                            </div>
                                        </div>

                                        {documentFiles.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-xs font-medium text-gray-700">Đã chọn {documentFiles.length} tệp:</p>
                                                <ul className="mt-1 max-h-24 overflow-y-auto text-xs text-gray-500">
                                                    {documentFiles.map((file, index) => (
                                                        <li key={index} className="truncate">{file.name}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                                <span>Đang tải lên...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={16} className="mr-2" />
                                                <span>Tải lên văn bản</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Hướng dẫn sử dụng */}
                        <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center">
                                <AlertCircle size={14} className="mr-1" />
                                Hướng dẫn
                            </h4>
                            <div className="text-xs text-blue-600 space-y-1">
                                {uploadMode === 'auto' ? (
                                    <>
                                        <p>• Upload file PDF, Gemini AI sẽ tự động phân tích và chia chunk theo logic</p>
                                        <p>• AI sẽ trích xuất thông tin văn bản liên quan và tạo metadata hoàn chỉnh</p>
                                        <p>• Kiểm tra kết quả trước khi approve để embed vào ChromaDB</p>
                                        <p>• Có thể tạo lại nếu kết quả chưa hài lòng</p>
                                    </>
                                ) : (
                                    <>
                                        <p>• Tải lên các file chunks đã được chia sẵn (định dạng .md)</p>
                                        <p>• Dữ liệu sẽ được embed ngay vào ChromaDB</p>
                                        <p>• Đảm bảo chunks đã được chia đúng logic theo điều khoản</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default DocumentsTab;