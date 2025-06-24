import React from 'react';
import { motion } from 'framer-motion';
import { Database, Search, Trash2, Info } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatDate } from '../../utils/formatUtils';

const CacheTab = ({
    systemStats,
    isLoading,
    invalidateDocId,
    setInvalidateDocId,
    searchCacheKeyword,
    setSearchCacheKeyword,
    handleClearCache,
    handleInvalidateDocCache,
    handleSearchCache
}) => {
    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Cache Stats */}
                <motion.div
                    className="md:col-span-2 bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100">
                        <h2 className="text-lg font-semibold flex items-center">
                            <Database size={18} className="text-green-600 mr-2" />
                            Thống kê Cache
                        </h2>
                    </div>

                    <div className="p-5">
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

                                            {/* Hit rate visualization */}
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

                        {/* Sample cache entries */}
                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Mẫu cache gần đây</h3>

                            {isLoading ? (
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
                                            {/* Mẫu dữ liệu, thực tế sẽ được lấy từ API */}
                                            {[1, 2, 3].map((_, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                        cache_{1234567 + index}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-900">
                                                        <div className="truncate max-w-xs">
                                                            Mức trợ cấp hàng tháng cho thương binh hạng {index + 1}/4?
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                            Hợp lệ
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                        {10 - index * 3}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                        {formatDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * index).toISOString())}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Cache Actions */}
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
                            {/* Xóa toàn bộ cache */}
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

                            {/* Xóa cache không hợp lệ - Đây là nút mới */}
                            <div className="p-4 bg-yellow-50 rounded-lg">
                                <h3 className="text-yellow-700 text-base font-medium mb-2">Xóa cache không hợp lệ</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Chỉ xóa những cache đã được đánh dấu là không hợp lệ (validityStatus = invalid).
                                </p>
                                <button
                                    onClick={() => {
                                        Swal.fire({
                                            title: 'Xác nhận xóa cache không hợp lệ',
                                            text: 'Bạn có chắc chắn muốn xóa tất cả cache không hợp lệ?',
                                            icon: 'question',
                                            showCancelButton: true,
                                            confirmButtonText: 'Xóa cache',
                                            cancelButtonText: 'Hủy',
                                            confirmButtonColor: '#eab308',
                                            cancelButtonColor: '#6b7280'
                                        }).then(async (result) => {
                                            if (result.isConfirmed) {
                                                // Xử lý xóa cache không hợp lệ
                                                Swal.fire({
                                                    title: 'Thành công',
                                                    text: 'Đã xóa cache không hợp lệ',
                                                    icon: 'success',
                                                    confirmButtonColor: '#10b981'
                                                });
                                            }
                                        });
                                    }}
                                    disabled={isLoading}
                                    className="flex items-center justify-center w-full py-2 px-4 bg-yellow-600 text-white hover:bg-yellow-700 transition-colors rounded-lg text-sm font-medium"
                                >
                                    <Trash2 size={16} className="mr-2" />
                                    <span>Xóa cache không hợp lệ</span>
                                </button>
                            </div>

                            {/* Vô hiệu hóa cache */}
                            <div className="p-4 bg-amber-50 rounded-lg">
                                <h3 className="text-amber-700 text-base font-medium mb-2">Vô hiệu hóa cache</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Đánh dấu cache liên quan đến một văn bản cụ thể là không hợp lệ mà không xóa chúng.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nhập ID văn bản..."
                                        value={invalidateDocId}
                                        onChange={(e) => setInvalidateDocId(e.target.value)}
                                        className="flex-1 py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                                    />
                                    <button
                                        onClick={handleInvalidateDocCache}
                                        disabled={isLoading}
                                        className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                                    >
                                        Áp dụng
                                    </button>
                                </div>
                            </div>

                            {/* Tìm kiếm Cache */}
                            <div className="p-4 bg-blue-50 rounded-lg">
                                <h3 className="text-blue-700 text-base font-medium mb-2">Tìm kiếm Cache</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Tìm kiếm cache theo từ khóa hoặc câu hỏi.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nhập từ khóa tìm kiếm..."
                                        value={searchCacheKeyword}
                                        onChange={(e) => setSearchCacheKeyword(e.target.value)}
                                        className="flex-1 py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <button
                                        onClick={handleSearchCache}
                                        disabled={isLoading}
                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        Tìm kiếm
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default CacheTab;