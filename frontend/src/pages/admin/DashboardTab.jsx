import React from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, Database, BarChart2, Activity } from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import { formatDate } from '../../utils/formatUtils';

const DashboardTab = ({ systemStats, users, documents, benchmarkResults, isLoading }) => {
    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    return (
        <div className="p-6">
            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
            >
                {/* User stats card */}
                <StatCard
                    title="Người dùng"
                    value={systemStats?.database?.mongodb?.user_count || users.length}
                    icon={<Users size={20} className="text-blue-500" />}
                    color="blue"
                    isLoading={isLoading}
                    subtitle={
                        <div className="flex items-center">
                            <Activity size={14} className="mr-1" />
                            <span>{users.filter(u => u.status === 'active').length} người dùng hoạt động</span>
                        </div>
                    }
                />

                {/* Document stats card */}
                <StatCard
                    title="Văn bản"
                    value={documents.length}
                    icon={<FileText size={20} className="text-green-500" />}
                    color="green"
                    isLoading={isLoading}
                    subtitle={
                        <div className="flex items-center">
                            <Activity size={14} className="mr-1" />
                            <span>
                                {documents.reduce((sum, doc) => sum + (doc.chunks_count || 0), 0)} chunks
                            </span>
                        </div>
                    }
                />

                {/* Cache stats card */}
                <StatCard
                    title="Cache"
                    value={systemStats?.cache_stats?.total_count || 0}
                    icon={<Database size={20} className="text-purple-500" />}
                    color="purple"
                    isLoading={isLoading}
                    subtitle={
                        <div className="flex items-center">
                            <Activity size={14} className="mr-1" />
                            <span>Hit rate: {systemStats?.cache_stats?.hit_rate ? `${(systemStats.cache_stats.hit_rate * 100).toFixed(2)}%` : 'N/A'}</span>
                        </div>
                    }
                />

                {/* Benchmark stats card */}
                <StatCard
                    title="Benchmark"
                    value={benchmarkResults.length}
                    icon={<BarChart2 size={20} className="text-amber-500" />}
                    color="amber"
                    isLoading={isLoading}
                    subtitle={
                        <div className="flex items-center">
                            <Activity size={14} className="mr-1" />
                            <span>Kết quả gần nhất: {benchmarkResults[0]?.created_at ? formatDate(benchmarkResults[0].created_at) : 'N/A'}</span>
                        </div>
                    }
                />
            </motion.div>

            {/* System Status */}
            <motion.div
                className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="p-5 border-b border-gray-100">
                    <h2 className="text-lg font-semibold flex items-center">
                        <Activity size={18} className="text-green-600 mr-2" />
                        Trạng thái hệ thống
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
                                <h3 className="text-sm font-medium text-gray-500 mb-3">Database</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-sm text-gray-600">MongoDB:</span>
                                        <span className={`text-sm font-medium ${systemStats?.database?.mongodb?.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                                            {systemStats?.database?.mongodb?.status === 'connected' ? (
                                                <span className="flex items-center">
                                                    <div className="w-2 h-3.5 border-r-2 border-b-2 border-green-600 transform rotate-45 translate-y-[-1px] mr-1"></div>
                                                    Kết nối
                                                </span>
                                            ) : (
                                                <span className="flex items-center">
                                                    <div className="w-3 h-3 text-red-600 mr-1">×</div>
                                                    Mất kết nối
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="flex justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-sm text-gray-600">ChromaDB:</span>
                                        <span className={`text-sm font-medium ${systemStats?.database?.chromadb?.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                                            {systemStats?.database?.chromadb?.status === 'connected' ? (
                                                <span className="flex items-center">
                                                    <div className="w-2 h-3.5 border-r-2 border-b-2 border-green-600 transform rotate-45 translate-y-[-1px] mr-1"></div>
                                                    Kết nối
                                                </span>
                                            ) : (
                                                <span className="flex items-center">
                                                    <div className="w-3 h-3 text-red-600 mr-1">×</div>
                                                    Mất kết nối
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-gray-500 mb-3">Thống kê</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-sm text-gray-600">Số documents trong ChromaDB:</span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {systemStats?.database?.chromadb?.documents_count || 0}
                                        </span>
                                    </div>

                                    <div className="flex justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-sm text-gray-600">Số cache hợp lệ:</span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {systemStats?.cache_stats?.valid_count || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
                className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="p-5 border-b border-gray-100">
                    <h2 className="text-lg font-semibold flex items-center">
                        <Activity size={18} className="text-green-600 mr-2" />
                        Hoạt động gần đây
                    </h2>
                </div>

                <div className="p-5">
                    <div className="space-y-4">
                        {/* Recent logins */}
                        <div className="py-2 px-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <Users size={14} className="text-blue-600" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-gray-700">
                                        <span className="font-medium">{users[0]?.email || 'admin@example.com'}</span> đã đăng nhập
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatDate(users[0]?.lastLogin || new Date().toISOString())}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Recent document upload */}
                        {documents.length > 0 && (
                            <div className="py-2 px-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <FileText size={14} className="text-green-600" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-gray-700">
                                            <span className="font-medium">{documents[0]?.doc_id || 'Document'}</span> đã được tải lên
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatDate(new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recent benchmark */}
                        {benchmarkResults.length > 0 && (
                            <div className="py-2 px-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                        <BarChart2 size={14} className="text-amber-600" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-gray-700">
                                            <span className="font-medium">Benchmark</span> đã được chạy
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatDate(benchmarkResults[0]?.created_at || new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString())}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recent cache clear */}
                        <div className="py-2 px-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                    <Database size={14} className="text-red-600" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-gray-700">
                                        <span className="font-medium">Cache</span> đã được xóa
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatDate(new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString())}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default DashboardTab;