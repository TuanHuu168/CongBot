import React from 'react';
import { motion } from 'framer-motion';
import { Database, Trash2 } from 'lucide-react';
import { formatDate } from '../../utils/formatUtils';
import { 
  fadeInVariants, 
  AdminLoadingSpinner, 
  AdminSectionHeader,
  AdminActionButton 
} from '../../components/admin/SharedAdminComponents';

const CacheTab = ({
  systemStats, isLoading, invalidateDocId, setInvalidateDocId,
  searchCacheKeyword, setSearchCacheKeyword,
  handleClearCache, handleInvalidateDocCache, handleSearchCache
}) => {

  const CacheStatsGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="text-green-700 text-lg font-medium mb-2">Cache tổng quan</h3>
        <div className="space-y-3">
          {[
            { label: 'Tổng số cache', value: systemStats?.cache_stats?.total_count || 0 },
            { label: 'Cache hợp lệ', value: systemStats?.cache_stats?.valid_count || 0 },
            { label: 'Cache không hợp lệ', value: systemStats?.cache_stats?.invalid_count || 0 },
            { label: 'Hit rate', value: systemStats?.cache_stats?.hit_rate ? `${(systemStats.cache_stats.hit_rate * 100).toFixed(2)}%` : 'N/A' }
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-sm text-gray-600">{label}:</span>
              <span className="text-sm font-medium text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </div>

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
  );

  const CacheActions = () => (
    <div className="space-y-4">
      {/* Xóa toàn bộ cache */}
      <div className="p-4 bg-red-50 rounded-lg">
        <h3 className="text-red-700 text-base font-medium mb-2">Xóa toàn bộ Cache</h3>
        <p className="text-sm text-gray-600 mb-3">
          Thao tác này sẽ xóa toàn bộ cache trong cả MongoDB và ChromaDB.
        </p>
        <AdminActionButton
          onClick={handleClearCache}
          loading={isLoading}
          variant="danger"
          icon={Trash2}
          className="w-full"
        >
          Xóa toàn bộ cache
        </AdminActionButton>
      </div>

      {/* Vô hiệu hóa cache theo document */}
      <div className="p-4 bg-amber-50 rounded-lg">
        <h3 className="text-amber-700 text-base font-medium mb-2">Vô hiệu hóa cache</h3>
        <p className="text-sm text-gray-600 mb-3">
          Đánh dấu cache liên quan đến một văn bản cụ thể là không hợp lệ.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nhập ID văn bản..."
            value={invalidateDocId}
            onChange={(e) => setInvalidateDocId(e.target.value)}
            className="flex-1 py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          />
          <AdminActionButton
            onClick={handleInvalidateDocCache}
            loading={isLoading}
            size="md"
          >
            Áp dụng
          </AdminActionButton>
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
          <AdminActionButton
            onClick={handleSearchCache}
            loading={isLoading}
            size="md"
          >
            Tìm kiếm
          </AdminActionButton>
        </div>
      </div>
    </div>
  );

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
          <AdminSectionHeader 
            icon={Database}
            title="Thống kê Cache"
          />

          <div className="p-5">
            {isLoading ? <AdminLoadingSpinner /> : <CacheStatsGrid />}

            {/* Sample cache entries */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Mẫu cache gần đây</h3>
              {isLoading ? (
                <AdminLoadingSpinner size={6} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Cache ID', 'Câu hỏi', 'Trạng thái', 'Hit Count', 'Thời gian tạo'].map(header => (
                          <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
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
          <AdminSectionHeader 
            icon={Database}
            title="Thao tác Cache"
          />
          <div className="p-5">
            <CacheActions />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CacheTab;