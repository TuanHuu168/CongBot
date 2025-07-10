import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, ChevronRight } from 'lucide-react';
import { userAPI } from '../apiService';
import FormField from '../components/common/FormField';
import { validateUsername, validatePassword, useFormValidation } from '../utils/validationUtils';
import { pageVariants, containerVariants, itemVariants, ROUTES, STORAGE_KEYS, showError, showSuccess } from '../utils/formatUtils';

// Quy tắc validation cho form đăng nhập
const validationRules = {
  username: validateUsername,
  password: validatePassword
};

const LoginPage = () => {
  const navigate = useNavigate();
  
  // State quản lý form và UI
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Hook validation cho form
  const { validateField, validateForm } = useFormValidation(validationRules);

  // Xử lý thay đổi giá trị input và xóa lỗi khi người dùng nhập
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }, [errors]);

  // Xử lý validation khi người dùng rời khỏi
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [validateField]);

  // Xử lý submit form đăng nhập
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate toàn bộ form trước khi gửi
    const formErrors = validateForm(formData);
    setErrors(formErrors);
    if (Object.values(formErrors).some(error => error)) return;

    setIsLoading(true);
    try {
      // Gọi API đăng nhập
      const response = await userAPI.login(formData);
      const { access_token, user_id } = response;

      // Lưu token vào storage (localStorage nếu remember me, sessionStorage nếu không)
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem(STORAGE_KEYS.AUTH_TOKEN, access_token);
      storage.setItem(STORAGE_KEYS.USER_ID, user_id);

      showSuccess('Chào mừng bạn quay trở lại hệ thống!', 'Đăng nhập thành công');
      
      // Chuyển hướng đến trang chat sau khi đăng nhập thành công
      setTimeout(() => {
        navigate(ROUTES.CHAT, { state: { freshLogin: true, userId: user_id } });
      }, 1500);
    } catch (error) {
      showError(error.detail || 'Đăng nhập thất bại', 'Lỗi đăng nhập');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="flex min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-100"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Panel bên trái - Phần hero/giới thiệu (chỉ hiển thị trên desktop) */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-green-600 to-teal-700 p-12 relative">
        <motion.div
          className="relative h-full flex flex-col justify-center z-10"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {/* Icon chatbot */}
          <div className="w-20 h-20 bg-white/10 rounded-2xl mb-8 backdrop-blur-sm flex items-center justify-center shadow-xl">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <User size={20} className="text-green-600" />
            </div>
          </div>

          {/* Nội dung giới thiệu */}
          <h2 className="text-4xl font-bold text-white mb-6">Chào mừng đến với Chatbot</h2>
          <p className="text-white/80 text-lg mb-8 max-w-lg">
            Hệ thống trí tuệ nhân tạo tư vấn chính sách dành cho người có công tại Việt Nam.
          </p>
          <p className="text-white/90 italic">
            "Đền ơn đáp nghĩa là truyền thống tốt đẹp của dân tộc Việt Nam."
          </p>
        </motion.div>
      </div>

      {/* Panel bên phải - Form đăng nhập */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <motion.div
          className="bg-white w-full max-w-md px-8 py-6 rounded-2xl shadow-2xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header form với icon và tiêu đề */}
          <motion.div className="text-center mb-8" variants={itemVariants}>
            <div className="h-16 w-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl mx-auto mb-4 shadow-lg flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              ĐĂNG NHẬP
            </h1>
            <p className="text-gray-600 mt-2">Chatbot hỗ trợ chính sách người có công</p>
          </motion.div>

          {/* Form đăng nhập */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input tên đăng nhập */}
            <FormField 
              name="username" 
              placeholder="Tên đăng nhập" 
              icon={User} 
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.username}
              disabled={isLoading}
            />
            
            {/* Input mật khẩu với toggle hiển thị */}
            <FormField 
              name="password" 
              type="password" 
              placeholder="Mật khẩu" 
              icon={Lock} 
              showToggle 
              toggleState={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.password}
              disabled={isLoading}
            />

            {/* Checkbox ghi nhớ đăng nhập và link quên mật khẩu */}
            <motion.div className="flex items-center justify-between" variants={itemVariants}>
              {/* Custom checkbox cho "Ghi nhớ đăng nhập" */}
              <label className="flex items-center group cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="opacity-0 absolute h-5 w-5 cursor-pointer"
                />
                <div className={`relative w-5 h-5 flex flex-shrink-0 transition-colors ${
                  rememberMe ? 'bg-gradient-to-r from-green-500 to-teal-500 border-green-500' : 'border-gray-300'
                } border rounded`}>
                  {rememberMe && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-3.5 border-r-2 border-b-2 border-white transform rotate-45 translate-y-[-1px]"></div>
                    </div>
                  )}
                </div>
                <span className="ml-2 text-sm text-gray-600 group-hover:text-green-600 transition-colors">
                  Ghi nhớ đăng nhập
                </span>
              </label>

              {/* Link quên mật khẩu */}
              <button
                type="button"
                className="text-sm text-green-600 hover:text-green-800 transition-colors hover:underline px-2 py-1"
                onClick={() => showError('Tính năng này sẽ được cập nhật trong phiên bản tới', 'Quên mật khẩu')}
                disabled={isLoading}
              >
                Quên mật khẩu?
              </button>
            </motion.div>

            {/* Nút đăng nhập với loading state */}
            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:opacity-90 disabled:opacity-50"
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  <span>Đang xử lý...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <span>ĐĂNG NHẬP</span>
                  <ChevronRight size={18} className="ml-2" />
                </div>
              )}
            </motion.button>
          </form>

          {/* Link chuyển đến trang đăng ký */}
          <motion.div className="mt-2 text-center" variants={itemVariants}>
            <p className="text-gray-600">
              Chưa có tài khoản?{' '}
              <button
                onClick={() => navigate(ROUTES.REGISTER)}
                disabled={isLoading}
                className="text-green-600 hover:text-green-800 font-medium transition-colors hover:underline px-2 py-1 disabled:opacity-50"
              >
                Đăng ký ngay
              </button>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LoginPage;