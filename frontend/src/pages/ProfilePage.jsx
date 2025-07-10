import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Key, Shield, Save, Camera, Clock, Calendar, AlertTriangle, Info, Check,
  MessageSquare, Award, FileText, BookOpen, HeartHandshake, ArrowRight, Eye, EyeOff
} from 'lucide-react';
import { useChat } from '../ChatContext';
import { userAPI } from '../apiService';
import FormField from '../components/common/FormField';
import { validatePassword, validateConfirmPassword } from '../utils/validationUtils';
import { showError, showSuccess, formatDate, pageVariants, slideUpVariants, containerVariants } from '../utils/formatUtils';
import TopNavBar from '../components/common/TopNavBar';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, fetchUserInfo, chatHistory, switchChat, fetchChatHistory } = useChat();

  // State quản lý thông tin cá nhân
  const [formData, setFormData] = useState({
    fullName: '', email: '', phoneNumber: '', personalInfo: '', avatarUrl: ''
  });
  
  // State quản lý thay đổi mật khẩu
  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  
  // State quản lý lỗi và UI
  const [passwordErrors, setPasswordErrors] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [stats, setStats] = useState({ 
    chatCount: 0, activeDays: 0, feedbackCount: 0 
  });
  const [recentChats, setRecentChats] = useState([]);
  const [passwordVisibility, setPasswordVisibility] = useState({ 
    current: false, new: false, confirm: false 
  });
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Kiểm tra xác thực và tải dữ liệu khi component mount
  useEffect(() => {
    const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    if (!userId) {
      navigate('/login');
      return;
    }

    const loadData = async () => {
      try {
        await Promise.all([fetchUserInfo(userId), fetchChatHistory()]);
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
      }
    };

    loadData();
  }, [fetchUserInfo, fetchChatHistory, navigate]);

  // Cập nhật form data khi thông tin user thay đổi
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        personalInfo: user.personalInfo || '',
        avatarUrl: user.avatarUrl || ''
      });
    }
  }, [user]);

  // Tính toán thống kê và chat gần đây khi lịch sử chat thay đổi
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      const activeChats = chatHistory.filter(chat => chat.status === 'active');
      const sortedChats = [...activeChats].sort((a, b) => {
        return new Date(b.updated_at || b.date) - new Date(a.updated_at || a.date);
      });
      
      setRecentChats(sortedChats.slice(0, 3));

      // Tính số ngày hoạt động duy nhất
      const activeDaysSet = new Set();
      activeChats.forEach(chat => {
        const chatDate = new Date(chat.updated_at || chat.created_at || chat.date);
        const dateStr = chatDate.toDateString();
        activeDaysSet.add(dateStr);
      });

      setStats({
        chatCount: activeChats.length,
        activeDays: activeDaysSet.size,
        feedbackCount: 0
      });
    }
  }, [chatHistory]);

  // Xử lý thay đổi form thông tin cá nhân
  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [formErrors]);

  // Xử lý thay đổi form mật khẩu
  const handlePasswordChange = useCallback((e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    if (passwordErrors[name]) {
      setPasswordErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [passwordErrors]);

  // Xử lý submit form cập nhật thông tin cá nhân
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

      await userAPI.update(userId, {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        personalInfo: formData.personalInfo,
        avatarUrl: formData.avatarUrl
      });

      await fetchUserInfo(userId);
      showSuccess('Thông tin cá nhân đã được cập nhật', 'Thành công!');
      setEditMode(false);
    } catch (error) {
      showError(error.detail || 'Không thể cập nhật thông tin. Vui lòng thử lại sau.', 'Lỗi!');
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý submit form thay đổi mật khẩu
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    // Validate mật khẩu trước khi gửi
    const errors = {};
    const passwordError = validatePassword(passwordData.newPassword);
    const confirmError = validateConfirmPassword(passwordData.newPassword, passwordData.confirmPassword);
    
    if (passwordError) errors.newPassword = passwordError;
    if (confirmError) errors.confirmPassword = confirmError;
    
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPasswordLoading(true);

    try {
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

      await userAPI.changePassword(userId, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      showSuccess('Mật khẩu đã được thay đổi', 'Thành công!');
      setPasswordData({
        currentPassword: '', newPassword: '', confirmPassword: ''
      });
    } catch (error) {
      let errorMessage = 'Không thể thay đổi mật khẩu. Vui lòng thử lại sau.';
      if (error.response?.status === 401) {
        errorMessage = 'Mật khẩu hiện tại không đúng';
      } else if (error.detail) {
        errorMessage = error.detail;
      }
      showError(errorMessage, 'Lỗi!');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Xử lý thay đổi ảnh đại diện (tính năng đang phát triển)
  const handleAvatarChange = () => {
    showSuccess('Tính năng này sẽ được cập nhật trong phiên bản tới', 'Thay đổi ảnh đại diện');
  };

  // Xử lý click vào chat để chuyển đến trang chat
  const handleChatClick = (chatId) => {
    switchChat(chatId).then(() => {
      navigate('/chat');
    });
  };

  // Format tiêu đề chat để hiển thị
  const formatChatTitle = (title) => {
    if (!title || title.trim() === '') return "Cuộc trò chuyện mới";
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(title);
    return isMongoId ? "Cuộc trò chuyện mới" : title;
  };

  // Toggle hiển thị/ẩn mật khẩu
  const togglePasswordVisibility = (field) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Hiệu ứng animation cho modal
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
  };

  // Component thẻ thống kê
  const StatCard = ({ icon: Icon, value, label }) => (
    <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-teal-500 text-white mb-2">
        <Icon size={20} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{value}</h3>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  );

  // Component field mật khẩu với toggle show/hide
  const PasswordField = ({ name, label, field, placeholder = "●●●●●●●●" }) => (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={passwordVisibility[field] ? "text" : "password"}
          id={name}
          name={name}
          value={passwordData[name]}
          onChange={handlePasswordChange}
          disabled={passwordLoading}
          placeholder={placeholder}
          className="block w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10 transition-colors"
        />
        <button
          type="button"
          onClick={() => togglePasswordVisibility(field)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          {passwordVisibility[field] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {passwordErrors[name] && <p className="text-red-500 text-sm mt-1">{passwordErrors[name]}</p>}
    </div>
  );

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50"
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
    >
      {/* Header với thông tin người dùng */}
      <TopNavBar title="Cài đặt" showBackButton={true} backButtonDestination="/chat" backButtonText="Quay lại chat" user={user} />

      {/* Phần header profile với avatar và thông tin cơ bản */}
      <div className="bg-white shadow-md border-b border-gray-200 mb-6">
        <div className="container mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar với nút thay đổi */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-green-100 shadow-md overflow-hidden bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="text-white" />
                )}
              </div>
              <button onClick={handleAvatarChange} className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-all">
                <Camera size={14} className="text-green-600" />
              </button>
            </div>

            {/* Thông tin cá nhân */}
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
                <button onClick={() => setEditMode(true)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-1 rounded-full flex items-center transition-all">
                  <span>Chỉnh sửa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal chỉnh sửa thông tin cá nhân */}
      <AnimatePresence>
        {editMode && (
          <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
              {/* Header modal */}
              <div className="p-5 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Chỉnh sửa thông tin cá nhân</h3>
                  <button onClick={() => setEditMode(false)} className="text-gray-400 hover:text-gray-500">
                    <span className="sr-only">Đóng</span>
                    <span className="text-xl">&times;</span>
                  </button>
                </div>
              </div>
              {/* Form chỉnh sửa */}
              <div className="p-5">
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <FormField
                    name="fullName"
                    placeholder="Nhập họ và tên"
                    icon={User}
                    value={formData.fullName}
                    onChange={handleFormChange}
                    error={formErrors.fullName}
                    disabled={isLoading}
                  />
                  <FormField
                    name="email"
                    type="email"
                    placeholder="Nhập email"
                    icon={Mail}
                    value={formData.email}
                    onChange={handleFormChange}
                    error={formErrors.email}
                    disabled={isLoading}
                  />
                  <FormField
                    name="phoneNumber"
                    type="tel"
                    placeholder="Nhập số điện thoại"
                    icon={Phone}
                    value={formData.phoneNumber}
                    onChange={handleFormChange}
                    error={formErrors.phoneNumber}
                    disabled={isLoading}
                  />
                  <div>
                    <label htmlFor="personalInfo" className="block text-sm font-medium text-gray-700 mb-1">Thông tin cá nhân</label>
                    <textarea
                      id="personalInfo"
                      name="personalInfo"
                      value={formData.personalInfo}
                      onChange={handleFormChange}
                      disabled={isLoading}
                      rows="3"
                      className="block w-full px-4 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      placeholder="VD: Thương binh hạng 1/4, Con liệt sĩ..."
                    />
                  </div>
                  {/* Nút hành động */}
                  <div className="flex justify-end pt-4 space-x-3">
                    <button type="button" onClick={() => setEditMode(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" disabled={isLoading}>
                      Hủy
                    </button>
                    <button type="submit" className="flex items-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all" disabled={isLoading}>
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

      {/* Nội dung chính với layout 2 cột */}
      <div className="container mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái - Bảo mật và thông tin ứng dụng */}
          <div className="lg:col-span-1">
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
              {/* Card bảo mật */}
              <motion.div variants={slideUpVariants} className="bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="ml-3 text-lg font-semibold text-gray-900">Bảo mật</h2>
                  </div>
                </div>
                <div className="p-5">
                  {/* Form thay đổi mật khẩu */}
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <PasswordField name="currentPassword" label="Mật khẩu hiện tại" field="current" />
                    <PasswordField name="newPassword" label="Mật khẩu mới" field="new" />
                    <PasswordField name="confirmPassword" label="Xác nhận mật khẩu mới" field="confirm" />
                    <div className="flex items-start mt-3">
                      <div className="flex-shrink-0">
                        <AlertTriangle size={16} className="text-amber-500" />
                      </div>
                      <div className="ml-2">
                        <p className="text-xs text-gray-500">
                          Mật khẩu mới phải có ít nhất 6 ký tự.
                        </p>
                      </div>
                    </div>
                    <button type="submit" className="w-full flex items-center justify-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all" disabled={passwordLoading}>
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

              {/* Card thông tin ứng dụng */}
              <motion.div variants={slideUpVariants} className="bg-white rounded-2xl shadow-md overflow-hidden">
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
                    <button onClick={() => navigate('/chat')} className="flex items-center justify-center bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium py-2 px-4 rounded-lg transition-all">
                      <MessageSquare size={16} className="mr-1.5" />
                      <span>Bắt đầu trò chuyện</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Cột phải - Thành tựu, hoạt động, gợi ý */}
          <div className="lg:col-span-2">
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
              {/* Card thành tựu */}
              <motion.div variants={slideUpVariants} className="bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Award className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="ml-3 text-lg font-semibold text-gray-900">Thành tựu</h2>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <StatCard icon={MessageSquare} value={stats.chatCount} label="Cuộc trò chuyện" />
                    <StatCard icon={Clock} value={stats.activeDays} label="Ngày hoạt động" />
                    <StatCard icon={HeartHandshake} value={stats.feedbackCount} label="Phản hồi đã gửi" />
                  </div>
                </div>
              </motion.div>

              {/* Card hoạt động gần đây */}
              <motion.div variants={slideUpVariants} className="bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-green-600" />
                      </div>
                      <h2 className="ml-3 text-lg font-semibold text-gray-900">Hoạt động gần đây</h2>
                    </div>
                    <button onClick={() => navigate('/history')} className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center">
                      <span>Xem tất cả</span>
                      <ArrowRight size={16} className="ml-1" />
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  {recentChats.length > 0 ? (
                    <div className="space-y-4">
                      {recentChats.map(chat => (
                        <div key={chat.id} onClick={() => handleChatClick(chat.id)} className="flex items-center bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="h-5 w-5 text-green-600" />
                          </div>
                          <div className="ml-3 flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 truncate max-w-[250px] sm:max-w-md">
                              {formatChatTitle(chat.title)}
                            </h3>
                            <p className="text-xs text-gray-500">{formatDate(chat.updated_at || chat.date)}</p>
                          </div>
                          <div className="ml-2">
                            <ArrowRight size={16} className="text-gray-400" />
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-center mt-2">
                        <button onClick={() => navigate('/chat')} className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center">
                          <span>Bắt đầu trò chuyện mới</span>
                          <ArrowRight size={16} className="ml-1" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Hiển thị khi chưa có hoạt động */
                    <div className="text-center py-10">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
                        <Calendar size={24} />
                      </div>
                      <h3 className="text-sm font-medium text-gray-700 mb-1">Chưa có hoạt động nào</h3>
                      <p className="text-xs text-gray-500 mb-4">Bắt đầu trò chuyện để xem hoạt động của bạn tại đây</p>
                      <button onClick={() => navigate('/chat')} className="inline-flex items-center justify-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all">
                        <MessageSquare size={16} className="mr-1.5" />
                        <span>Bắt đầu trò chuyện mới</span>
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Card gợi ý câu hỏi */}
              <motion.div variants={slideUpVariants} className="bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="ml-3 text-lg font-semibold text-gray-900">Gợi ý câu hỏi</h2>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-600 mb-4">Bạn có thể tham khảo các câu hỏi sau để bắt đầu trò chuyện với chatbot:</p>
                  <div className="space-y-3">
                    {[
                      "Ai được xác nhận là người có công với cách mạng?",
                      "Mức trợ cấp ưu đãi hàng tháng cho thương binh hạng 1/4?",
                      "Quy trình xác nhận liệt sĩ cần những giấy tờ gì?",
                      "Chính sách ưu đãi về giáo dục đối với con của người có công?"
                    ].map((question, index) => (
                      <div key={index} className="p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg cursor-pointer hover:shadow-md transition-all"
                        onClick={() => { navigate('/chat', { state: { suggestedQuestion: question } }); }}>
                        <p className="text-sm text-green-700">{question}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <button onClick={() => navigate('/chat')} className="inline-flex items-center justify-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all">
                      <MessageSquare size={16} className="mr-1.5" />
                      <span>Bắt đầu trò chuyện</span>
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Card góp ý cải thiện */}
              <motion.div variants={slideUpVariants} className="bg-white rounded-2xl shadow-md overflow-hidden">
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
                  <textarea className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-4" rows="3" placeholder="Nhập góp ý của bạn tại đây..."></textarea>
                  <div className="flex justify-end">
                    <button className="inline-flex items-center justify-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all">
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