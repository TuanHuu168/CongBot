import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, User, Lock, ChevronRight, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { userAPI } from '../apiService';
import { validateUsername, validateEmail, validatePassword, validateFullName, validatePhoneNumber, validateConfirmPassword, pageVariants, containerVariants, itemVariants, ROUTES, showError, showSuccess } from '../utils/formatUtils';

const FormField = React.memo(({ name, type = 'text', placeholder, icon: Icon, showToggle = false, toggleState, onToggle, value, onChange, onBlur, error }) => (
  <motion.div className="space-y-1" variants={itemVariants}>
    <div className="relative">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
        <Icon size={18} />
      </div>
      <input
        type={showToggle ? (toggleState ? "text" : "password") : type}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full px-10 py-3 border ${error ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-green-500'} shadow-sm bg-gray-50 focus:bg-white`}
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

const RegisterPage = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '', fullName: '', email: '', phoneNumber: '', password: '', confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const validateField = (field, value) => {
    switch (field) {
      case 'username': return validateUsername(value);
      case 'fullName': return validateFullName(value);
      case 'email': return validateEmail(value);
      case 'phoneNumber': return validatePhoneNumber(value);
      case 'password': return validatePassword(value);
      case 'confirmPassword': return validateConfirmPassword(formData.password, value);
      default: return '';
    }
  };

  const handleBlur = useCallback((field) => {
    const error = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: error }));
  }, [formData]);

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(field => {
      newErrors[field] = validateField(field, formData[field]);
    });
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  // SỬA: Sử dụng useCallback để tránh re-render
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }, [errors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (!agreedToTerms) {
      showError('Vui lòng đồng ý với điều khoản dịch vụ để tiếp tục', 'Điều khoản dịch vụ');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const userData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber
      };
      
      await userAPI.register(userData);
      
      showSuccess('Đăng ký thành công', 'Đang chuyển hướng đến trang đăng nhập...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error) {
      showError(error.detail || 'Đã có lỗi xảy ra khi đăng ký', 'Đăng ký thất bại');
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
          
          <h2 className="text-4xl font-bold text-white mb-6">Tạo tài khoản mới</h2>
          <p className="text-white/80 text-lg mb-8 max-w-lg">
            Đăng ký để trải nghiệm Chatbot hỗ trợ chính sách người có công với cách mạng tại Việt Nam.
          </p>
          <div className="w-20 h-1 bg-gradient-to-r from-white/40 to-white/10 rounded mb-8"></div>
          <p className="text-white/90 italic">
            "Uống nước nhớ nguồn, ăn quả nhớ người trồng cây."
          </p>
        </motion.div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-6 relative z-10">
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">ĐĂNG KÝ</h1>
            <p className="text-gray-600 mt-2">Chatbot hỗ trợ chính sách người có công</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField 
              name="username" 
              placeholder="Tên đăng nhập" 
              icon={User} 
              value={formData.username}
              onChange={handleChange}
              onBlur={() => handleBlur('username')}
              error={errors.username}
            />
            <FormField 
              name="fullName" 
              placeholder="Họ và tên" 
              icon={User} 
              value={formData.fullName}
              onChange={handleChange}
              onBlur={() => handleBlur('fullName')}
              error={errors.fullName}
            />
            <FormField 
              name="email" 
              type="email" 
              placeholder="Email" 
              icon={Mail} 
              value={formData.email}
              onChange={handleChange}
              onBlur={() => handleBlur('email')}
              error={errors.email}
            />
            <FormField 
              name="phoneNumber" 
              type="tel" 
              placeholder="Số điện thoại" 
              icon={Phone} 
              value={formData.phoneNumber}
              onChange={handleChange}
              onBlur={() => handleBlur('phoneNumber')}
              error={errors.phoneNumber}
            />
            <FormField 
              name="password" 
              placeholder="Mật khẩu" 
              icon={Lock} 
              showToggle 
              toggleState={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
              value={formData.password}
              onChange={handleChange}
              onBlur={() => handleBlur('password')}
              error={errors.password}
            />
            <FormField 
              name="confirmPassword" 
              placeholder="Xác nhận mật khẩu" 
              icon={Lock} 
              showToggle 
              toggleState={showConfirmPassword}
              onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={() => handleBlur('confirmPassword')}
              error={errors.confirmPassword}
            />

            <motion.div className="flex items-start" variants={itemVariants}>
              <label className="flex items-center group cursor-pointer">
                <input 
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={() => setAgreedToTerms(!agreedToTerms)}
                  className="opacity-0 absolute h-5 w-5 cursor-pointer"
                />
                <div className={`w-5 h-5 border border-gray-300 rounded transition-all duration-300 ${agreedToTerms ? 'bg-gradient-to-r from-green-500 to-teal-500 border-green-500' : ''}`}>
                  {agreedToTerms && (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-2 h-3.5 border-r-2 border-b-2 border-white transform rotate-45 translate-y-[-1px]"></div>
                    </div>
                  )}
                </div>
                <span className="ml-2 text-sm text-gray-600 group-hover:text-green-600 transition-colors duration-300">
                  Tôi đồng ý với <a href="#" className="text-green-600 hover:text-green-800 transition-colors duration-300 hover:underline">Điều khoản dịch vụ</a> và{' '}
                  <a href="#" className="text-green-600 hover:text-green-800 transition-colors duration-300 hover:underline">Chính sách bảo mật</a>
                </span>
              </label>
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
                  <span>ĐĂNG KÝ</span>
                  <ChevronRight size={18} className="ml-2" />
                </div>
              )}
            </motion.button>
          </form>

          <motion.div className="mt-2 text-center" variants={itemVariants}>
            <p className="text-gray-600">
              Đã có tài khoản?{' '}
              <button 
                onClick={() => navigate('/login')}
                className="text-green-600 hover:text-green-800 font-medium transition-colors duration-300 hover:underline px-2 py-1"
              >
                Đăng nhập ngay
              </button>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default RegisterPage;