import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, Database, BarChart2, Activity } from 'lucide-react';
import { formatDate } from '../../utils/formatUtils';
import { 
  fadeInVariants, 
  AdminLoadingSpinner, 
  AdminEmptyState, 
  AdminSectionHeader,
  AdminStatsCard 
} from '../../components/admin/SharedAdminComponents';

const DashboardTab = ({ systemStats, users, documents, benchmarkResults, isLoading }) => {
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  useEffect(() => {
    const fetchRecentActivities = async () => {
      try {
        setActivitiesLoading(true);
        const response = await fetch('http://localhost:8001/recent-activities?limit=8');
        if (response.ok) {
          const data = await response.json();
          setRecentActivities(data.activities || []);
        }
      } catch (error) {
        console.error('Lỗi khi tải hoạt động gần đây:', error);
      } finally {
        setActivitiesLoading(false);
      }
    };

    fetchRecentActivities();
  }, []);

  const getActivityIconAndColor = (activityType) => {
    const iconMap = {
      login: { icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      cache_clear: { icon: Database, color: 'text-red-600', bgColor: 'bg-red-100' },
      cache_invalidate: { icon: Database, color: 'text-red-600', bgColor: 'bg-red-100' },
      benchmark_start: { icon: BarChart2, color: 'text-amber-600', bgColor: 'bg-amber-100' },
      benchmark_complete: { icon: BarChart2, color: 'text-amber-600', bgColor: 'bg-amber-100' },
      benchmark_fail: { icon: BarChart2, color: 'text-red-600', bgColor: 'bg-red-100' },
      document_upload: { icon: FileText, color: 'text-green-600', bgColor: 'bg-green-100' },
      document_delete: { icon: FileText, color: 'text-green-600', bgColor: 'bg-green-100' },
      system_status: { icon: Activity, color: 'text-purple-600', bgColor: 'bg-purple-100' }
    };
    return iconMap[activityType] || { icon: Activity, color: 'text-gray-600', bgColor: 'bg-gray-100' };
  };

  const statsCards = [
    {
      title: "Người dùng",
      value: systemStats?.database?.mongodb?.user_count || users.length,
      icon: <Users size={20} className="text-blue-500" />,
      color: "blue",
      subtitle: (
        <div className="flex items-center">
          <Activity size={14} className="mr-1" />
          <span>{users.filter(u => u.status === 'active').length} người dùng hoạt động</span>
        </div>
      )
    },
    {
      title: "Văn bản", 
      value: documents.length,
      icon: <FileText size={20} className="text-green-500" />,
      color: "green",
      subtitle: (
        <div className="flex items-center">
          <Activity size={14} className="mr-1" />
          <span>{documents.reduce((sum, doc) => sum + (doc.chunks_count || 0), 0)} chunks</span>
        </div>
      )
    },
    {
      title: "Cache",
      value: systemStats?.cache_stats?.total_count || 0,
      icon: <Database size={20} className="text-purple-500" />,
      color: "purple", 
      subtitle: (
        <div className="flex items-center">
          <Activity size={14} className="mr-1" />
          <span>Hit rate: {systemStats?.cache_stats?.hit_rate ? `${(systemStats.cache_stats.hit_rate * 100).toFixed(2)}%` : 'N/A'}</span>
        </div>
      )
    },
    {
      title: "Benchmark",
      value: benchmarkResults.length,
      icon: <BarChart2 size={20} className="text-amber-500" />,
      color: "amber",
      subtitle: (
        <div className="flex items-center">
          <Activity size={14} className="mr-1" />
          <span>Kết quả gần nhất: {benchmarkResults[0]?.created_at ? formatDate(benchmarkResults[0].created_at) : 'N/A'}</span>
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      {/* Stats Overview */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6"
        variants={fadeInVariants}
        initial="hidden"
        animate="visible"
      >
        {statsCards.map((stat, index) => (
          <AdminStatsCard key={index} {...stat} loading={isLoading} />
        ))}
      </motion.div>

      {/* System Status */}
      <motion.div
        className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
        variants={fadeInVariants}
        initial="hidden"
        animate="visible"
      >
        <AdminSectionHeader 
          icon={Activity}
          title="Trạng thái hệ thống"
        />

        <div className="p-5">
          {isLoading ? (
            <AdminLoadingSpinner />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Database</h3>
                <div className="space-y-3">
                  {[
                    { label: "MongoDB", status: systemStats?.database?.mongodb?.status },
                    { label: "ChromaDB", status: systemStats?.database?.chromadb?.status }
                  ].map(({ label, status }) => (
                    <div key={label} className="flex justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">{label}:</span>
                      <span className={`text-sm font-medium ${status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                        {status === 'connected' ? (
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
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Thống kê</h3>
                <div className="space-y-3">
                  {[
                    { label: "Số documents trong ChromaDB", value: systemStats?.database?.chromadb?.documents_count || 0 },
                    { label: "Số cache hợp lệ", value: systemStats?.cache_stats?.valid_count || 0 }
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">{label}:</span>
                      <span className="text-sm font-medium text-gray-900">{value}</span>
                    </div>
                  ))}
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
        <AdminSectionHeader 
          icon={Activity}
          title="Hoạt động gần đây"
        />

        <div className="p-5">
          {activitiesLoading ? (
            <AdminLoadingSpinner size={6} />
          ) : recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity, index) => {
                const { icon: Icon, color, bgColor } = getActivityIconAndColor(activity.activity_type);
                return (
                  <div key={index} className="py-2 px-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={14} className={color} />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-gray-700">{activity.description}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(activity.timestamp)}
                          {activity.user_email && <span className="ml-2">• {activity.user_email}</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState 
              icon={Activity}
              title="Chưa có hoạt động nào được ghi nhận"
            />
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardTab;