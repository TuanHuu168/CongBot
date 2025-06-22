import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Upload, Info } from 'lucide-react';
import { adminAPI } from '../apiService';
import TopNavBar from '../components/common/TopNavBar';
import AdminSidebar from '../components/admin/AdminSidebar';
import ErrorMessage from '../components/common/ErrorMessage';
import DashboardTab from './admin/DashboardTab';
import UsersTab from './admin/UsersTab';
import DocumentsTab from './admin/DocumentsTab';
import CacheTab from './admin/CacheTab';
import BenchmarkTab from './admin/BenchmarkTab';
import { formatDate, pageVariants, showConfirm, showError, showSuccess, clearAuthData } from '../utils/formatUtils';

const AdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemStats, setSystemStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [benchmarkResults, setBenchmarkResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [adminAuth, setAdminAuth] = useState(true);

  const [documentFilter, setDocumentFilter] = useState('');
  const [documentFiles, setDocumentFiles] = useState([]);
  const [uploadMetadata, setUploadMetadata] = useState({
    doc_id: '', doc_type: 'Thông tư', doc_title: '', effective_date: '', status: 'active', document_scope: 'Quốc gia'
  });

  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);

  const [invalidateDocId, setInvalidateDocId] = useState('');
  const [searchCacheKeyword, setSearchCacheKeyword] = useState('');

  useEffect(() => {
    if (adminAuth) {
      fetchSystemStats();
      fetchUsers();
      fetchDocuments();
      fetchBenchmarkResults();
    }
  }, [adminAuth]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchSystemStats = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getStatus();
      setSystemStats(response);
    } catch (error) {
      console.error('Error fetching system stats:', error);
      setError('Không thể tải thông tin hệ thống');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      try {
        const response = await adminAPI.getStatistics();
        if (response && response.users) {
          setUsers(response.users.map(user => ({
            id: user.id || user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName || user.name,
            role: user.role || 'user',
            status: user.status || 'active',
            lastLogin: user.lastLogin || user.lastLoginAt
          })));
          return;
        }
      } catch (e) {
        console.log('Không thể lấy thông tin người dùng từ endpoint statistics, thử phương pháp khác...');
      }

      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      if (userId) {
        setUsers([
          { id: '1', username: 'admin', email: 'admin@example.com', role: 'admin', status: 'active', lastLogin: new Date().toISOString() }
        ]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Không thể tải danh sách người dùng');
      setUsers([
        { id: '1', username: 'admin', email: 'admin@example.com', role: 'admin', status: 'active', lastLogin: new Date().toISOString() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getDocuments();
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
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
      console.error('Error fetching benchmark results:', error);
      setError('Không thể tải kết quả benchmark');
    } finally {
      setIsLoading(false);
    }
  };

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

      fetchDocuments();

    } catch (error) {
      console.error('Error uploading document:', error);
      showError('Không thể tải lên văn bản. Vui lòng thử lại.', 'Lỗi tải lên');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    showConfirm(`Bạn có chắc chắn muốn xóa văn bản ${docId}? Hành động này không thể hoàn tác.`, 'Xác nhận xóa').then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          await adminAPI.deleteDocument(docId);
          showSuccess(`Văn bản ${docId} đã được xóa thành công`, 'Đã xóa văn bản');
          fetchDocuments();
        } catch (error) {
          console.error('Error deleting document:', error);
          showError('Không thể xóa văn bản. Vui lòng thử lại.', 'Lỗi xóa văn bản');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleClearCache = () => {
    showConfirm('Bạn có chắc chắn muốn xóa toàn bộ cache? Hành động này không thể hoàn tác.', 'Xác nhận xóa cache').then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          await adminAPI.clearCache();
          showSuccess('Toàn bộ cache đã được xóa thành công', 'Đã xóa cache');
          fetchSystemStats();
        } catch (error) {
          console.error('Error clearing cache:', error);
          showError('Không thể xóa cache. Vui lòng thử lại.', 'Lỗi xóa cache');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

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
      fetchSystemStats();
    } catch (error) {
      console.error('Error invalidating cache:', error);
      showError('Không thể vô hiệu hóa cache. Vui lòng thử lại.', 'Lỗi vô hiệu hóa cache');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchCache = async () => {
    if (!searchCacheKeyword) {
      showError('Vui lòng nhập từ khóa để tìm kiếm trong cache.', 'Cần nhập từ khóa');
      return;
    }

    showSuccess('Chức năng tìm kiếm cache sẽ được triển khai trong phiên bản tiếp theo.', 'Tính năng đang phát triển');
  };

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
          console.error('Error running benchmark:', error);
          setRunningBenchmark(false);
          setBenchmarkProgress(0);

          showError('Không thể chạy benchmark. Vui lòng thử lại.', 'Lỗi benchmark');
        }
      }
    });
  };

  const handleLogout = () => {
    showConfirm('Bạn có chắc chắn muốn đăng xuất?', 'Đăng xuất').then((result) => {
      if (result.isConfirmed) {
        clearAuthData();
        navigate('/login');
      }
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchSystemStats(),
        fetchUsers(),
        fetchDocuments(),
        fetchBenchmarkResults()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Không thể làm mới dữ liệu');
    } finally {
      setRefreshing(false);
    }
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

      <AdminSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleLogout={handleLogout} 
        navigate={navigate} 
      />

      <div className="ml-64 flex-1 overflow-x-hidden">
        <TopNavBar 
          title={activeTab === 'dashboard' && 'Dashboard' || 
                activeTab === 'users' && 'Quản lý người dùng' || 
                activeTab === 'documents' && 'Quản lý văn bản' || 
                activeTab === 'cache' && 'Quản lý cache' ||
                activeTab === 'benchmark' && 'Benchmark'}
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

        {activeTab === 'dashboard' && (
          <DashboardTab 
            systemStats={systemStats} 
            users={users} 
            documents={documents} 
            benchmarkResults={benchmarkResults} 
            isLoading={isLoading} 
          />
        )}

        {activeTab === 'users' && (
          <UsersTab users={users} isLoading={isLoading} />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab 
            documents={documents} 
            isLoading={isLoading} 
            documentFilter={documentFilter}
            setDocumentFilter={setDocumentFilter}
            documentFiles={documentFiles}
            setDocumentFiles={setDocumentFiles}
            uploadMetadata={uploadMetadata}
            setUploadMetadata={setUploadMetadata}
            handleUploadDocument={handleUploadDocument}
            handleDeleteDocument={handleDeleteDocument}
          />
        )}

        {activeTab === 'cache' && (
          <CacheTab 
            systemStats={systemStats} 
            isLoading={isLoading} 
            invalidateDocId={invalidateDocId}
            setInvalidateDocId={setInvalidateDocId}
            searchCacheKeyword={searchCacheKeyword}
            setSearchCacheKeyword={setSearchCacheKeyword}
            handleClearCache={handleClearCache}
            handleInvalidateDocCache={handleInvalidateDocCache}
            handleSearchCache={handleSearchCache}
          />
        )}

        {activeTab === 'benchmark' && (
          <BenchmarkTab 
            benchmarkResults={benchmarkResults} 
            isLoading={isLoading}
            runningBenchmark={runningBenchmark}
            benchmarkProgress={benchmarkProgress}
            handleRunBenchmark={handleRunBenchmark}
          />
        )}
      </div>
    </motion.div>
  );
};

export default AdminPage;