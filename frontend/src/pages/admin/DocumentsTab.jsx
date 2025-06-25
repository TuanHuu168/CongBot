import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Trash2, Upload, FileText, Eye, Calendar, FileSymlink, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle, FolderOpen, File, FileImage } from 'lucide-react';
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
    // State cho upload modes
    const [uploadMode, setUploadMode] = useState('manual'); // 'manual' hoặc 'auto'
    
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

    const API_BASE_URL = getApiBaseUrl();

    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    // Poll trạng thái document processing
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
                            // Tự động fill metadata từ kết quả Gemini
                            const result = status.result;
                            const metadata = result?.metadata;
                            const autoDetected = result?.auto_detected;
                            
                            if (metadata || autoDetected) {
                                console.log('Đang tự động fill metadata từ kết quả Gemini:', {metadata, autoDetected});
                                setUploadMetadata({
                                    doc_id: autoDetected?.doc_id || metadata?.doc_id || '',
                                    doc_type: autoDetected?.doc_type || metadata?.doc_type || 'Thông tư',
                                    doc_title: autoDetected?.doc_title || metadata?.doc_title || '',
                                    effective_date: autoDetected?.effective_date || metadata?.effective_date || '',
                                    document_scope: metadata?.document_scope || 'Quốc gia'
                                });
                            }
                            
                            const fileType = status.file_type?.toUpperCase() || 'DOCUMENT';
                            const fileName = status.original_filename || 'file';
                            
                            Swal.fire({
                                title: `Phân tích ${fileType} hoàn thành`,
                                html: `
                                    <div class="text-left">
                                        <p><strong>File:</strong> ${fileName}</p>
                                        <p><strong>Kết quả:</strong> ${status.message}</p>
                                        <p><strong>Chunks:</strong> ${status.result?.chunks_count || 0}</p>
                                        <p><strong>Văn bản liên quan:</strong> ${status.result?.related_documents_count || 0}</p>
                                        <div class="mt-2 p-2 bg-blue-50 rounded">
                                            <p class="text-sm font-medium text-blue-700">Auto-detected metadata:</p>
                                            <p class="text-xs text-blue-600">• Mã văn bản: ${autoDetected?.doc_id || 'N/A'}</p>
                                            <p class="text-xs text-blue-600">• Loại: ${autoDetected?.doc_type || 'N/A'}</p>
                                            <p class="text-xs text-blue-600">• Ngày hiệu lực: ${autoDetected?.effective_date || 'N/A'}</p>
                                        </div>
                                        <p class="text-sm text-gray-600 mt-2">Thông tin đã được tự động điền vào form. Vui lòng kiểm tra và approve nếu hài lòng.</p>
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
                    console.error('Lỗi khi kiểm tra trạng thái document processing:', error);
                }
            }, 2000); // Poll mỗi 2 giây
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [documentProcessingId, isProcessingDocument, API_BASE_URL]);

    // Reset state khi chuyển mode
    useEffect(() => {
        if (uploadMode === 'manual') {
            // Reset auto mode
            setDocumentFile(null);
            setDocumentProcessingId(null);
            setDocumentProcessingStatus(null);
            setIsProcessingDocument(false);
        } else {
            // Reset manual mode
            setSelectedFolder(null);
            setFolderFiles([]);
            setFolderMetadata(null);
        }
        
        // Reset common metadata
        setUploadMetadata({
            doc_id: '',
            doc_type: 'Thông tư',
            doc_title: '',
            effective_date: '',
            document_scope: 'Quốc gia'
        });
    }, [uploadMode]);

    // Helper function để get file icon
    const getFileIcon = (fileName) => {
        const extension = fileName?.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'pdf':
                return <FileImage size={16} className="text-red-500" />;
            case 'doc':
            case 'docx':
                return <FileText size={16} className="text-blue-500" />;
            default:
                return <File size={16} className="text-gray-500" />;
        }
    };

    // Xử lý chọn folder cho manual mode
    const handleFolderSelect = async (event) => {
        const files = Array.from(event.target.files);
        console.log('Đã chọn folder với số files:', files.length);
        
        if (files.length === 0) {
            console.log('Không có file nào được chọn');
            return;
        }

        // Kiểm tra cấu trúc folder - phải có metadata.json
        const metadataFile = files.find(file => 
            file.webkitRelativePath.endsWith('metadata.json')
        );

        if (!metadataFile) {
            Swal.fire({
                title: 'Cấu trúc folder không hợp lệ',
                text: 'Folder phải chứa file metadata.json',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        try {
            console.log('Đang đọc metadata.json...');
            // Đọc metadata.json
            const metadataText = await metadataFile.text();
            const metadata = JSON.parse(metadataText);
            console.log('Metadata đã đọc:', metadata);

            // Tách chunk files (loại bỏ metadata.json)
            const chunkFiles = files.filter(file => 
                !file.webkitRelativePath.endsWith('metadata.json') &&
                (file.name.endsWith('.md') || file.name.endsWith('.txt'))
            );

            console.log('Số chunk files tìm thấy:', chunkFiles.length);

            if (chunkFiles.length === 0) {
                Swal.fire({
                    title: 'Không tìm thấy chunk files',
                    text: 'Folder phải chứa ít nhất một file chunk (.md hoặc .txt)',
                    icon: 'error',
                    confirmButtonColor: '#10b981'
                });
                return;
            }

            // Tự động fill form từ metadata
            console.log('Đang tự động fill form từ metadata...');
            setUploadMetadata({
                doc_id: metadata.doc_id || '',
                doc_type: metadata.doc_type || 'Thông tư',
                doc_title: metadata.doc_title || '',
                effective_date: metadata.effective_date || '',
                document_scope: metadata.document_scope || 'Quốc gia'
            });

            setSelectedFolder(metadataFile.webkitRelativePath.split('/')[0]); // Tên folder
            setFolderFiles(chunkFiles);
            setFolderMetadata(metadata);

            console.log('Đã cập nhật state với folder được chọn');

        } catch (error) {
            console.error('Lỗi khi đọc metadata:', error);
            Swal.fire({
                title: 'Lỗi đọc metadata',
                text: 'Không thể đọc file metadata.json. Vui lòng kiểm tra format JSON.',
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
                title: 'Chưa chọn folder',
                text: 'Vui lòng chọn folder chứa chunks và metadata.json',
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
            console.log('Bắt đầu upload manual với', folderFiles.length, 'chunk files');

            const formData = new FormData();
            formData.append('metadata', JSON.stringify(uploadMetadata));

            // Thêm tất cả chunk files
            folderFiles.forEach((file) => {
                formData.append('chunks', file);
            });

            console.log('Đang gửi request upload-document...');
            const response = await axios.post(`${API_BASE_URL}/upload-document`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log('Upload thành công:', response.data);

            Swal.fire({
                title: 'Upload thành công',
                text: `Đã upload văn bản ${response.data.doc_id} với ${folderFiles.length} chunks và embed vào ChromaDB`,
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

            // Trigger refresh documents list
            window.location.reload();

        } catch (error) {
            console.error('Lỗi upload manual:', error);
            Swal.fire({
                title: 'Lỗi upload',
                text: error.response?.data?.detail || 'Không thể upload văn bản',
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
                title: 'Chưa chọn file',
                text: 'Vui lòng chọn file tài liệu để phân tích',
                icon: 'warning',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        // Cho phép empty metadata vì Gemini sẽ auto-detect
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

            console.log('Đang upload tài liệu để Gemini phân tích với auto-detection...');
            const response = await axios.post(`${API_BASE_URL}/upload-document-auto`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setDocumentProcessingId(response.data.processing_id);
            
            const fileType = response.data.file_type?.toUpperCase() || 'DOCUMENT';
            const fileName = response.data.original_filename || documentFile.name;
            
            Swal.fire({
                title: `Bắt đầu phân tích ${fileType}`,
                html: `
                    <div class="text-left">
                        <p class="mb-2"><strong>File:</strong> ${fileName}</p>
                        <p>Hệ thống đang sử dụng <strong>Gemini AI</strong> để:</p>
                        <ul class="list-disc list-inside mt-2 text-sm">
                            <li>Trích xuất nội dung từ ${fileType}</li>
                            <li>Tự động detect: mã văn bản, loại, tiêu đề, ngày hiệu lực</li>
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
            console.error('Lỗi khi upload tài liệu:', error);
            setIsProcessingDocument(false);
            
            Swal.fire({
                title: 'Lỗi upload tài liệu',
                text: error.response?.data?.detail || 'Không thể upload file',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        }
    };

    // Approve document chunks và embed vào ChromaDB
    const handleApproveDocumentChunks = async () => {
        if (!documentProcessingId) return;

        const status = documentProcessingStatus;
        const fileType = status?.file_type?.toUpperCase() || 'DOCUMENT';

        Swal.fire({
            title: 'Xác nhận approve',
            html: `
                <div class="text-left">
                    <p>Bạn có chắc chắn muốn approve kết quả chia chunk ${fileType} này?</p>
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
                    console.log('Đang approve document chunks và embed vào ChromaDB...');
                    const response = await axios.post(`${API_BASE_URL}/approve-document-chunks/${documentProcessingId}`);
                    
                    Swal.fire({
                        title: 'Thành công',
                        text: response.data.message,
                        icon: 'success',
                        confirmButtonColor: '#10b981'
                    });

                    // Reset state và refresh documents list
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

                    // Trigger refresh documents list
                    window.location.reload();

                } catch (error) {
                    console.error('Lỗi khi approve document chunks:', error);
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

    // Tạo lại document chunks
    const handleRegenerateDocumentChunks = async () => {
        if (!documentProcessingId) return;

        const status = documentProcessingStatus;
        const fileType = status?.file_type?.toUpperCase() || 'DOCUMENT';

        Swal.fire({
            title: 'Xác nhận tạo lại',
            text: `Bạn có chắc chắn muốn tạo lại chunks ${fileType}? Kết quả hiện tại sẽ bị xóa và bạn cần upload lại file.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Tạo lại',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#6b7280'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    console.log('Đang regenerate document chunks...');
                    const response = await axios.post(`${API_BASE_URL}/regenerate-document-chunks/${documentProcessingId}`);
                    
                    Swal.fire({
                        title: 'Đã xóa kết quả cũ',
                        text: response.data.message,
                        icon: 'info',
                        confirmButtonColor: '#10b981'
                    });

                    // Reset state để upload lại
                    setDocumentProcessingId(null);
                    setDocumentProcessingStatus(null);

                } catch (error) {
                    console.error('Lỗi khi regenerate document chunks:', error);
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
        if (!documentProcessingStatus) return null;

        const { status, progress, message, result, file_type, original_filename } = documentProcessingStatus;
        const fileType = file_type?.toUpperCase() || 'DOCUMENT';
        const fileName = original_filename || 'file';

        return (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                    <Clock size={16} className="mr-2" />
                    Trạng thái xử lý {fileType}
                </h4>
                
                <div className="mb-2 flex items-center text-sm text-gray-600">
                    {getFileIcon(fileName)}
                    <span className="ml-2">{fileName}</span>
                </div>
                
                {status === 'processing' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Gemini AI đang phân tích {fileType}...</span>
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
                            <span className="font-medium">Hoàn thành phân tích {fileType}</span>
                        </div>
                        <p className="text-sm text-gray-600">{message}</p>
                        
                        {result && (
                            <div className="bg-white p-3 rounded border">
                                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                    <div>
                                        <span className="font-medium text-gray-700">Số chunks:</span>
                                        <span className="ml-2 text-green-600 font-medium">{result.chunks_count}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">Văn bản liên quan:</span>
                                        <span className="ml-2 text-blue-600 font-medium">{result.related_documents_count}</span>
                                    </div>
                                </div>
                                
                                {result.auto_detected && (
                                    <div className="bg-blue-50 p-2 rounded mb-2">
                                        <p className="text-xs font-medium text-blue-700 mb-1">Auto-detected metadata:</p>
                                        <div className="text-xs text-blue-600 space-y-1">
                                            <p>• Mã văn bản: {result.auto_detected.doc_id || 'N/A'}</p>
                                            <p>• Loại: {result.auto_detected.doc_type || 'N/A'}</p>
                                            <p>• Ngày hiệu lực: {result.auto_detected.effective_date || 'N/A'}</p>
                                        </div>
                                    </div>
                                )}
                                
                                <p className="text-xs text-gray-500 italic">{result.processing_summary}</p>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={handleApproveDocumentChunks}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center"
                                disabled={documentProcessingStatus?.embedded_to_chroma}
                            >
                                <CheckCircle size={16} className="mr-2" />
                                {documentProcessingStatus?.embedded_to_chroma ? 'Đã approve' : 'Approve & Embed'}
                            </button>
                            
                            {!documentProcessingStatus?.embedded_to_chroma && (
                                <button
                                    onClick={handleRegenerateDocumentChunks}
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
                            <span className="font-medium">Lỗi xử lý {fileType}</span>
                        </div>
                        <p className="text-sm text-red-600">{message}</p>
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
                            Danh sách văn bản ({documents.length})
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
                                                            onClick={() => {
                                                                console.log('Xem chi tiết document:', document.doc_id);
                                                                // Có thể implement modal xem chi tiết
                                                            }}
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
                                        <span className="text-sm font-medium text-gray-700 flex items-center">
                                            <File size={16} className="mr-2" />
                                            Tự động chia chunk bằng Gemini AI
                                        </span>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Upload file PDF/Word, Gemini AI sẽ tự động phân tích, detect metadata và chia chunk
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
                                            Upload folder đã chia chunk sẵn
                                        </span>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Chọn folder chứa chunks (.md) và metadata.json. Tự động đọc thông tin và embed vào ChromaDB.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Hiển thị trạng thái processing nếu có */}
                        {renderProcessingStatus()}

                        {/* Form upload tùy theo mode */}
                        {uploadMode === 'auto' ? (
                            // Form upload tài liệu tự động (PDF/Word)
                            <form onSubmit={handleDocumentUpload}>
                                <div className="space-y-4">
                                    {/* FILE UPLOAD Ở TRÊN CÙNG */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            File văn bản (PDF hoặc Word)
                                        </label>
                                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
                                            <div className="space-y-1 text-center">
                                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                <div className="flex text-sm text-gray-600">
                                                    <label htmlFor="document-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                                                        <span>Chọn file PDF hoặc Word</span>
                                                        <input
                                                            id="document-upload"
                                                            name="document-upload"
                                                            type="file"
                                                            className="sr-only"
                                                            onChange={(e) => setDocumentFile(e.target.files[0])}
                                                            accept=".pdf,.doc,.docx"
                                                            disabled={isProcessingDocument}
                                                        />
                                                    </label>
                                                    <p className="pl-1">hoặc kéo và thả</p>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    Hỗ trợ: PDF, Word (.doc, .docx) - Tối đa 10MB
                                                </p>
                                            </div>
                                        </div>

                                        {documentFile && (
                                            <div className="mt-2 p-3 bg-green-50 rounded border">
                                                <p className="text-xs font-medium text-green-700 flex items-center">
                                                    {getFileIcon(documentFile.name)}
                                                    <span className="ml-2">Đã chọn file:</span>
                                                </p>
                                                <p className="text-xs text-green-600 truncate">
                                                    {documentFile.name} ({(documentFile.size / 1024 / 1024).toFixed(2)} MB)
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Gemini sẽ tự động phân tích và điền thông tin bên dưới
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* THÔNG TIN METADATA Ở DƯỚI - sẽ được Gemini tự động điền */}
                                    <div className="border-t border-gray-200 pt-4">
                                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                                            <AlertCircle size={16} className="text-blue-500 mr-2" />
                                            Thông tin văn bản (Gemini sẽ tự động trích xuất và điền)
                                        </h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Mã văn bản
                                                </label>
                                                <input
                                                    type="text"
                                                    value={uploadMetadata.doc_id}
                                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_id: e.target.value })}
                                                    placeholder="Gemini sẽ tự động detect..."
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

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Tiêu đề văn bản
                                                </label>
                                                <input
                                                    type="text"
                                                    value={uploadMetadata.doc_title}
                                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_title: e.target.value })}
                                                    placeholder="Gemini sẽ tự động trích xuất tiêu đề..."
                                                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-gray-50"
                                                    disabled={isProcessingDocument}
                                                />
                                                <p className="mt-1 text-xs text-gray-500">Để trống để Gemini tự động trích xuất</p>
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
                                                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-gray-50"
                                                    disabled={isProcessingDocument}
                                                />
                                                <p className="mt-1 text-xs text-gray-500">Gemini tự động detect từ văn bản</p>
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

                                <div className="mt-6">
                                    <button
                                        type="submit"
                                        disabled={isProcessingDocument || !documentFile}
                                        className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {isProcessingDocument ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                                <span>Đang phân tích với Gemini AI...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={16} className="mr-2" />
                                                <span>Phân tích tự động với Gemini AI</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            // Form upload folder manual
                            <form onSubmit={handleManualUpload}>
                                <div className="space-y-4">
                                    {/* Chọn folder */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Chọn folder chứa chunks và metadata.json
                                        </label>
                                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
                                            <div className="space-y-1 text-center">
                                                <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                                                <div className="flex text-sm text-gray-600">
                                                    <label htmlFor="folder-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                                                        <span>Chọn folder</span>
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
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    Folder phải chứa metadata.json và các file chunks (.md)
                                                </p>
                                            </div>
                                        </div>

                                        {selectedFolder && (
                                            <div className="mt-2 p-3 bg-green-50 rounded border">
                                                <p className="text-xs font-medium text-green-700 flex items-center">
                                                    <FolderOpen size={14} className="mr-2" />
                                                    Đã chọn folder:
                                                </p>
                                                <p className="text-xs text-green-600">
                                                    {selectedFolder} ({folderFiles.length} chunk files)
                                                </p>
                                                {folderMetadata && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Metadata: {folderMetadata.doc_id} - {folderMetadata.doc_title}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Form metadata - tự động điền từ metadata.json */}
                                    <div className="border-t border-gray-200 pt-4">
                                        <h4 className="text-sm font-medium text-gray-700 mb-3">
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
                                                <input
                                                    type="text"
                                                    value={uploadMetadata.doc_title}
                                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_title: e.target.value })}
                                                    placeholder="Tự động điền từ metadata.json"
                                                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                                    required
                                                    disabled={isUploadingManual}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hiệu lực</label>
                                                <input
                                                    type="text"
                                                    value={uploadMetadata.effective_date}
                                                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, effective_date: e.target.value })}
                                                    placeholder="DD-MM-YYYY (tự động điền từ metadata.json)"
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

                                <div className="mt-6">
                                    <button
                                        type="submit"
                                        disabled={isUploadingManual || !selectedFolder}
                                        className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {isUploadingManual ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                                <span>Đang upload và embed...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={16} className="mr-2" />
                                                <span>Upload folder và embed vào ChromaDB</span>
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
                                        <p>• Upload file PDF/Word, Gemini AI sẽ tự động phân tích và chia chunk theo logic</p>
                                        <p>• AI sẽ trích xuất và tự động fill: mã văn bản, tiêu đề, ngày hiệu lực</p>
                                        <p>• AI cũng tìm các văn bản liên quan và tạo metadata hoàn chỉnh</p>
                                        <p>• Bạn có thể để trống metadata để Gemini tự động detect hoàn toàn</p>
                                        <p>• Kiểm tra kết quả trước khi approve để embed vào ChromaDB</p>
                                        <p>• Có thể tạo lại nếu kết quả chưa hài lòng</p>
                                    </>
                                ) : (
                                    <>
                                        <p>• Chọn folder chứa file metadata.json và các chunk files (.md)</p>
                                        <p>• Hệ thống sẽ tự động đọc metadata.json để điền form</p>
                                        <p>• Sau khi upload, dữ liệu sẽ được embed ngay vào ChromaDB</p>
                                        <p>• Cấu trúc folder: folder_name/metadata.json + chunk_1.md + chunk_2.md + ...</p>
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