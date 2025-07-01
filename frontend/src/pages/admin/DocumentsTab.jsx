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

    const API_BASE_URL = getApiBaseUrl();

    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    // Polling trạng thái document processing
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
                                console.log('Đang tự động điền metadata từ kết quả Gemini:', { metadata, autoDetected });
                                setUploadMetadata({
                                    doc_id: autoDetected?.doc_id || metadata?.doc_id || '',
                                    doc_type: autoDetected?.doc_type || metadata?.doc_type || 'Thông tư',
                                    doc_title: autoDetected?.doc_title || metadata?.doc_title || '',
                                    effective_date: autoDetected?.effective_date || metadata?.effective_date || '',
                                    document_scope: metadata?.document_scope || 'Quốc gia'
                                });
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
                                            <p class="text-xs text-blue-600">• Mã văn bản: ${autoDetected?.doc_id || 'Không xác định'}</p>
                                            <p class="text-xs text-blue-600">• Loại: ${autoDetected?.doc_type || 'Không xác định'}</p>
                                            <p class="text-xs text-blue-600">• Ngày hiệu lực: ${autoDetected?.effective_date || 'Không xác định'}</p>
                                        </div>
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
    }, [uploadMode]);

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

    // Helper function để get file icon
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

    // Xử lý chọn folder cho manual mode
    const handleFolderSelect = async (event) => {
        const files = Array.from(event.target.files);
        console.log('Đã chọn thư mục với số tệp:', files.length);

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

            console.log('Đang tự động điền biểu mẫu từ metadata...');
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
            confirmButtonText: 'Phê duyệt & Nhúng',
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

                    // Reset state và làm mới danh sách tài liệu KHÔNG redirect
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

                    // Làm mới chỉ danh sách tài liệu, KHÔNG reload toàn bộ trang
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

    // Render trạng thái xử lý
    const renderProcessingStatus = () => {
        if (!documentProcessingStatus) return null;

        const { status, progress, message, result, file_type, original_filename } = documentProcessingStatus;
        const fileType = file_type?.toUpperCase() || 'TÀI LIỆU';
        const fileName = original_filename || 'tệp';

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
                                        <p className="text-xs font-medium text-blue-700 mb-1">Thông tin được phát hiện tự động:</p>
                                        <div className="text-xs text-blue-600 space-y-1">
                                            <p>• Mã văn bản: {result.auto_detected.doc_id || 'Không xác định'}</p>
                                            <p>• Loại: {result.auto_detected.doc_type || 'Không xác định'}</p>
                                            <p>• Ngày hiệu lực: {result.auto_detected.effective_date || 'Không xác định'}</p>
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-gray-500 italic break-words">{result.processing_summary}</p>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={handleApproveDocumentChunks}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center"
                                disabled={documentProcessingStatus?.embedded_to_chroma}
                            >
                                <CheckCircle size={16} className="mr-2" />
                                {documentProcessingStatus?.embedded_to_chroma ? 'Đã phê duyệt' : 'Phê duyệt & Nhúng'}
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
                        <p className="text-sm text-red-600 break-words">{message}</p>
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

    // Render tab tải lên dữ liệu
    const renderUploadTab = () => (
        <div className="space-y-6">
            {/* Mode Selection */}
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

            {/* Hiển thị trạng thái xử lý nếu có */}
            {renderProcessingStatus()}

            {/* Form upload tùy theo mode */}
            {uploadMode === 'auto' ? (
                // Form upload tài liệu tự động (PDF/Word)
                <form onSubmit={handleDocumentUpload} className="space-y-6">
                    {/* FILE UPLOAD Ở TRÊN CÙNG */}
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

                    {/* THÔNG TIN METADATA Ở DƯỚI */}
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
                // Form upload folder manual
                <form onSubmit={handleManualUpload} className="space-y-6">
                    {/* Chọn thư mục */}
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
                                        Metadata: {folderMetadata.doc_id} - {folderMetadata.doc_title}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Form metadata */}
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

            {/* Hướng dẫn sử dụng */}
            <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center">
                    <AlertCircle size={14} className="mr-1" />
                    Hướng dẫn
                </h4>
                <div className="text-xs text-blue-600 space-y-1">
                    {uploadMode === 'auto' ? (
                        <>
                            <p>• Tải lên tệp PDF/Word/Markdown, Gemini AI sẽ tự động phân tích và chia chunk theo logic</p>
                            <p>• AI sẽ trích xuất và tự động điền: mã văn bản, tiêu đề, ngày hiệu lực</p>
                            <p>• AI cũng tìm các văn bản liên quan và tạo metadata hoàn chỉnh</p>
                            <p>• Bạn có thể để trống metadata để Gemini tự động phát hiện hoàn toàn</p>
                            <p>• Kiểm tra kết quả trước khi phê duyệt để nhúng vào ChromaDB</p>
                            <p>• Có thể tạo lại nếu kết quả chưa hài lòng</p>
                        </>
                    ) : (
                        <>
                            <p>• Chọn thư mục chứa tệp metadata.json và các tệp chunk (.md)</p>
                            <p>• Hệ thống sẽ tự động đọc metadata.json để điền biểu mẫu</p>
                            <p>• Sau khi tải lên, dữ liệu sẽ được nhúng ngay vào ChromaDB</p>
                            <p>• Cấu trúc thư mục: tên_thư_mục/metadata.json + chunk_1.md + chunk_2.md + ...</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    // Render tab xem thông tin chunks
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
                            {doc.doc_id}
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
                    {/* Thông tin tổng quan */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-medium text-gray-700 mb-2">Thông tin tổng quan</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-gray-600">Mã văn bản:</span>
                                <span className="ml-2 break-words">{chunkInfo.doc_info.doc_type}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600">Loại:</span>
                                <span className="ml-2">{chunkInfo.doc_info.doc_type}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="font-medium text-gray-600">Tiêu đề:</span>
                                <span className="ml-2 break-words">{chunkInfo.doc_info.doc_title}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600">Ngày hiệu lực:</span>
                                <span className="ml-2">{chunkInfo.doc_info.effective_date}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600">Tổng chunks:</span>
                                <span className="ml-2 text-green-600 font-medium">{chunkInfo.doc_info.total_chunks}</span>
                            </div>
                        </div>
                    </div>

                    {/* Danh sách chunks */}
                    <div>
                        <h3 className="font-medium text-gray-700 mb-3">Chi tiết các chunks</h3>
                        <div className="space-y-3">
                            {chunkInfo.chunks.map((chunk, index) => (
                                <div key={chunk.chunk_id} className="border border-gray-200 rounded-lg">
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-medium text-gray-800 break-words">
                                                {chunk.chunk_id}
                                            </h4>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${chunk.exists
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                                }`}>
                                                {chunk.exists ? 'Tồn tại' : 'Không tồn tại'}
                                            </span>
                                        </div>

                                        <div className="text-sm text-gray-600 mb-2 break-words">
                                            <span className="font-medium">Mô tả:</span> {chunk.content_summary}
                                        </div>

                                        <div className="text-xs text-gray-500 mb-3">
                                            <span className="font-medium">Loại:</span> {chunk.chunk_type} |
                                            <span className="font-medium ml-2">Số từ:</span> {chunk.word_count} |
                                            <span className="font-medium ml-2">Đường dẫn:</span> {chunk.file_path}
                                        </div>

                                        {chunk.exists && chunk.content && (
                                            <div className="bg-gray-50 p-3 rounded border">
                                                <p className="text-xs font-medium text-gray-600 mb-2">Nội dung:</p>
                                                <div className="text-sm text-gray-700 max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                                                    {chunk.content}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!chunkInfo && !loadingChunks && selectedDocForChunks && (
                <div className="text-center py-8 text-gray-500">
                    Không có thông tin chunk để hiển thị
                </div>
            )}
        </div>
    );

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Phần tải lên và xem chunk info - CHIẾM NHIỀU KHÔNG GIAN HỠN */}
                <motion.div
                    className="bg-white rounded-xl shadow-sm border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="border-b border-gray-100">
                        {/* Tab navigation */}
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

                {/* Danh sách văn bản - CHIẾM ÍT KHÔNG GIAN HỞN */}
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

                    <div className="p-5 overflow-y-auto">
                        {isLoading ? (
                            <div className="py-4 flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {documents
                                    .filter(doc =>
                                        doc.doc_id.toLowerCase().includes(documentFilter.toLowerCase()) ||
                                        doc.doc_title?.toLowerCase().includes(documentFilter.toLowerCase())
                                    )
                                    .map((document) => (
                                        <div key={document.doc_id} className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                            <div className="p-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-sm font-medium text-gray-900 flex items-center mb-1">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2 flex-shrink-0">
                                                                {document.doc_type}
                                                            </span>
                                                            <span className="break-words">{document.doc_id}</span>
                                                        </h3>
                                                        <p className="text-sm text-gray-600 break-words">{document.doc_title}</p>
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

                                                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                                    <div className="flex items-center">
                                                        <Calendar size={12} className="mr-1 flex-shrink-0" />
                                                        <span className="break-words">Ngày hiệu lực: {document.effective_date || 'Không xác định'}</span>
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
                                        </div>
                                    ))}

                                {documents.filter(doc =>
                                    doc.doc_id.toLowerCase().includes(documentFilter.toLowerCase()) ||
                                    doc.doc_title?.toLowerCase().includes(documentFilter.toLowerCase())
                                ).length === 0 && (
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
            </div>
        </div>
    );
};

export default DocumentsTab;