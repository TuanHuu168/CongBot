import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, User, Lock, ChevronRight } from 'lucide-react';
import { userAPI } from '../apiService';
import { validateUsername, validatePassword, pageVariants, containerVariants, itemVariants, ROUTES, STORAGE_KEYS, showError, showSuccess } from '../utils/formatUtils';

const FormField = React.memo(({ name, type = 'text', placeholder, icon: Icon, showToggle = false, toggleState, onToggle, value, onChange, error }) => (
  <motion.div className="space-y-1" variants={itemVariants}>
    <div className="relative">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
        <Icon size={18} />
      </div>
      <input
        type={showToggle ? (toggleState ? 'text' : type) : type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-10 py-3 border ${error ? 'border-red-500' : 'border-gray-200'} 
          rounded-xl focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-green-500'} 
          shadow-sm transition-all duration-300 bg-gray-50 focus:bg-white`}
      />
      {showToggle && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors duration-300"
        >
          {toggleState ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
    {error && <p className="text-red-500 text-sm ml-1">{error}</p>}
  </motion.div>
));

const LoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }, [errors]);

  const validateForm = () => {
    const newErrors = {
      username: validateUsername(formData.username),
      password: validatePassword(formData.password)
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await userAPI.login(formData);
      const { access_token, user_id } = response;

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem(STORAGE_KEYS.AUTH_TOKEN, access_token);
      storage.setItem(STORAGE_KEYS.USER_ID, user_id);

      showSuccess('Chào mừng bạn quay trở lại hệ thống!', 'Đăng nhập thành công');
      
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
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-green-600 to-teal-700 p-12 relative">
        <motion.div
          className="relative h-full flex flex-col justify-center z-10"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="w-20 h-20 bg-white/10 rounded-2xl mb-8 backdrop-blur-sm flex items-center justify-center shadow-xl">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <User size={20} className="text-green-600" />
            </div>
          </div>

          <h2 className="text-4xl font-bold text-white mb-6">Chào mừng đến với Chatbot</h2>
          <p className="text-white/80 text-lg mb-8 max-w-lg">
            Hệ thống trí tuệ nhân tạo tư vấn chính sách dành cho người có công tại Việt Nam.
          </p>
          <p className="text-white/90 italic">
            "Đền ơn đáp nghĩa là truyền thống tốt đẹp của dân tộc Việt Nam."
          </p>
        </motion.div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <motion.div
          className="bg-white w-full max-w-md px-8 py-6 rounded-2xl shadow-2xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="text-center mb-8" variants={itemVariants}>
            <div className="h-16 w-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl mx-auto mb-4 shadow-lg flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              ĐĂNG NHẬP
            </h1>
            <p className="text-gray-600 mt-2">Chatbot hỗ trợ chính sách người có công</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField 
              name="username" 
              placeholder="Tên đăng nhập" 
              icon={User} 
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
            />
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
              error={errors.password}
            />

            <motion.div className="flex items-center justify-between" variants={itemVariants}>
              <label className="flex items-center group cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
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

              <button
                type="button"
                className="text-sm text-green-600 hover:text-green-800 transition-colors hover:underline px-2 py-1"
                onClick={() => showError('Tính năng này sẽ được cập nhật trong phiên bản tới', 'Quên mật khẩu')}
              >
                Quên mật khẩu?
              </button>
            </motion.div>

            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:opacity-90"
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

          <motion.div className="mt-2 text-center" variants={itemVariants}>
            <p className="text-gray-600">
              Chưa có tài khoản?{' '}
              <button
                onClick={() => navigate(ROUTES.REGISTER)}
                className="text-green-600 hover:text-green-800 font-medium transition-colors hover:underline px-2 py-1"
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