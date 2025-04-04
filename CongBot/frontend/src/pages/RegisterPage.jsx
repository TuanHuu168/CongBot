import React, { useState } from 'react';
import { Eye, EyeOff, User, Lock, ChevronRight, Mail, Phone } from 'lucide-react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const validateField = (field, value) => {
    switch (field) {
      case 'fullName':
        return !value ? 'Vui lòng nhập họ và tên' : '';
      case 'email':
        return !value ? 'Vui lòng nhập email' : 
               !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'Email không hợp lệ' : '';
      case 'phone':
        return !value ? 'Vui lòng nhập số điện thoại' : '';
      case 'password':
        return !value ? 'Vui lòng nhập mật khẩu' : 
                value.length < 6 ? 'Mật khẩu phải có ít nhất 6 ký tự' : '';
      case 'confirmPassword':
        return !value ? 'Vui lòng xác nhận mật khẩu' : 
               value !== formData.password ? 'Mật khẩu không khớp' : '';
      default:
        return '';
    }
  };

  const handleBlur = (field) => {
    const error = validateField(field, formData[field]);
    setErrors({
      ...errors,
      [field]: error
    });
  };

  const validateForm = () => {
    const newErrors = {
      fullName: validateField('fullName', formData.fullName),
      email: validateField('email', formData.email),
      phone: validateField('phone', formData.phone),
      password: validateField('password', formData.password),
      confirmPassword: validateField('confirmPassword', formData.confirmPassword)
    };
    
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const handleLoginClick = (e) => {
    e.preventDefault();
    navigate('/login');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (!agreedToTerms) {
      Swal.fire({
        icon: 'warning',
        title: 'Điều khoản dịch vụ',
        text: 'Vui lòng đồng ý với điều khoản dịch vụ để tiếp tục',
        confirmButtonColor: '#10b981'
      });
      return;
    }
    
    // Begin registration process
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      
      // Simulate successful registration
      Swal.fire({
        icon: 'success',
        title: 'Đăng ký thành công',
        text: 'Đang chuyển hướng đến trang đăng nhập...',
        showConfirmButton: false,
        timer: 1500,
        background: '#fff',
        iconColor: '#10b981'
      }).then(() => {
        // Redirect to login page
        navigate('/login');
      });
    }, 1500);
  };

  return (
    <motion.div 
      className="flex min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
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
          className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 260, 
            damping: 20 
          }}
          variants={containerVariants}
        >
          <motion.div className="text-center mb-8" variants={itemVariants}>
            <div className="h-16 w-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl mx-auto mb-4 shadow-lg flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">Đăng Ký</h1>
            <p className="text-gray-600 mt-2">Chatbot Hỗ Trợ Chính Sách Người Có Công</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div className="space-y-1" variants={itemVariants}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={() => handleBlur('fullName')}
                  placeholder="Họ và tên"
                  className={`w-full px-10 py-3 border ${errors.fullName ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 ${errors.fullName ? 'focus:ring-red-500' : 'focus:ring-green-500'} shadow-sm bg-gray-50 focus:bg-white`}
                />
              </div>
              {errors.fullName && <p className="text-red-500 text-sm ml-1">{errors.fullName}</p>}
            </motion.div>

            <motion.div className="space-y-1" variants={itemVariants}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                  placeholder="Email"
                  className={`w-full px-10 py-3 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 ${errors.email ? 'focus:ring-red-500' : 'focus:ring-green-500'} shadow-sm bg-gray-50 focus:bg-white`}
                />
              </div>
              {errors.email && <p className="text-red-500 text-sm ml-1">{errors.email}</p>}
            </motion.div>

            <motion.div className="space-y-1" variants={itemVariants}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                  <Phone size={18} />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={() => handleBlur('phone')}
                  placeholder="Số điện thoại"
                  className={`w-full px-10 py-3 border ${errors.phone ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 ${errors.phone ? 'focus:ring-red-500' : 'focus:ring-green-500'} shadow-sm bg-gray-50 focus:bg-white`}
                />
              </div>
              {errors.phone && <p className="text-red-500 text-sm ml-1">{errors.phone}</p>}
            </motion.div>

            <motion.div className="space-y-1" variants={itemVariants}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => handleBlur('password')}
                  placeholder="Mật khẩu"
                  className={`w-full px-10 py-3 border ${errors.password ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 ${errors.password ? 'focus:ring-red-500' : 'focus:ring-green-500'} shadow-sm bg-gray-50 focus:bg-white`}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors duration-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-sm ml-1">{errors.password}</p>}
            </motion.div>

            <motion.div className="space-y-1" variants={itemVariants}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                  <Lock size={18} />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => handleBlur('confirmPassword')}
                  placeholder="Xác nhận mật khẩu"
                  className={`w-full px-10 py-3 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 ${errors.confirmPassword ? 'focus:ring-red-500' : 'focus:ring-green-500'} shadow-sm bg-gray-50 focus:bg-white`}
                />
                <button
                  type="button"
                  onClick={toggleConfirmPasswordVisibility}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors duration-300"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-sm ml-1">{errors.confirmPassword}</p>}
            </motion.div>

            <motion.div className="flex items-start" variants={itemVariants}>
              <label className="flex items-center group cursor-pointer">
                <input 
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={() => setAgreedToTerms(!agreedToTerms)}
                  className="opacity-0 absolute h-5 w-5 cursor-pointer"
                />
                <div className="relative w-5 h-5 flex flex-shrink-0">
                  <div className={`w-5 h-5 border border-gray-300 rounded transition-all duration-300 ${agreedToTerms ? 'bg-gradient-to-r from-green-500 to-teal-500 border-green-500' : ''}`}></div>
                  {agreedToTerms && (
                    <div className="absolute inset-0 flex items-center justify-center">
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
                  <span>Đăng Ký</span>
                  <ChevronRight size={18} className="ml-2" />
                </div>
              )}
            </motion.button>
          </form>

          <motion.div className="mt-8 text-center" variants={itemVariants}>
            <p className="text-gray-600">
              Đã có tài khoản?{' '}
              <a 
                href="#" 
                onClick={handleLoginClick}
                className="text-green-600 hover:text-green-800 font-medium transition-colors duration-300 hover:underline px-2 py-1"
              >
                Đăng nhập ngay
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>


    </motion.div>
  );
};

export default RegisterPage;