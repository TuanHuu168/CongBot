import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import axios from 'axios';
import {
  LayoutDashboard,
  Users,
  FileText,
  Database,
  BarChart2,
  Settings,
  ChevronLeft,
  LogOut,
  Activity,
  User,
  RefreshCw,
  Trash2,
  Plus,
  Upload,
  Search,
  AlertTriangle,
  Check,
  X,
  Info,
  Filter,
  ChevronDown,
  Edit,
  Save,
  Eye,
  Clock,
  Calendar,
  FileSymlink,
  Download
} from 'lucide-react';

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
  const [activeSection, setActiveSection] = useState('');
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
  
  // Các state phụ
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
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
      // Sử dụng API để lấy danh sách người dùng
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Chưa đăng nhập');
      }
      
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

  // Helper to get authentication headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    return {
      Authorization: `Bearer ${token}`
    };
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
          await axios.post(`${API_BASE_URL}/clear-cache`, { confirm: true }, {
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

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Check if it's today
    if (date.toDateString() === now.toDateString()) {
      return `Hôm nay, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Check if it's yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Hôm qua, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise use full date
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  const sidebarVariants = {
    hidden: { x: -280 },
    visible: { x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }
  };

  const fadeInVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <motion.div
      className="flex h-screen bg-gradient-to-br from-gray-50 to-slate-100"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Admin Sidebar Navigation */}
      <motion.div
        className="w-64 bg-white border-r border-gray-200 shadow-sm h-screen overflow-y-auto fixed left-0 top-0 z-10"
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col h-full">
          {/* Logo and Header */}
          <div className="px-6 py-6 bg-gradient-to-r from-green-600 to-teal-600 text-white flex items-center space-x-2">
            <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center">
              <Settings size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Admin Panel</h1>
              <p className="text-xs text-white/80">Quản trị hệ thống</p>
            </div>
          </div>
          
          {/* Navigation Links */}
          <nav className="flex-1 p-4">
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard size={18} className="mr-3" />
                Dashboard
              </button>
              
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'users'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Users size={18} className="mr-3" />
                Quản lý người dùng
              </button>
              
              <button
                onClick={() => setActiveTab('documents')}
                className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'documents'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FileText size={18} className="mr-3" />
                Quản lý văn bản
              </button>
              
              <button
                onClick={() => setActiveTab('cache')}
                className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'cache'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Database size={18} className="mr-3" />
                Quản lý cache
              </button>
              
              <button
                onClick={() => setActiveTab('benchmark')}
                className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'benchmark'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BarChart2 size={18} className="mr-3" />
                Benchmark
              </button>
            </div>
          </nav>
          
          {/* Admin Info & Logout */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <User size={20} className="text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{users[0]?.username || 'Admin'}</p>
                <p className="text-xs text-gray-500">{users[0]?.email || 'admin@example.com'}</p>
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

      {/* Main Content */}
      <div className="ml-64 flex-1 overflow-x-hidden">
        {/* Top Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200 py-3 px-6 flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-800">
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'users' && 'Quản lý người dùng'}
            {activeTab === 'documents' && 'Quản lý văn bản'}
            {activeTab === 'cache' && 'Quản lý cache'}
            {activeTab === 'benchmark' && 'Benchmark'}
          </h1>
          </div>
          
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
        </div>

        {/* Error notification */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="fixed top-4 right-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AlertTriangle size={16} className="mr-2" />
              <span>{error}</span>
              <button
                className="ml-3 text-red-500 hover:text-red-700"
                onClick={() => setError(null)}
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="p-6">
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6"
              variants={fadeInVariants}
              initial="hidden"
              animate="visible"
            >
              {/* User stats card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Người dùng</p>
                    <h3 className="text-2xl font-bold text-gray-900">{systemStats?.database?.mongodb?.user_count || users.length}</h3>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Users size={20} className="text-blue-500" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-gray-500">
                  <Activity size={14} className="mr-1" />
                  <span>{users.filter(u => u.status === 'active').length} người dùng hoạt động</span>
                </div>
              </div>

              {/* Document stats card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Văn bản</p>
                    <h3 className="text-2xl font-bold text-gray-900">{documents.length}</h3>
                  </div>
                  <div className="p-2 rounded-lg bg-green-50">
                    <FileText size={20} className="text-green-500" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-gray-500">
                  <Activity size={14} className="mr-1" />
                  <span>
                    {documents.reduce((sum, doc) => sum + (doc.chunks_count || 0), 0)} chunks
                  </span>
                </div>
              </div>

              {/* Cache stats card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Cache</p>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {systemStats?.cache_stats?.total_count || 0}
                    </h3>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-50">
                    <Database size={20} className="text-purple-500" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-gray-500">
                  <Activity size={14} className="mr-1" />
                  <span>Hit rate: {systemStats?.cache_stats?.hit_rate ? `${(systemStats.cache_stats.hit_rate * 100).toFixed(2)}%` : 'N/A'}</span>
                </div>
              </div>

              {/* Benchmark stats card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Benchmark</p>
                    <h3 className="text-2xl font-bold text-gray-900">{benchmarkResults.length}</h3>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50">
                    <BarChart2 size={20} className="text-amber-500" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-gray-500">
                  <Activity size={14} className="mr-1" />
                  <span>Kết quả gần nhất: {benchmarkResults[0]?.created_at ? formatDate(benchmarkResults[0].created_at) : 'N/A'}</span>
                </div>
              </div>
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
                                <Check size={14} className="mr-1" />
                                Kết nối
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <X size={14} className="mr-1" />
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
                                <Check size={14} className="mr-1" />
                                Kết nối
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <X size={14} className="mr-1" />
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
                  <Clock size={18} className="text-green-600 mr-2" />
                  Hoạt động gần đây
                </h2>
              </div>
              
              <div className="p-5">
                <div className="space-y-4">
                  {/* Recent logins */}
                  <div className="py-2 px-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-blue-600" />
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
        )}

        {/* User Management */}
        {activeTab === 'users' && (
          <div className="p-6">
            <motion.div
              className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
              variants={fadeInVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-semibold flex items-center">
                  <Users size={18} className="text-green-600 mr-2" />
                  Danh sách người dùng
                </h2>
                
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Tìm kiếm người dùng..."
                      className="py-1.5 pl-8 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  </div>
                  
                  <button className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              
              <div className="p-5">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tên người dùng
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vai trò
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Trạng thái
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Đăng nhập gần đây
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                <User size={14} className="text-gray-500" />
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">{user.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{user.email}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin' 
                                ? 'bg-purple-100 text-purple-800' 
                                : user.role === 'moderator'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{formatDate(user.lastLogin)}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-gray-400 hover:text-gray-500 px-2">
                              <Edit size={14} />
                            </button>
                            <button className="text-gray-400 hover:text-red-500 px-2">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Document Management */}
        {activeTab === 'documents' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Document List */}
              <motion.div
                className="md:col-span-2 bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-lg font-semibold flex items-center">
                    <FileText size={18} className="text-green-600 mr-2" />
                    Danh sách văn bản
                  </h2>
                  
                  <div className="flex items-center space-x-2">
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
                </div>
                
                <div className="p-5">
                  {isLoading ? (
                    <div className="py-4 flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {documents
                        .filter(doc => doc.doc_id.toLowerCase().includes(documentFilter.toLowerCase()) || 
                                    doc.doc_title?.toLowerCase().includes(documentFilter.toLowerCase()))
                        .map((document) => (
                        <div key={document.doc_id} className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                          <div className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-sm font-medium text-gray-900 flex items-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2">
                                    {document.doc_type}
                                  </span>
                                  {document.doc_id}
                                </h3>
                                <p className="mt-1 text-sm text-gray-600">{document.doc_title}</p>
                              </div>
                              <div className="flex space-x-1">
                                <button 
                                  className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                  onClick={() => {/* View document */}}
                                >
                                  <Eye size={14} />
                                </button>
                                <button 
                                  className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                  onClick={() => handleDeleteDocument(document.doc_id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center">
                                <Calendar size={12} className="mr-1" />
                                <span>Ngày hiệu lực: {document.effective_date || 'Không xác định'}</span>
                              </div>
                              <div className="flex items-center">
                                <FileSymlink size={12} className="mr-1" />
                                <span>{document.chunks_count || 0} chunks</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {documents.filter(doc => doc.doc_id.toLowerCase().includes(documentFilter.toLowerCase()) || 
                                    doc.doc_title?.toLowerCase().includes(documentFilter.toLowerCase())).length === 0 && (
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

              {/* Upload Document */}
              <motion.div
                className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-semibold flex items-center">
                    <Upload size={18} className="text-green-600 mr-2" />
                    Tải lên văn bản
                  </h2>
                </div>
                
                <div className="p-5">
                  <form onSubmit={handleUploadDocument}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mã văn bản
                        </label>
                        <input
                          type="text"
                          value={uploadMetadata.doc_id}
                          onChange={(e) => setUploadMetadata({...uploadMetadata, doc_id: e.target.value})}
                          placeholder="Ví dụ: 101_2018_TT_BTC"
                          className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Loại văn bản
                        </label>
                        <select
                          value={uploadMetadata.doc_type}
                          onChange={(e) => setUploadMetadata({...uploadMetadata, doc_type: e.target.value})}
                          className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                        >
                          <option value="Thông tư">Thông tư</option>
                          <option value="Nghị định">Nghị định</option>
                          <option value="Quyết định">Quyết định</option>
                          <option value="Pháp lệnh">Pháp lệnh</option>
                          <option value="Luật">Luật</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tiêu đề
                        </label>
                        <input
                          type="text"
                          value={uploadMetadata.doc_title}
                          onChange={(e) => setUploadMetadata({...uploadMetadata, doc_title: e.target.value})}
                          placeholder="Nhập tiêu đề văn bản"
                          className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ngày hiệu lực
                        </label>
                        <input
                          type="text"
                          value={uploadMetadata.effective_date}
                          onChange={(e) => setUploadMetadata({...uploadMetadata, effective_date: e.target.value})}
                          placeholder="DD-MM-YYYY"
                          className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">Định dạng: DD-MM-YYYY</p>
                      </div>
                      
                      <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phạm vi áp dụng
                        </label>
                        <select
                          value={uploadMetadata.document_scope}
                          onChange={(e) => setUploadMetadata({...uploadMetadata, document_scope: e.target.value})}
                          className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                        >
                          <option value="Quốc gia">Quốc gia</option>
                          <option value="Địa phương">Địa phương</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tệp chunks
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
                          <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-gray-600">
                              <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                                <span>Tải tệp lên</span>
                                <input 
                                  id="file-upload" 
                                  name="file-upload" 
                                  type="file" 
                                  className="sr-only"
                                  multiple
                                  onChange={(e) => setDocumentFiles(Array.from(e.target.files))}
                                  accept=".md,.txt"
                                />
                              </label>
                              <p className="pl-1">hoặc kéo và thả</p>
                            </div>
                            <p className="text-xs text-gray-500">
                              Tệp Markdown (.md)
                            </p>
                          </div>
                        </div>
                        
                        {documentFiles.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-700">Đã chọn {documentFiles.length} tệp:</p>
                            <ul className="mt-1 max-h-24 overflow-y-auto text-xs text-gray-500">
                              {documentFiles.map((file, index) => (
                                <li key={index} className="truncate">{file.name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        {isLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            <span>Đang tải lên...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={16} className="mr-2" />
                            <span>Tải lên văn bản</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Cache Management */}
        {activeTab === 'cache' && (
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
                                {systemStats?.cache_stats?.hit_rate ? `${(systemStats.cache_stats.hit_rate * 100).toFixed(2)}%` : 'N/A'}
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
                                <span>MongoDB Cache:</span>
                                <span>{systemStats?.cache_stats?.total_count || 0}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between text-sm text-gray-600 mb-1">
                                <span>ChromaDB Cache:</span>
                                <span>{systemStats?.cache_stats?.total_count || 0}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between text-sm text-gray-600 mb-1">
                                <span>Valid vs Invalid:</span>
                                <span>{systemStats?.cache_stats?.valid_count || 0} / {systemStats?.cache_stats?.invalid_count || 0}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-l-full" 
                                  style={{ 
                                    width: `${systemStats?.cache_stats?.total_count ? 
                                      (systemStats.cache_stats.valid_count / systemStats.cache_stats.total_count) * 100 : 0}%` 
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                    <Settings size={18} className="text-green-600 mr-2" />
                    Thao tác Cache
                  </h2>
                </div>
                
                <div className="p-5">
                  <div className="space-y-4">
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
        )}

        {/* Benchmark */}
        {activeTab === 'benchmark' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Benchmark Results */}
              <motion.div
                className="md:col-span-2 bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-semibold flex items-center">
                    <BarChart2 size={18} className="text-green-600 mr-2" />
                    Kết quả Benchmark
                  </h2>
                </div>
                
                <div className="p-5">
                  {isLoading ? (
                    <div className="py-4 flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {benchmarkResults.length > 0 ? (
                        benchmarkResults.map((result, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                            <div className="p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900">{result.file_name}</h3>
                                  <p className="mt-1 text-xs text-gray-500">Thời gian chạy: {formatDate(result.created_at)}</p>
                                </div>
                                <div className="flex space-x-1">
                                  <button 
                                    className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                    onClick={() => window.open(`${API_BASE_URL}/benchmark-results/${result.file_name}`, '_blank')}
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button 
                                    className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                    onClick={() => window.open(`${API_BASE_URL}/benchmark-results/${result.file_name}`, '_blank', 'download')}
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              </div>
                              
                              {result.avg_retrieval_score !== undefined && (
                                <div className="mt-3">
                                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>Độ chính xác trung bình:</span>
                                    <span>{(result.avg_retrieval_score * 100).toFixed(2)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-green-600 h-2 rounded-full" 
                                      style={{ width: `${result.avg_retrieval_score * 100}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center">
                                  <FileText size={12} className="mr-1" />
                                  <span>Kích thước: {result.size_kb} KB</span>
                                </div>
                                {result.questions_count !== undefined && (
                                  <div className="flex items-center">
                                    <Info size={12} className="mr-1" />
                                    <span>{result.questions_count} câu hỏi</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-10 text-center">
                          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-3">
                            <BarChart2 size={24} className="text-gray-400" />
                          </div>
                          <p className="text-gray-500 text-sm">Chưa có kết quả benchmark nào</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Run Benchmark */}
              <motion.div
                className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-semibold flex items-center">
                    <Activity size={18} className="text-green-600 mr-2" />
                    Chạy Benchmark
                  </h2>
                </div>
                
                <div className="p-5">
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <h3 className="text-amber-700 text-base font-medium mb-2">Benchmark mặc định</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Chạy benchmark với bộ câu hỏi mặc định để đánh giá hiệu suất của hệ thống.
                      </p>
                      
                      {runningBenchmark ? (
                        <div className="space-y-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${benchmarkProgress}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Đang chạy benchmark...</span>
                            <span>{Math.round(benchmarkProgress)}%</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleRunBenchmark}
                          disabled={isLoading}
                          className="flex items-center justify-center w-full py-2 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90 transition-opacity rounded-lg text-sm font-medium"
                        >
                          <BarChart2 size={16} className="mr-2" />
                          <span>Chạy benchmark</span>
                        </button>
                      )}
                    </div>
                    
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="text-blue-700 text-base font-medium mb-2">Benchmark tùy chỉnh</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Tải lên file benchmark tùy chỉnh để đánh giá hệ thống với các trường hợp riêng.
                      </p>
                      
                      <div className="mt-1 flex justify-center px-6 pt-3 pb-4 border-2 border-blue-300 border-dashed rounded-lg">
                        <div className="space-y-1 text-center">
                          <svg className="mx-auto h-8 w-8 text-blue-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div className="flex text-sm text-gray-600 justify-center">
                            <label htmlFor="benchmark-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                              <span>Tải lên file</span>
                              <input id="benchmark-upload" name="benchmark-upload" type="file" className="sr-only" accept=".json" />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">
                            Định dạng JSON
                          </p>
                        </div>
                      </div>
                      
                      <button
                        className="mt-3 flex items-center justify-center w-full py-2 px-4 bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors rounded-lg text-sm font-medium"
                        disabled
                      >
                        <Upload size={16} className="mr-2" />
                        <span>Tải lên & chạy</span>
                      </button>
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Thống kê</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Kết quả benchmark:</span>
                          <span className="text-sm font-medium text-gray-900">{benchmarkResults.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Trung bình độ chính xác:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {benchmarkResults.length > 0 && benchmarkResults[0].avg_retrieval_score !== undefined
                              ? `${(benchmarkResults[0].avg_retrieval_score * 100).toFixed(2)}%`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Thời gian chạy gần nhất:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {benchmarkResults.length > 0 ? formatDate(benchmarkResults[0].created_at) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminPage;