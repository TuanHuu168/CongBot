import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import axios from 'axios';
import {
  User,
  Mail,
  Phone,
  Key,
  Shield,
  Settings,
  Save,
  ChevronLeft,
  Camera,
  Clock,
  Calendar,
  AlertTriangle,
  Info,
  Check,
  X,
  LogOut,
  MessageSquare,
  Award,
  FileText,
  BookOpen,
  HeartHandshake,
  ArrowRight,
  Eye,
  EyeOff,
  ChevronDown
} from 'lucide-react';
import { useChat } from '../ChatContext';

// URL cơ sở của API backend
const API_BASE_URL = 'http://localhost:8001';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, fetchUserInfo, chatHistory, switchChat, fetchChatHistory } = useChat();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [stats, setStats] = useState({
    chatCount: 0,
    messageCount: 0,
    documentsAccessed: 0,
    savedItems: 0
  });

  const [recentChats, setRecentChats] = useState([]);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Lấy lịch sử trò chuyện và thông tin người dùng khi component mount
  useEffect(() => {
    // Đây là cờ để ngăn chặn vòng lặp vô hạn
    if (!dataLoaded) {
      // Lấy userId từ localStorage hoặc sessionStorage
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      if (userId) {
        Promise.all([
          fetchUserInfo(userId),
          fetchChatHistory()
        ]).then(() => {
          setDataLoaded(true);
        }).catch(error => {
          console.error("Error loading data:", error);
          setDataLoaded(true);
        });
      } else {
        navigate('/login');
      }
    }
  }, [fetchUserInfo, fetchChatHistory, navigate, dataLoaded]);

  // Cập nhật stats và recentChats khi chatHistory thay đổi
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      // Đếm tổng số cuộc trò chuyện
      const chatCount = chatHistory.length;

      // Lấy 3 cuộc trò chuyện gần nhất
      const sortedChats = [...chatHistory].sort((a, b) => {
        return new Date(b.updated_at || b.date) - new Date(a.updated_at || a.date);
      });

      const latest = sortedChats.slice(0, 3);
      setRecentChats(latest);

      // Cập nhật thống kê
      setStats({
        chatCount,
        messageCount: 0,
        documentsAccessed: 0,
        savedItems: 0
      });
    }
  }, [chatHistory]);

  // Thiết lập formData từ thông tin user khi user thay đổi
  useEffect(() => {
    if (user) {
      setFormData(prevState => ({
        ...prevState,
        fullName: user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || ''
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

      if (!userId || !token) {
        throw new Error('Không tìm thấy thông tin đăng nhập');
      }

      // Gọi API cập nhật thông tin người dùng
      const response = await axios.put(
        `${API_BASE_URL}/users/${userId}`,
        {
          fullName: formData.fullName,
          email: formData.email,
          phoneNumber: formData.phoneNumber
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.status === 200) {
        // Cập nhật thông tin người dùng trong context
        await fetchUserInfo(userId);

        // Thông báo thành công
        Swal.fire({
          title: 'Thành công!',
          text: 'Thông tin cá nhân đã được cập nhật',
          icon: 'success',
          confirmButtonText: 'Đóng',
          confirmButtonColor: '#16a34a'
        });

        setEditMode(false);
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật thông tin:', error);

      Swal.fire({
        title: 'Lỗi!',
        text: error.response?.data?.detail || 'Không thể cập nhật thông tin. Vui lòng thử lại sau.',
        icon: 'error',
        confirmButtonText: 'Thử lại',
        confirmButtonColor: '#16a34a'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);

    // Kiểm tra mật khẩu mới và xác nhận mật khẩu
    if (formData.newPassword !== formData.confirmPassword) {
      Swal.fire({
        title: 'Lỗi!',
        text: 'Mật khẩu mới và xác nhận mật khẩu không khớp',
        icon: 'error',
        confirmButtonText: 'Thử lại',
        confirmButtonColor: '#16a34a'
      });
      setPasswordLoading(false);
      return;
    }

    // Kiểm tra độ mạnh yếu của mật khẩu
    if (formData.newPassword.length < 6) {
      Swal.fire({
        title: 'Lỗi!',
        text: 'Mật khẩu phải có ít nhất 6 ký tự',
        icon: 'error',
        confirmButtonText: 'Thử lại',
        confirmButtonColor: '#16a34a'
      });
      setPasswordLoading(false);
      return;
    }

    try {
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

      if (!userId || !token) {
        throw new Error('Không tìm thấy thông tin đăng nhập');
      }

      // Gọi API thay đổi mật khẩu
      const response = await axios.put(
        `${API_BASE_URL}/users/${userId}/password`,
        {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.status === 200) {
        // Thông báo thành công
        Swal.fire({
          title: 'Thành công!',
          text: 'Mật khẩu đã được thay đổi',
          icon: 'success',
          confirmButtonText: 'Đóng',
          confirmButtonColor: '#16a34a'
        });

        // Reset form
        setFormData({
          ...formData,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Lỗi khi thay đổi mật khẩu:', error);

      let errorMessage = 'Không thể thay đổi mật khẩu. Vui lòng thử lại sau.';

      if (error.response?.status === 401) {
        errorMessage = 'Mật khẩu hiện tại không đúng';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      Swal.fire({
        title: 'Lỗi!',
        text: errorMessage,
        icon: 'error',
        confirmButtonText: 'Thử lại',
        confirmButtonColor: '#16a34a'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const navigateToChat = () => {
    navigate('/chat');
  };

  // Xử lý tải ảnh đại diện
  const handleAvatarChange = () => {
    Swal.fire({
      title: 'Thay đổi ảnh đại diện',
      text: 'Tính năng này sẽ được cập nhật trong phiên bản tới',
      icon: 'info',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#16a34a'
    });
  };

  const handleLogout = () => {
    // Hiện thông báo xác nhận
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
        // Xóa token trong localStorage và sessionStorage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('user_id');

        // Chuyển hướng về trang đăng nhập
        navigate('/login');
      }
    });
  };

  // Xử lý khi click vào một cuộc trò chuyện gần đây
  const handleChatClick = (chatId) => {
    switchChat(chatId).then(() => {
      navigate('/chat');
    });
  };

  // Hàm định dạng thời gian
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    // Kiểm tra xem có phải là hôm nay không
    if (date.toDateString() === now.toDateString()) {
      return `Hôm nay, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Kiểm tra xem có phải là hôm qua không
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Hôm qua, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Trường hợp khác
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Hàm format tiêu đề chat
  const formatChatTitle = (title) => {
    if (!title || title.trim() === '') return "Cuộc trò chuyện mới";
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(title);
    return isMongoId ? "Cuộc trò chuyện mới" : title;
  };

  // Toggle hiển thị mật khẩu
  const toggleCurrentPasswordVisibility = () => setShowCurrentPassword(!showCurrentPassword);
  const toggleNewPasswordVisibility = () => setShowNewPassword(!showNewPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);
  const toggleDropdown = () => setShowDropdown(!showDropdown);

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.3 } }
  };

  const slideUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      transition: {
        duration: 0.2
      }
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Topnav - compact style */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center">
            {/* Back to chat button */}
            <button
              onClick={navigateToChat}
              className="flex items-center text-white hover:text-green-100 transition-colors"
            >
              <ChevronLeft size={20} />
              <span className="ml-1 font-medium">Quay lại chat</span>
            </button>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={toggleDropdown}
                className="flex items-center space-x-2 hover:bg-white/10 py-1 px-2 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={16} className="text-white" />
                  )}
                </div>
                <span className="font-medium hidden sm:inline">{formData.fullName || 'Người dùng'}</span>
                <ChevronDown size={16} className={`transform transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown menu */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50"
                  >
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleLogout();
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={16} className="mr-2" />
                      <span>Đăng xuất</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* User profile info section */}
      <div className="bg-white shadow-md border-b border-gray-200 mb-6">
        <div className="container mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar section */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-green-100 shadow-md overflow-hidden bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="text-white" />
                )}
              </div>
              <button
                onClick={handleAvatarChange}
                className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-all"
              >
                <Camera size={14} className="text-green-600" />
              </button>
            </div>

            {/* User info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900">{formData.fullName}</h1>

              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-center sm:justify-start text-gray-600">
                  <Mail size={16} className="mr-2 text-gray-400" />
                  <span>{formData.email}</span>
                </div>
                <div className="flex items-center justify-center sm:justify-start text-gray-600">
                  <Phone size={16} className="mr-2 text-gray-400" />
                  <span>{formData.phoneNumber}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center sm:justify-start space-x-3">
                <div className="bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full border border-green-200 flex items-center">
                  <Award size={14} className="mr-1" />
                  Thành viên chính thức
                </div>
                <button
                  onClick={() => setEditMode(true)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-1 rounded-full flex items-center transition-all"
                >
                  <Settings size={14} className="mr-1" />
                  Chỉnh sửa
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile modal */}
      <AnimatePresence>
        {editMode && (
          <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
            >
              <div className="p-5 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Chỉnh sửa thông tin cá nhân</h3>
                  <button
                    onClick={() => setEditMode(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="block w-full px-4 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      placeholder="Nhập họ và tên"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="block w-full px-4 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      placeholder="Nhập email"
                    />
                  </div>

                  <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="block w-full px-4 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      placeholder="Nhập số điện thoại"
                    />
                  </div>

                  <div className="flex justify-end pt-4 space-x-3">
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                      disabled={isLoading}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="flex items-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <>
                          <Save size={16} className="mr-1.5" />
                          <span>Lưu thay đổi</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main content with grid layout */}
      <div className="container mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-1">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Security section */}
              <motion.div
                variants={slideUpVariants}
                className="bg-white rounded-2xl shadow-md overflow-hidden"
              >
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="ml-3 text-lg font-semibold text-gray-900">Bảo mật</h2>
                  </div>
                </div>

                <div className="p-5">
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <label htmlFor="currentPassword" className="block text-xs font-medium text-gray-700 mb-1">
                        Mật khẩu hiện tại
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          id="currentPassword"
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          disabled={passwordLoading}
                          className="block w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10 transition-colors"
                          placeholder="●●●●●●●●"
                          required
                        />
                        <button
                          type="button"
                          onClick={toggleCurrentPasswordVisibility}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="block text-xs font-medium text-gray-700 mb-1">
                        Mật khẩu mới
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          id="newPassword"
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          disabled={passwordLoading}
                          className="block w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10 transition-colors"
                          placeholder="●●●●●●●●"
                          required
                        />
                        <button
                          type="button"
                          onClick={toggleNewPasswordVisibility}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">
                        Xác nhận mật khẩu mới
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          disabled={passwordLoading}
                          className="block w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10 transition-colors"
                          placeholder="●●●●●●●●"
                          required
                        />
                        <button
                          type="button"
                          onClick={toggleConfirmPasswordVisibility}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start mt-3">
                      <div className="flex-shrink-0">
                        <AlertTriangle size={16} className="text-amber-500" />
                      </div>
                      <div className="ml-2">
                        <p className="text-xs text-gray-500">
                          Mật khẩu mới phải có ít nhất 6 ký tự, bao gồm chữ hoa, chữ thường và số.
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full flex items-center justify-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all"
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                          <span>Đang cập nhật...</span>
                        </>
                      ) : (
                        <>
                          <Key size={16} className="mr-1.5" />
                          <span>Cập nhật mật khẩu</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </motion.div>

              {/* App info section */}
              <motion.div
                variants={slideUpVariants}
                className="bg-white rounded-2xl shadow-md overflow-hidden"
              >
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Info className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="ml-3 text-lg font-semibold text-gray-900">Về ứng dụng</h2>
                  </div>
                </div>

                <div className="p-5">
                  <div className="space-y-3 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-green-600">Chatbot Hỗ Trợ Chính Sách Người Có Công</span> được
                      phát triển nhằm cung cấp thông tin chính xác và kịp thời về các chính sách ưu đãi,
                      trợ cấp, và thủ tục hành chính liên quan đến người có công tại Việt Nam.
                    </p>
                    <p>
                      Hệ thống sử dụng công nghệ <span className="font-medium text-green-600">Retrieval Augmented Generation (RAG)</span> kết
                      hợp với mô hình ngôn ngữ lớn để đảm bảo thông tin được cung cấp dựa trên
                      các văn bản pháp luật chính thức và cập nhật.
                    </p>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => navigate('/chat')}
                      className="flex items-center justify-center bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium py-2 px-4 rounded-lg transition-all"
                    >
                      <MessageSquare size={16} className="mr-1.5" />
                      <span>Bắt đầu trò chuyện</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Middle and right columns */}
          <div className="lg:col-span-2">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Achievement section */}
              <motion.div
                variants={slideUpVariants}
                className="bg-white rounded-2xl shadow-md overflow-hidden"
              >
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Award className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="ml-3 text-lg font-semibold text-gray-900">Thành tựu</h2>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-teal-500 text-white mb-2">
                        <MessageSquare size={20} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{stats.chatCount}</h3>
                      <p className="text-xs text-gray-600">Cuộc trò chuyện</p>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-teal-500 text-white mb-2">
                        <BookOpen size={20} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">0</h3>
                      <p className="text-xs text-gray-600">Văn bản đã truy cập</p>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-teal-500 text-white mb-2">
                        <HeartHandshake size={20} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">0</h3>
                      <p className="text-xs text-gray-600">Phản hồi đã gửi</p>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-teal-500 text-white mb-2">
                        <FileText size={20} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">0</h3>
                      <p className="text-xs text-gray-600">Tài liệu đã lưu</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Activity section */}
              <motion.div
                variants={slideUpVariants}
                className="bg-white rounded-2xl shadow-md overflow-hidden"
              >
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-green-600" />
                      </div>
                      <h2 className="ml-3 text-lg font-semibold text-gray-900">Hoạt động gần đây</h2>
                    </div>
                    <button
                      onClick={() => navigate('/history')}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center"
                    >
                      <span>Xem tất cả</span>
                      <ArrowRight size={16} className="ml-1" />
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  {recentChats.length > 0 ? (
                    <div className="space-y-4">
                      {recentChats.map(chat => (
                        <div
                          key={chat.id}
                          onClick={() => handleChatClick(chat.id)}
                          className="flex items-center bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="h-5 w-5 text-green-600" />
                          </div>
                          <div className="ml-3 flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {formatChatTitle(chat.title)}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {formatDate(chat.updated_at || chat.date)}
                            </p>
                          </div>
                          <div className="ml-2">
                            <ArrowRight size={16} className="text-gray-400" />
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-center mt-2">
                        <button
                          onClick={() => navigate('/chat')}
                          className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center"
                        >
                          <span>Bắt đầu trò chuyện mới</span>
                          <ArrowRight size={16} className="ml-1" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
                        <Calendar size={24} />
                      </div>
                      <h3 className="text-sm font-medium text-gray-700 mb-1">Chưa có hoạt động nào</h3>
                      <p className="text-xs text-gray-500 mb-4">Bắt đầu trò chuyện để xem hoạt động của bạn tại đây</p>

                      <button
                        onClick={() => navigate('/chat')}
                        className="inline-flex items-center justify-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all"
                      >
                        <MessageSquare size={16} className="mr-1.5" />
                        <span>Bắt đầu trò chuyện mới</span>
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Suggested questions section */}
              <motion.div
                variants={slideUpVariants}
                className="bg-white rounded-2xl shadow-md overflow-hidden"
              >
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="ml-3 text-lg font-semibold text-gray-900">Gợi ý câu hỏi</h2>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-sm text-gray-600 mb-4">
                    Bạn có thể tham khảo các câu hỏi sau để bắt đầu trò chuyện với chatbot:
                  </p>

                  <div className="space-y-3">
                    <div
                      className="p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg cursor-pointer hover:shadow-md transition-all"
                      onClick={() => {
                        navigate('/chat', {
                          state: { suggestedQuestion: "Ai được xác nhận là người có công với cách mạng?" }
                        });
                      }}
                    >
                      <p className="text-sm text-green-700">Ai được xác nhận là người có công với cách mạng?</p>
                    </div>

                    <div
                      className="p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg cursor-pointer hover:shadow-md transition-all"
                      onClick={() => {
                        navigate('/chat', {
                          state: { suggestedQuestion: "Mức trợ cấp ưu đãi hàng tháng cho thương binh hạng 1/4?" }
                        });
                      }}
                    >
                      <p className="text-sm text-green-700">Mức trợ cấp ưu đãi hàng tháng cho thương binh hạng 1/4?</p>
                    </div>

                    <div
                      className="p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg cursor-pointer hover:shadow-md transition-all"
                      onClick={() => {
                        navigate('/chat', {
                          state: { suggestedQuestion: "Quy trình xác nhận liệt sĩ cần những giấy tờ gì?" }
                        });
                      }}
                    >
                      <p className="text-sm text-green-700">Quy trình xác nhận liệt sĩ cần những giấy tờ gì?</p>
                    </div>

                    <div
                      className="p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg cursor-pointer hover:shadow-md transition-all"
                      onClick={() => {
                        navigate('/chat', {
                          state: { suggestedQuestion: "Chính sách ưu đãi về giáo dục đối với con của người có công?" }
                        });
                      }}
                    >
                      <p className="text-sm text-green-700">Chính sách ưu đãi về giáo dục đối với con của người có công?</p>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <button
                      onClick={() => navigate('/chat')}
                      className="inline-flex items-center justify-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all"
                    >
                      <MessageSquare size={16} className="mr-1.5" />
                      <span>Bắt đầu trò chuyện</span>
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Feedback section */}
              <motion.div
                variants={slideUpVariants}
                className="bg-white rounded-2xl shadow-md overflow-hidden"
              >
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <HeartHandshake className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="ml-3 text-lg font-semibold text-gray-900">Góp ý cải thiện</h2>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-sm text-gray-600 mb-4">
                    Chúng tôi rất mong nhận được góp ý của bạn để cải thiện chất lượng dịch vụ.
                    Vui lòng chia sẻ trải nghiệm và đề xuất của bạn.
                  </p>

                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-4"
                    rows="3"
                    placeholder="Nhập góp ý của bạn tại đây..."
                  ></textarea>

                  <div className="flex justify-end">
                    <button
                      className="inline-flex items-center justify-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all"
                    >
                      <Check size={16} className="mr-1.5" />
                      <span>Gửi góp ý</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfilePage;