import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, LayoutDashboard, Users, FileText, Database, BarChart2, LogOut, User, ChevronLeft } from 'lucide-react';
import { adminAPI } from '../apiService';
import { showConfirm, showError, showSuccess, clearAuthData, formatDate, pageVariants } from '../utils/formatUtils';
import TopNavBar from '../components/common/TopNavBar';
import ErrorMessage from '../components/common/ErrorMessage';
import DashboardTab from './admin/DashboardTab';
import UsersTab from './admin/UsersTab';
import DocumentsTab from './admin/DocumentsTab';
import CacheTab from './admin/CacheTab';
import BenchmarkTab from './admin/BenchmarkTab';

const AdminPage = () => {
  const navigate = useNavigate();
  
  // State quản lý tab hiện tại và dữ liệu hệ thống
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemStats, setSystemStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [benchmarkResults, setBenchmarkResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // State quản lý văn bản
  const [documentFilter, setDocumentFilter] = useState('');
  const [documentFiles, setDocumentFiles] = useState([]);
  const [uploadMetadata, setUploadMetadata] = useState({
    doc_id: '', doc_type: 'Thông tư', doc_title: '', effective_date: '', status: 'active', document_scope: 'Quốc gia'
  });

  // State quản lý benchmark
  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);

  // State quản lý cache
  const [invalidateDocId, setInvalidateDocId] = useState('');
  const [searchCacheKeyword, setSearchCacheKeyword] = useState('');

  // Các hàm fetch dữ liệu từ API
  const fetchSystemStats = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getStatus();
      setSystemStats(response);
    } catch (error) {
      console.error('Lỗi khi tải thông tin hệ thống:', error);
      setError('Không thể tải thông tin hệ thống');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getAllUsers();
      setUsers(response.users || []);
    } catch (error) {
      console.error('Lỗi khi tải danh sách người dùng:', error);
      setError('Không thể tải danh sách người dùng');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUsers = async () => {
    await fetchUsers();
  };

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getDocuments();
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Lỗi khi tải danh sách văn bản:', error);
      setError('Không thể tải danh sách văn bản');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBenchmarkResults = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getBenchmarkResults();
      setBenchmarkResults(response.results || []);
    } catch (error) {
      console.error('Lỗi khi tải kết quả benchmark:', error);
      setError('Không thể tải kết quả benchmark');
    } finally {
      setIsLoading(false);
    }
  };

  // Tải dữ liệu ban đầu khi component mount
  useEffect(() => {
    Promise.allSettled([
      fetchSystemStats(),
      fetchUsers(),
      fetchDocuments(),
      fetchBenchmarkResults()
    ]);
  }, []);

  // Lấy header xác thực từ localStorage
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}` };
  };

  // Xử lý upload văn bản
  const handleUploadDocument = async (e) => {
    e.preventDefault();

    if (!uploadMetadata.doc_id || !uploadMetadata.doc_title || !uploadMetadata.effective_date || documentFiles.length === 0) {
      showError('Vui lòng nhập đầy đủ thông tin và tải lên ít nhất một tập tin', 'Thông tin chưa đủ');
      return;
    }

    try {
      setIsLoading(true);

      const formData = new FormData();
      formData.append('metadata', JSON.stringify(uploadMetadata));

      documentFiles.forEach((file, index) => {
        formData.append('chunks', file);
      });

      const response = await fetch(`http://localhost:8001/upload-document`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      showSuccess(`Đã tải lên văn bản ${result.doc_id} với ${documentFiles.length} chunks`, 'Tải lên thành công');

      setUploadMetadata({
        doc_id: '', doc_type: 'Thông tư', doc_title: '', effective_date: '', status: 'active', document_scope: 'Quốc gia'
      });
      setDocumentFiles([]);

      await fetchDocuments();

    } catch (error) {
      console.error('Lỗi khi tải lên văn bản:', error);
      showError('Không thể tải lên văn bản. Vui lòng thử lại.', 'Lỗi tải lên');
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý xóa văn bản
  const handleDeleteDocument = async (docId) => {
    showConfirm(`Bạn có chắc chắn muốn xóa văn bản ${docId}? Hành động này không thể hoàn tác.`, 'Xác nhận xóa').then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          await adminAPI.deleteDocument(docId);
          showSuccess(`Văn bản ${docId} đã được xóa thành công`, 'Đã xóa văn bản');
          await fetchDocuments();
        } catch (error) {
          console.error('Lỗi khi xóa văn bản:', error);
          showError('Không thể xóa văn bản. Vui lòng thử lại.', 'Lỗi xóa văn bản');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Xử lý xóa toàn bộ cache
  const handleClearCache = () => {
    showConfirm('Bạn có chắc chắn muốn xóa toàn bộ cache? Hành động này không thể hoàn tác.', 'Xác nhận xóa cache').then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          await adminAPI.clearCache();
          showSuccess('Toàn bộ cache đã được xóa thành công', 'Đã xóa cache');
          await fetchSystemStats();
        } catch (error) {
          console.error('Lỗi khi xóa cache:', error);
          showError('Không thể xóa cache. Vui lòng thử lại.', 'Lỗi xóa cache');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Xử lý vô hiệu hóa cache theo document ID
  const handleInvalidateDocCache = async () => {
    if (!invalidateDocId) {
      showError('Vui lòng nhập ID văn bản để vô hiệu hóa cache.', 'Cần nhập ID văn bản');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:8001/invalidate-cache/${invalidateDocId}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to invalidate cache');
      }

      const result = await response.json();

      showSuccess(`Đã vô hiệu hóa ${result.affected_count} cache liên quan đến văn bản ${invalidateDocId}`, 'Vô hiệu hóa cache thành công');

      setInvalidateDocId('');
      await fetchSystemStats();
    } catch (error) {
      console.error('Lỗi khi vô hiệu hóa cache:', error);
      showError('Không thể vô hiệu hóa cache. Vui lòng thử lại.', 'Lỗi vô hiệu hóa cache');
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý tìm kiếm cache (chức năng đang phát triển)
  const handleSearchCache = async () => {
    if (!searchCacheKeyword) {
      showError('Vui lòng nhập từ khóa để tìm kiếm trong cache.', 'Cần nhập từ khóa');
      return;
    }

    showSuccess('Chức năng tìm kiếm cache sẽ được triển khai trong phiên bản tiếp theo.', 'Tính năng đang phát triển');
  };

  // Xử lý chạy benchmark
  const handleRunBenchmark = async () => {
    showConfirm('Quá trình benchmark có thể mất vài phút để hoàn thành. Bạn có muốn tiếp tục?', 'Xác nhận chạy benchmark').then(async (result) => {
      if (result.isConfirmed) {
        try {
          setRunningBenchmark(true);
          setBenchmarkProgress(0);

          const response = await adminAPI.runBenchmark({
            file_path: "benchmark.json",
            output_dir: "benchmark_results"
          });

          // Mô phỏng tiến trình benchmark
          const interval = setInterval(() => {
            setBenchmarkProgress(prev => {
              const newProgress = prev + Math.random() * 10;
              if (newProgress >= 100) {
                clearInterval(interval);
                return 100;
              }
              return newProgress;
            });
          }, 1000);

          setTimeout(() => {
            clearInterval(interval);
            setBenchmarkProgress(100);
            setRunningBenchmark(false);

            showSuccess(`Đã chạy benchmark thành công. Độ chính xác trung bình: ${response.stats?.avg_retrieval_score?.toFixed(2) || 'N/A'}`, 'Benchmark hoàn thành');

            fetchBenchmarkResults();
          }, 15000);

        } catch (error) {
          console.error('Lỗi khi chạy benchmark:', error);
          setRunningBenchmark(false);
          setBenchmarkProgress(0);

          showError('Không thể chạy benchmark. Vui lòng thử lại.', 'Lỗi benchmark');
        }
      }
    });
  };

  // Xử lý đăng xuất
  const handleLogout = () => {
    showConfirm('Bạn có chắc chắn muốn đăng xuất?', 'Đăng xuất').then((result) => {
      if (result.isConfirmed) {
        clearAuthData();
        navigate('/login');
      }
    });
  };

  // Xử lý làm mới toàn bộ dữ liệu
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchSystemStats(),
        fetchUsers(),
        fetchDocuments(),
        fetchBenchmarkResults()
      ]);
    } catch (error) {
      console.error('Lỗi khi làm mới dữ liệu:', error);
      setError('Không thể làm mới dữ liệu');
    } finally {
      setRefreshing(false);
    }
  };

  // Lấy tiêu đề tab hiện tại
  const getTabTitle = () => {
    const titles = {
      dashboard: 'Dashboard',
      users: 'Quản lý người dùng',
      documents: 'Quản lý văn bản',
      cache: 'Quản lý cache',
      benchmark: 'Benchmark'
    };
    return titles[activeTab] || 'Admin Panel';
  };

  // Render tab đang được chọn
  const renderActiveTab = () => {
    const commonProps = { isLoading };

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardTab 
            {...commonProps}
            systemStats={systemStats}
            users={users}
            documents={documents}
            benchmarkResults={benchmarkResults}
          />
        );
      case 'users':
        return <UsersTab {...commonProps} users={users} refreshUsers={refreshUsers} />;
      case 'documents':
        return (
          <DocumentsTab 
            {...commonProps}
            documents={documents}
            documentFilter={documentFilter}
            setDocumentFilter={setDocumentFilter}
            documentFiles={documentFiles}
            setDocumentFiles={setDocumentFiles}
            uploadMetadata={uploadMetadata}
            setUploadMetadata={setUploadMetadata}
            handleUploadDocument={handleUploadDocument}
            handleDeleteDocument={handleDeleteDocument}
          />
        );
      case 'cache':
        return (
          <CacheTab 
            {...commonProps}
            systemStats={systemStats}
            isLoading={isLoading}
            handleClearCache={handleClearCache}
          />
        );
      case 'benchmark':
        return (
          <BenchmarkTab 
            {...commonProps}
            benchmarkResults={benchmarkResults}
            runningBenchmark={runningBenchmark}
            benchmarkProgress={benchmarkProgress}
            handleRunBenchmark={handleRunBenchmark}
          />
        );
      default:
        return <DashboardTab {...commonProps} systemStats={systemStats} users={users} documents={documents} benchmarkResults={benchmarkResults} />;
    }
  };

  // Hiệu ứng animation cho sidebar
  const sidebarVariants = {
    hidden: { x: -280 },
    visible: { x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }
  };

  return (
    <motion.div
      className="flex h-screen bg-gradient-to-br from-gray-50 to-slate-100"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

      {/* Sidebar điều hướng */}
      <motion.div
        className="w-64 bg-white border-r border-gray-200 shadow-sm h-screen overflow-y-auto fixed left-0 top-0 z-10"
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col h-full">
          {/* Logo và tiêu đề */}
          <div className="px-6 py-6 bg-gradient-to-r from-green-600 to-teal-600 text-white flex items-center space-x-2">
            <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center">
              <LayoutDashboard size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Admin Panel</h1>
              <p className="text-xs text-white/80">Quản trị hệ thống</p>
            </div>
          </div>

          {/* Menu điều hướng */}
          <nav className="flex-1 p-4">
            <div className="space-y-1">
              {[
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'users', icon: Users, label: 'Quản lý người dùng' },
                { id: 'documents', icon: FileText, label: 'Quản lý văn bản' },
                { id: 'cache', icon: Database, label: 'Quản lý cache' },
                { id: 'benchmark', icon: BarChart2, label: 'Benchmark' }
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === id
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  <Icon size={18} className="mr-3" />
                  {label}
                </button>
              ))}
            </div>
          </nav>

          {/* Thông tin admin và nút đăng xuất */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <User size={20} className="text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Admin</p>
                <p className="text-xs text-gray-500">admin@example.com</p>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => navigate('/')}
                className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft size={16} className="mr-1" />
                <span>Trang chủ</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200 transition-colors"
              >
                <LogOut size={16} className="mr-1" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Khu vực nội dung chính */}
      <div className="ml-64 flex-1 overflow-x-hidden">
        <TopNavBar 
          title={getTabTitle()}
          customRight={
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                className={`flex items-center text-gray-500 hover:text-gray-700 ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw size={18} />
              </button>

              <div className="h-6 border-l border-gray-300"></div>

              <div className="text-sm text-gray-600">
                Cập nhật gần nhất: {formatDate(new Date().toISOString())}
              </div>
            </div>
          }
        />

        {renderActiveTab()}
      </div>
    </motion.div>
  );
};

export default AdminPage;