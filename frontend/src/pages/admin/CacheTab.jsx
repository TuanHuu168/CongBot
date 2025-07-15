import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, Trash2, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatDate } from '../../utils/formatUtils';

const CacheTab = ({
    systemStats,
    isLoading,
    handleClearCache
}) => {
    const [recentCache, setRecentCache] = useState([]);
    const [loadingRecentCache, setLoadingRecentCache] = useState(false);

    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    // Lấy API base URL
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

    // Hàm lấy dữ liệu cache gần đây từ API
    const fetchRecentCache = async () => {
        setLoadingRecentCache(true);
        try {
            console.log('Đang gọi API cache/recent...');
            const response = await fetch(`${API_BASE_URL}/cache/recent?limit=5`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Dữ liệu cache nhận được:', data);
            
            setRecentCache(data.recent_cache || []);
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu cache gần đây:', error);
            setRecentCache([]);
            
            // Hiển thị thông báo lỗi
            Swal.fire({
                title: 'Lỗi',
                text: 'Không thể tải dữ liệu cache: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            setLoadingRecentCache(false);
        }
    };

    // Hàm xóa cache không hợp lệ
    const handleClearInvalidCache = async () => {
        const result = await Swal.fire({
            title: 'Xác nhận xóa cache không hợp lệ',
            text: 'Bạn có chắc chắn muốn xóa tất cả cache không hợp lệ?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Xóa cache',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#eab308',
            cancelButtonColor: '#6b7280'
        });

        if (result.isConfirmed) {
            try {
                console.log('Đang gọi API clear-invalid-cache...');
                const response = await fetch(`${API_BASE_URL}/clear-invalid-cache`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('Kết quả xóa cache không hợp lệ:', data);
                
                await Swal.fire({
                    title: 'Thành công',
                    text: `Đã xóa ${data.deleted_count || 0} cache không hợp lệ`,
                    icon: 'success',
                    confirmButtonColor: '#10b981'
                });
                
                // Refresh lại dữ liệu cache
                fetchRecentCache();
            } catch (error) {
                console.error('Lỗi khi xóa cache không hợp lệ:', error);
                await Swal.fire({
                    title: 'Lỗi',
                    text: 'Không thể xóa cache không hợp lệ: ' + error.message,
                    icon: 'error',
                    confirmButtonColor: '#ef4444'
                });
            }
        }
    };

    // Hàm refresh dữ liệu cache
    const handleRefreshCache = () => {
        fetchRecentCache();
    };

    // Tự động tải dữ liệu cache khi component mount
    useEffect(() => {
        fetchRecentCache();
    }, []);

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Phần thống kê cache - giữ nguyên */}
                <motion.div
                    className="md:col-span-2 bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold flex items-center">
                                <Database size={18} className="text-green-600 mr-2" />
                                Thống kê Cache
                            </h2>
                            <button
                                onClick={handleRefreshCache}
                                disabled={loadingRecentCache}
                                className="flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                <RefreshCw size={14} className={`mr-1 ${loadingRecentCache ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    <div className="p-5">
                        {/* Phần thống kê tổng quan - giữ nguyên */}
                        {isLoading ? (
                            <div className="py-4 flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <h3 className="text-green-700 text-lg font-medium mb-2">Cache tổng quan</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Tổng số cache:</span>
                                                <span className="text-sm font-medium text-gray-900">{systemStats?.cache_stats?.total_count || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Cache hợp lệ:</span>
                                                <span className="text-sm font-medium text-gray-900">{systemStats?.cache_stats?.valid_count || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Cache không hợp lệ:</span>
                                                <span className="text-sm font-medium text-gray-900">{systemStats?.cache_stats?.invalid_count || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Hit rate:</span>
                                                <span className="text-sm font-medium text-gray-900">
                                                    {systemStats?.cache_stats?.hit_rate
                                                        ? `${(systemStats.cache_stats.hit_rate * 100).toFixed(2)}%`
                                                        : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="bg-purple-50 p-4 rounded-lg">
                                        <h3 className="text-purple-700 text-lg font-medium mb-2">Phân phối Cache</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex justify-between text-sm text-gray-600 mb-1">
                                                    <span>Cache hợp lệ vs không hợp lệ:</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    {systemStats?.cache_stats?.total_count > 0 ? (
                                                        <div
                                                            className="bg-green-600 h-2 rounded-l-full"
                                                            style={{
                                                                width: `${(systemStats.cache_stats.valid_count / systemStats.cache_stats.total_count) * 100}%`
                                                            }}
                                                        ></div>
                                                    ) : (
                                                        <div className="bg-gray-400 h-2 rounded-full" style={{ width: '100%' }}></div>
                                                    )}
                                                </div>
                                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                    <span>Hợp lệ: {systemStats?.cache_stats?.valid_count || 0}</span>
                                                    <span>Không hợp lệ: {systemStats?.cache_stats?.invalid_count || 0}</span>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between text-sm text-gray-600 mb-1">
                                                    <span>Hit rate:</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-600 h-2 rounded-full"
                                                        style={{
                                                            width: `${systemStats?.cache_stats?.hit_rate ? systemStats.cache_stats.hit_rate * 100 : 0}%`
                                                        }}
                                                    ></div>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    <span>Tỷ lệ cache hit: {systemStats?.cache_stats?.hit_rate
                                                        ? `${(systemStats.cache_stats.hit_rate * 100).toFixed(2)}%`
                                                        : '0%'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bảng hiển thị cache gần đây - cập nhật */}
                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Cache gần đây</h3>

                            {loadingRecentCache ? (
                                <div className="py-4 flex justify-center">
                                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-green-500"></div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Cache ID
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Câu hỏi
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Trạng thái
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Hit Count
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Thời gian tạo
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {recentCache.length > 0 ? (
                                                recentCache.map((cache, index) => (
                                                    <tr key={index} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                            <div className="truncate max-w-xs" title={cache.cache_id}>
                                                                {cache.cache_id}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-gray-900">
                                                            <div 
                                                                className="truncate max-w-xs cursor-help" 
                                                                title={cache.full_question || cache.question_text}
                                                            >
                                                                {cache.question_text || 'Không có câu hỏi'}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                                cache.validity_status === 'valid' 
                                                                    ? 'bg-green-100 text-green-800' 
                                                                    : cache.validity_status === 'invalid'
                                                                    ? 'bg-red-100 text-red-800'
                                                                    : 'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {cache.validity_status === 'valid' ? 'Hợp lệ' : 
                                                                 cache.validity_status === 'invalid' ? 'Không hợp lệ' : 
                                                                 'Không xác định'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                            <div className="flex items-center">
                                                                <span className="mr-1">{cache.hit_count}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                            <div>
                                                                {cache.created_at ? formatDate(cache.created_at) : 'N/A'}
                                                            </div>
                                                            {cache.last_used && cache.last_used !== cache.created_at && (
                                                                <div className="text-xs text-gray-400">
                                                                    Dùng: {formatDate(cache.last_used)}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-3 py-4 text-center text-sm text-gray-500">
                                                        {loadingRecentCache ? 'Đang tải dữ liệu...' : 'Không có dữ liệu cache'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Khu vực thao tác cache - cập nhật */}
                <motion.div
                    className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100">
                        <h2 className="text-lg font-semibold flex items-center">
                            <Database size={18} className="text-green-600 mr-2" />
                            Thao tác Cache
                        </h2>
                    </div>

                    <div className="p-5">
                        <div className="space-y-4">
                            {/* Chức năng xóa toàn bộ cache */}
                            <div className="p-4 bg-red-50 rounded-lg">
                                <h3 className="text-red-700 text-base font-medium mb-2">Xóa toàn bộ Cache</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Thao tác này sẽ xóa toàn bộ cache trong cả MongoDB và ChromaDB. Việc này có thể làm giảm hiệu năng tạm thời nhưng sẽ giúp cập nhật cache khi dữ liệu thay đổi.
                                </p>
                                <button
                                    onClick={handleClearCache}
                                    disabled={isLoading}
                                    className="flex items-center justify-center w-full py-2 px-4 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors rounded-lg text-sm font-medium"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-current mr-2"></div>
                                            <span>Đang xóa...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={16} className="mr-2" />
                                            <span>Xóa toàn bộ cache</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Chức năng xóa cache không hợp lệ */}
                            <div className="p-4 bg-yellow-50 rounded-lg">
                                <h3 className="text-yellow-700 text-base font-medium mb-2">Xóa cache không hợp lệ</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Chỉ xóa những cache đã được đánh dấu là không hợp lệ để tối ưu hóa hiệu năng hệ thống.
                                </p>
                                <button
                                    onClick={handleClearInvalidCache}
                                    disabled={isLoading}
                                    className="flex items-center justify-center w-full py-2 px-4 bg-yellow-600 text-white hover:bg-yellow-700 transition-colors rounded-lg text-sm font-medium"
                                >
                                    <Trash2 size={16} className="mr-2" />
                                    <span>Xóa cache không hợp lệ</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default CacheTab;