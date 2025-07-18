import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Eye, FileText, Calendar, Trash2, RotateCcw } from 'lucide-react';
import Swal from 'sweetalert2';
import { getApiBaseUrl } from '../../apiService';
import axios from 'axios';

const RestoreChunksPanel = () => {
    const [invalidatedChunks, setInvalidatedChunks] = useState([]);
    const [selectedChunks, setSelectedChunks] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [filterDoc, setFilterDoc] = useState('');
    const [filterReason, setFilterReason] = useState('');
    const [restoreAllRelated, setRestoreAllRelated] = useState(true);

    const API_BASE_URL = getApiBaseUrl();

    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    // Load invalidated chunks
    const loadInvalidatedChunks = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get(`${API_BASE_URL}/invalidated-chunks?limit=200`);
            setInvalidatedChunks(response.data.invalidated_chunks);
        } catch (error) {
            console.error('Lỗi khi tải chunks đã vô hiệu hóa:', error);
            Swal.fire({
                title: 'Lỗi',
                text: 'Không thể tải danh sách chunks đã vô hiệu hóa',
                icon: 'error',
                confirmButtonColor: '#10b981'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadInvalidatedChunks();
    }, []);

    // Filter chunks
    const filteredChunks = invalidatedChunks.filter(chunk => {
        const docMatch = !filterDoc || 
            chunk.doc_id.toLowerCase().includes(filterDoc.toLowerCase()) ||
            chunk.doc_title.toLowerCase().includes(filterDoc.toLowerCase());
        
        const reasonMatch = !filterReason || 
            chunk.invalidation_reason.toLowerCase().includes(filterReason.toLowerCase()) ||
            chunk.invalidated_by.toLowerCase().includes(filterReason.toLowerCase());
        
        return docMatch && reasonMatch;
    });

    // Toggle chunk selection
    const toggleChunkSelection = (chunkId) => {
        setSelectedChunks(prev => {
            if (prev.includes(chunkId)) {
                return prev.filter(id => id !== chunkId);
            } else {
                return [...prev, chunkId];
            }
        });
    };

    // Select all visible chunks
    const selectAllVisible = () => {
        const visibleChunkIds = filteredChunks.map(chunk => chunk.chunk_id);
        setSelectedChunks(visibleChunkIds);
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedChunks([]);
    };

    // Restore selected chunks
    const restoreSelectedChunks = async () => {
        if (selectedChunks.length === 0) {
            Swal.fire({
                title: 'Chưa chọn chunks',
                text: 'Vui lòng chọn ít nhất một chunk để khôi phục',
                icon: 'warning',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        const { value: reason } = await Swal.fire({
            title: 'Khôi phục chunks',
            html: `
                <div class="text-left">
                    <p class="mb-3">Bạn có chắc chắn muốn khôi phục <strong>${selectedChunks.length}</strong> chunks?</p>
                    
                    <div class="mb-4">
                        <label class="flex items-center">
                            <input type="checkbox" ${restoreAllRelated ? 'checked' : ''} 
                                   onchange="this.closest('.swal2-popup').querySelector('[data-restore-all]').value = this.checked">
                            <span class="ml-2 text-sm">Khôi phục tất cả cache liên quan</span>
                        </label>
                        <input type="hidden" data-restore-all value="${restoreAllRelated}">
                    </div>
                    
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Lý do khôi phục:</label>
                        <input type="text" id="restore-reason" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" 
                               placeholder="VD: Khôi phục do vô hiệu hóa nhầm..." value="Manual restoration by admin">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Khôi phục',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#6b7280',
            preConfirm: () => {
                const reason = document.getElementById('restore-reason').value;
                const restoreAll = document.querySelector('[data-restore-all]').value === 'true';
                if (!reason.trim()) {
                    Swal.showValidationMessage('Vui lòng nhập lý do khôi phục');
                    return false;
                }
                return { reason: reason.trim(), restoreAllRelated: restoreAll };
            }
        });

        if (!reason) return;

        try {
            setIsRestoring(true);

            const response = await axios.post(`${API_BASE_URL}/restore-chunks`, {
                chunk_ids: selectedChunks,
                reason: reason.reason,
                restore_all_related: reason.restoreAllRelated
            });

            await Swal.fire({
                title: 'Khôi phục thành công',
                html: `
                    <div class="text-left">
                        <p class="text-green-600 font-medium mb-3">✅ Đã khôi phục thành công!</p>
                        
                        <div class="bg-green-50 border border-green-200 rounded p-3 mb-3">
                            <p class="text-sm font-medium text-green-800 mb-2">Kết quả:</p>
                            <div class="text-sm text-green-700">
                                <div>• Main chunks: ${response.data.restored_main_chunks}</div>
                                <div>• Cache entries: ${response.data.restored_cache_entries}</div>
                                <div>• Cache chunks: ${response.data.restored_cache_chunks}</div>
                            </div>
                        </div>
                        
                        ${response.data.errors.length > 0 ? `
                            <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                                <p class="text-sm font-medium text-yellow-800 mb-2">Cảnh báo:</p>
                                <div class="text-sm text-yellow-700">
                                    ${response.data.errors.slice(0, 3).map(error => `<div>• ${error}</div>`).join('')}
                                    ${response.data.errors.length > 3 ? `<div>... và ${response.data.errors.length - 3} lỗi khác</div>` : ''}
                                </div>
                            </div>
                        ` : ''}
                        
                        <p class="text-sm text-gray-600">Các chunks đã được khôi phục sẽ hoạt động bình thường trong tìm kiếm.</p>
                    </div>
                `,
                icon: 'success',
                confirmButtonColor: '#10b981'
            });

            // Reload data và clear selection
            setSelectedChunks([]);
            await loadInvalidatedChunks();

        } catch (error) {
            console.error('Lỗi khi khôi phục chunks:', error);
            await Swal.fire({
                title: 'Lỗi khôi phục',
                html: `
                    <div class="text-left">
                        <p class="text-red-600 font-medium mb-2">❌ Không thể khôi phục chunks</p>
                        <div class="bg-red-50 border border-red-200 rounded p-3">
                            <p class="text-sm text-red-700">${error.response?.data?.detail || error.message || 'Lỗi không xác định'}</p>
                        </div>
                    </div>
                `,
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            setIsRestoring(false);
        }
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('vi-VN');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="p-6">
            <motion.div
                className="bg-white rounded-xl shadow-sm border border-gray-100"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Header */}
                <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <RotateCcw size={20} className="text-blue-600 mr-2" />
                            <h2 className="text-lg font-semibold">Khôi phục chunks đã vô hiệu hóa</h2>
                        </div>
                        <button
                            onClick={loadInvalidatedChunks}
                            disabled={isLoading}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Làm mới
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-5 border-b border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lọc theo document</label>
                            <input
                                type="text"
                                value={filterDoc}
                                onChange={(e) => setFilterDoc(e.target.value)}
                                placeholder="Mã văn bản hoặc tiêu đề..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lọc theo lý do</label>
                            <input
                                type="text"
                                value={filterReason}
                                onChange={(e) => setFilterReason(e.target.value)}
                                placeholder="Lý do vô hiệu hóa..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-end">
                            <div className="text-sm text-gray-600">
                                <div>Tổng: <span className="font-medium">{invalidatedChunks.length}</span></div>
                                <div>Hiển thị: <span className="font-medium">{filteredChunks.length}</span></div>
                                <div>Đã chọn: <span className="font-medium text-blue-600">{selectedChunks.length}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                {filteredChunks.length > 0 && (
                    <div className="p-4 border-b border-gray-100 bg-blue-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={selectAllVisible}
                                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                                >
                                    Chọn tất cả ({filteredChunks.length})
                                </button>
                                <button
                                    onClick={clearSelection}
                                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors"
                                >
                                    Bỏ chọn
                                </button>
                                <label className="flex items-center text-sm">
                                    <input
                                        type="checkbox"
                                        checked={restoreAllRelated}
                                        onChange={(e) => setRestoreAllRelated(e.target.checked)}
                                        className="mr-2"
                                    />
                                    Khôi phục tất cả cache liên quan
                                </label>
                            </div>
                            <button
                                onClick={restoreSelectedChunks}
                                disabled={selectedChunks.length === 0 || isRestoring}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isRestoring ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                                        Đang khôi phục...
                                    </>
                                ) : (
                                    <>
                                        <RotateCcw size={16} className="mr-2" />
                                        Khôi phục {selectedChunks.length > 0 ? `(${selectedChunks.length})` : ''}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="p-5">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
                        </div>
                    ) : filteredChunks.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                                <CheckCircle size={24} className="text-green-600" />
                            </div>
                            <p className="text-gray-500">
                                {invalidatedChunks.length === 0 
                                    ? 'Không có chunks nào bị vô hiệu hóa' 
                                    : 'Không có chunks nào phù hợp với bộ lọc'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredChunks.map((chunk, index) => (
                                <motion.div
                                    key={chunk.chunk_id}
                                    className={`border rounded-lg overflow-hidden transition-all cursor-pointer ${
                                        selectedChunks.includes(chunk.chunk_id)
                                            ? 'border-blue-300 bg-blue-50 shadow-sm'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    variants={fadeInVariants}
                                    initial="hidden"
                                    animate="visible"
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => toggleChunkSelection(chunk.chunk_id)}
                                >
                                    <div className="p-4">
                                        <div className="flex items-start space-x-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedChunks.includes(chunk.chunk_id)}
                                                onChange={() => toggleChunkSelection(chunk.chunk_id)}
                                                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-medium text-gray-800 break-words">
                                                        {chunk.chunk_id}
                                                    </h4>
                                                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                                        Đã vô hiệu hóa
                                                    </span>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 mb-3">
                                                    <div>
                                                        <span className="font-medium">Document:</span>
                                                        <span className="ml-1 break-words">{chunk.doc_id}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Loại:</span>
                                                        <span className="ml-1">{chunk.doc_type}</span>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <span className="font-medium">Tiêu đề:</span>
                                                        <span className="ml-1 break-words">{chunk.doc_title}</span>
                                                    </div>
                                                </div>

                                                <div className="text-sm text-gray-600 mb-3">
                                                    <span className="font-medium">Mô tả:</span>
                                                    <span className="ml-1 break-words">{chunk.content_summary}</span>
                                                </div>

                                                <div className="bg-red-50 rounded-lg p-3 mb-3 border border-red-200">
                                                    <div className="flex items-center mb-2">
                                                        <XCircle size={14} className="text-red-600 mr-2" />
                                                        <p className="text-sm font-medium text-red-800">Thông tin vô hiệu hóa:</p>
                                                    </div>
                                                    <div className="text-sm text-red-700 space-y-1">
                                                        {chunk.invalidation_reason && (
                                                            <div><span className="font-medium">Lý do:</span> {chunk.invalidation_reason}</div>
                                                        )}
                                                        {chunk.invalidated_by && (
                                                            <div><span className="font-medium">Bởi:</span> {chunk.invalidated_by}</div>
                                                        )}
                                                        {chunk.invalidated_at && (
                                                            <div><span className="font-medium">Thời gian:</span> {formatDate(chunk.invalidated_at)}</div>
                                                        )}
                                                        {chunk.related_cache_count > 0 && (
                                                            <div><span className="font-medium">Cache liên quan:</span> {chunk.related_cache_count}</div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs text-gray-500">
                                                    <div className="flex items-center space-x-4">
                                                        <span><span className="font-medium">Chunk type:</span> {chunk.chunk_type}</span>
                                                        <span><span className="font-medium">Ngày hiệu lực:</span> {chunk.effective_date || 'N/A'}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        Nguồn: {chunk.source}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default RestoreChunksPanel;