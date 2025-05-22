import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Upload, Info } from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';

// Components
import TopNavBar from '../components/common/TopNavBar';
import AdminSidebar from '../components/admin/AdminSidebar';
import ErrorMessage from '../components/common/ErrorMessage';

// Tabs
import DashboardTab from './admin/DashboardTab';
import UsersTab from './admin/UsersTab';
import DocumentsTab from './admin/DocumentsTab';
import CacheTab from './admin/CacheTab';
import BenchmarkTab from './admin/BenchmarkTab';

// Utils
import { formatDate } from '../utils/formatUtils';

// URL cơ sở của API backend
const API_BASE_URL = 'http://localhost:8001';

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
  const [adminAuth, setAdminAuth] = useState(true); // Giả định đã xác thực admin

  // Các state cho quản lý tài liệu
  const [documentFilter, setDocumentFilter] = useState('');
  const [documentFiles, setDocumentFiles] = useState([]);
  const [uploadMetadata, setUploadMetadata] = useState({
    doc_id: '',
    doc_type: 'Thông tư',
    doc_title: '',
    effective_date: '',
    status: 'active',
    document_scope: 'Quốc gia'
  });

  // Các state cho quản lý benchmark
  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);

  // Các state cho quản lý cache
  const [invalidateDocId, setInvalidateDocId] = useState('');
  const [searchCacheKeyword, setSearchCacheKeyword] = useState('');

  // Fetch initial data
  useEffect(() => {
    if (adminAuth) {
      fetchSystemStats();
      fetchUsers();
      fetchDocuments();
      fetchBenchmarkResults();
    }
  }, [adminAuth]);

  // Helper để lấy authentication headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    return {
      Authorization: `Bearer ${token}`
    };
  };

  // Fetch system statistics
  const fetchSystemStats = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/status`, {
        headers: getAuthHeaders()
      });
      setSystemStats(response.data);
    } catch (error) {
      console.error('Error fetching system stats:', error);
      setError('Không thể tải thông tin hệ thống');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user data
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      // Thử lấy danh sách người dùng từ endpoint thống kê (nếu có)
      try {
        const response = await axios.get(`${API_BASE_URL}/statistics`, {
          headers: getAuthHeaders()
        });

        if (response.data && response.data.users) {
          // Nếu có dữ liệu về user từ endpoint statistics
          setUsers(response.data.users.map(user => ({
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

      // Nếu không có API riêng cho admin, sử dụng dữ liệu người dùng hiện tại
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      if (userId) {
        const userResponse = await axios.get(`${API_BASE_URL}/users/${userId}`, {
          headers: getAuthHeaders()
        });

        if (userResponse.data) {
          // Giả sử chỉ có user hiện tại
          setUsers([{
            id: userId,
            username: userResponse.data.username,
            email: userResponse.data.email,
            fullName: userResponse.data.fullName,
            role: 'admin', // Giả định người đang đăng nhập là admin
            status: 'active',
            lastLogin: new Date().toISOString()
          }]);
        }
      } else {
        // Fallback nếu không lấy được dữ liệu thực
        setUsers([
          { id: '1', username: 'admin', email: 'admin@example.com', role: 'admin', status: 'active', lastLogin: new Date().toISOString() }
        ]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Không thể tải danh sách người dùng');
      // Fallback nếu có lỗi
      setUsers([
        { id: '1', username: 'admin', email: 'admin@example.com', role: 'admin', status: 'active', lastLogin: new Date().toISOString() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/documents`, {
        headers: getAuthHeaders()
      });
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Không thể tải danh sách văn bản');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch benchmark results
  const fetchBenchmarkResults = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/benchmark-results`, {
        headers: getAuthHeaders()
      });
      setBenchmarkResults(response.data.results || []);
    } catch (error) {
      console.error('Error fetching benchmark results:', error);
      setError('Không thể tải kết quả benchmark');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file upload form submit
  const handleUploadDocument = async (e) => {
    e.preventDefault();

    if (!uploadMetadata.doc_id || !uploadMetadata.doc_title || !uploadMetadata.effective_date || documentFiles.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Thông tin chưa đủ',
        text: 'Vui lòng nhập đầy đủ thông tin và tải lên ít nhất một tập tin',
        confirmButtonColor: '#10b981'
      });
      return;
    }

    try {
      setIsLoading(true);

      const formData = new FormData();
      formData.append('metadata', JSON.stringify(uploadMetadata));

      documentFiles.forEach((file, index) => {
        formData.append('chunks', file);
      });

      const response = await axios.post(`${API_BASE_URL}/upload-document`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });

      Swal.fire({
        icon: 'success',
        title: 'Tải lên thành công',
        text: `Đã tải lên văn bản ${response.data.doc_id} với ${documentFiles.length} chunks`,
        confirmButtonColor: '#10b981',
        timer: 2000
      });

      // Reset form
      setUploadMetadata({
        doc_id: '',
        doc_type: 'Thông tư',
        doc_title: '',
        effective_date: '',
        status: 'active',
        document_scope: 'Quốc gia'
      });
      setDocumentFiles([]);

      // Refresh document list
      fetchDocuments();

    } catch (error) {
      console.error('Error uploading document:', error);
      Swal.fire({
        icon: 'error',
        title: 'Lỗi tải lên',
        text: error.response?.data?.detail || 'Không thể tải lên văn bản. Vui lòng thử lại.',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete document
  const handleDeleteDocument = async (docId) => {
    Swal.fire({
      title: 'Xác nhận xóa',
      text: `Bạn có chắc chắn muốn xóa văn bản ${docId}? Hành động này không thể hoàn tác.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          await axios.delete(`${API_BASE_URL}/documents/${docId}?confirm=true`, {
            headers: getAuthHeaders()
          });

          Swal.fire({
            icon: 'success',
            title: 'Đã xóa văn bản',
            text: `Văn bản ${docId} đã được xóa thành công`,
            confirmButtonColor: '#10b981',
            timer: 2000
          });

          // Refresh document list
          fetchDocuments();

        } catch (error) {
          console.error('Error deleting document:', error);
          Swal.fire({
            icon: 'error',
            title: 'Lỗi xóa văn bản',
            text: error.response?.data?.detail || 'Không thể xóa văn bản. Vui lòng thử lại.',
            confirmButtonColor: '#10b981'
          });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Handle clear cache
  const handleClearCache = () => {
    Swal.fire({
      title: 'Xác nhận xóa cache',
      text: 'Bạn có chắc chắn muốn xóa toàn bộ cache? Hành động này không thể hoàn tác.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Xóa cache',
      cancelButtonText: 'Hủy'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          await axios.post(`${API_BASE_URL}/clear-cache`, {}, {
            headers: getAuthHeaders()
          });

          Swal.fire({
            icon: 'success',
            title: 'Đã xóa cache',
            text: 'Toàn bộ cache đã được xóa thành công',
            confirmButtonColor: '#10b981',
            timer: 2000
          });

          // Refresh system stats
          fetchSystemStats();

        } catch (error) {
          console.error('Error clearing cache:', error);
          Swal.fire({
            icon: 'error',
            title: 'Lỗi xóa cache',
            text: error.response?.data?.detail || 'Không thể xóa cache. Vui lòng thử lại.',
            confirmButtonColor: '#10b981'
          });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Handle invalidate cache for document
  const handleInvalidateDocCache = async () => {
    if (!invalidateDocId) {
      Swal.fire({
        icon: 'warning',
        title: 'Cần nhập ID văn bản',
        text: 'Vui lòng nhập ID văn bản để vô hiệu hóa cache.',
        confirmButtonColor: '#10b981'
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.post(`${API_BASE_URL}/invalidate-cache/${invalidateDocId}`, {}, {
        headers: getAuthHeaders()
      });

      Swal.fire({
        icon: 'success',
        title: 'Vô hiệu hóa cache thành công',
        text: `Đã vô hiệu hóa ${response.data.affected_count} cache liên quan đến văn bản ${invalidateDocId}`,
        confirmButtonColor: '#10b981',
        timer: 2000
      });

      setInvalidateDocId('');
      fetchSystemStats();
    } catch (error) {
      console.error('Error invalidating cache:', error);
      Swal.fire({
        icon: 'error',
        title: 'Lỗi vô hiệu hóa cache',
        text: error.response?.data?.detail || 'Không thể vô hiệu hóa cache. Vui lòng thử lại.',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search cache
  const handleSearchCache = async () => {
    if (!searchCacheKeyword) {
      Swal.fire({
        icon: 'warning',
        title: 'Cần nhập từ khóa',
        text: 'Vui lòng nhập từ khóa để tìm kiếm trong cache.',
        confirmButtonColor: '#10b981'
      });
      return;
    }

    // Thông báo tính năng chưa được triển khai
    Swal.fire({
      icon: 'info',
      title: 'Tính năng đang phát triển',
      text: 'Chức năng tìm kiếm cache sẽ được triển khai trong phiên bản tiếp theo.',
      confirmButtonColor: '#10b981'
    });
  };

  // Handle run benchmark
  const handleRunBenchmark = async () => {
    Swal.fire({
      title: 'Xác nhận chạy benchmark',
      text: 'Quá trình benchmark có thể mất vài phút để hoàn thành. Bạn có muốn tiếp tục?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Chạy benchmark',
      cancelButtonText: 'Hủy'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setRunningBenchmark(true);
          setBenchmarkProgress(0);

          // Start the benchmark
          const response = await axios.post(`${API_BASE_URL}/run-benchmark`, {
            file_path: "benchmark.json",
            output_dir: "benchmark_results"
          }, {
            headers: getAuthHeaders()
          });

          // Simulate progress updates (trong triển khai thực tế, có thể sử dụng websockets hoặc polling)
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

          // When completed
          setTimeout(() => {
            clearInterval(interval);
            setBenchmarkProgress(100);
            setRunningBenchmark(false);

            Swal.fire({
              icon: 'success',
              title: 'Benchmark hoàn thành',
              text: `Đã chạy benchmark thành công. Độ chính xác trung bình: ${response.data.stats.avg_retrieval_score.toFixed(2)}`,
              confirmButtonColor: '#10b981'
            });

            // Refresh benchmark results
            fetchBenchmarkResults();
          }, 15000);

        } catch (error) {
          console.error('Error running benchmark:', error);
          setRunningBenchmark(false);
          setBenchmarkProgress(0);

          Swal.fire({
            icon: 'error',
            title: 'Lỗi benchmark',
            text: error.response?.data?.detail || 'Không thể chạy benchmark. Vui lòng thử lại.',
            confirmButtonColor: '#10b981'
          });
        }
      }
    });
  };

  // Handle logout
  const handleLogout = () => {
    Swal.fire({
      title: 'Đăng xuất',
      text: 'Bạn có chắc chắn muốn đăng xuất?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('user_id');
        navigate('/login');
      }
    });
  };

  // Handle refresh data
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

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  return (
    <motion.div
      className="flex h-screen bg-gradient-to-br from-gray-50 to-slate-100"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Error notification */}
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

      {/* Admin Sidebar Navigation */}
      <AdminSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleLogout={handleLogout} 
        navigate={navigate} 
      />

      {/* Main Content */}
      <div className="ml-64 flex-1 overflow-x-hidden">
        {/* Top Bar */}
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

        {/* Render active tab */}
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