import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, ChevronRight, Mail } from 'lucide-react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';

// URL cơ sở của API backend
const API_BASE_URL = 'http://localhost:8001';

const LoginPage = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFormActive, setIsFormActive] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

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

  // Animation on mount
  useEffect(() => {
    setTimeout(() => setIsFormActive(true), 100);
  }, []);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const validateUsername = (username) => {
    setUsernameError('');
    if (!username) {
      setUsernameError('Vui lòng nhập tên đăng nhập');
      return false;
    }
    return true;
  };

  const validatePassword = (password) => {
    setPasswordError('');
    if (!password) {
      setPasswordError('Vui lòng nhập mật khẩu');
      return false;
    }

    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const isUsernameValid = validateUsername(username);
    const isPasswordValid = validatePassword(password);

    if (!isUsernameValid || !isPasswordValid) {
      return;
    }

    // Tiếp tục quá trình đăng nhập
    setIsLoading(true);

    try {
      // Gửi request đăng nhập đến API
      const response = await axios.post(`${API_BASE_URL}/users/login`, {
        username: username,
        password: password
      });

      if (response.status === 200) {
        // Lấy token và thông tin người dùng từ response
        const { access_token, user_id } = response.data;

        // Lưu thông tin đăng nhập vào localStorage (hoặc sessionStorage nếu không "remember me")
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('auth_token', access_token);
        storage.setItem('user_id', user_id);

        // Thông báo đăng nhập thành công
        Swal.fire({
          icon: 'success',
          title: 'Đăng nhập thành công',
          text: 'Chào mừng bạn quay trở lại hệ thống!',
          showConfirmButton: false,
          timer: 1500,
          background: '#fff',
          iconColor: '#10b981',
          customClass: {
            popup: 'rounded-xl shadow-2xl'
          }
        }).then(() => {
          navigate('/chat', {
            state: {
              freshLogin: true,
              userId: user_id
            }
          });
        });
      }
    } catch (error) {
      console.error('Đăng nhập thất bại:', error);

      let errorMessage = 'Đăng nhập thất bại, vui lòng thử lại';

      // Xử lý thông báo lỗi từ server
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Tên đăng nhập hoặc mật khẩu không đúng';
        } else if (error.response.data && error.response.data.detail) {
          errorMessage = error.response.data.detail;
        }
      }

      Swal.fire({
        icon: 'error',
        title: 'Đăng nhập thất bại',
        text: errorMessage,
        confirmButtonColor: '#10b981',
        background: '#fff',
        customClass: {
          popup: 'rounded-xl shadow-2xl'
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();

    Swal.fire({
      title: 'Khôi phục mật khẩu',
      text: 'Vui lòng nhập email để khôi phục mật khẩu',
      input: 'email',
      inputPlaceholder: 'Nhập email của bạn',
      showCancelButton: true,
      confirmButtonText: 'Gửi yêu cầu',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      background: '#fff',
      customClass: {
        popup: 'rounded-xl shadow-2xl'
      },
      inputValidator: (value) => {
        if (!value) {
          return 'Bạn cần nhập địa chỉ email!';
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        // Hiển thị thông báo đã gửi email
        Swal.fire({
          icon: 'success',
          title: 'Yêu cầu đã được gửi',
          text: 'Vui lòng kiểm tra email của bạn để đặt lại mật khẩu',
          confirmButtonText: 'Đóng',
          confirmButtonColor: '#10b981',
          background: '#fff',
          customClass: {
            popup: 'rounded-xl shadow-2xl'
          }
        });
      }
    });
  };

  const toggleRememberMe = () => {
    setRememberMe(!rememberMe);
  };

  const handleRegisterClick = (e) => {
    e.preventDefault();
    navigate('/register');
  };

  return (
    <motion.div
      className="flex min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 relative z-10">
        <motion.div
          className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -100, opacity: 0 }}
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">Đăng Nhập</h1>
            <p className="text-gray-600 mt-2">Chatbot Hỗ Trợ Chính Sách Người Có Công</p>
          </motion.div>

          <form onSubmit={handleLogin} className="space-y-6">
            <motion.div className="space-y-1" variants={itemVariants}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (usernameError) validateUsername(e.target.value);
                  }}
                  onBlur={() => validateUsername(username)}
                  placeholder="Tên đăng nhập"
                  className={`w-full px-10 py-3 border ${usernameError ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 ${usernameError ? 'focus:ring-red-500' : 'focus:ring-green-500'} shadow-sm transition-all duration-300 bg-gray-50 focus:bg-white`}
                />
              </div>
              {usernameError && (
                <p className="text-red-500 text-sm ml-1">{usernameError}</p>
              )}
            </motion.div>

            <motion.div className="space-y-1" variants={itemVariants}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                  }}
                  onBlur={() => validatePassword(password)}
                  placeholder="Mật khẩu"
                  className={`w-full px-10 py-3 border ${passwordError ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:ring-2 ${passwordError ? 'focus:ring-red-500' : 'focus:ring-green-500'} shadow-sm transition-all duration-300 bg-gray-50 focus:bg-white`}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors duration-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p className="text-red-500 text-sm ml-1">{passwordError}</p>
              )}
            </motion.div>

            <motion.div className="flex items-center justify-between" variants={itemVariants}>
              <label className="flex items-center group cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={toggleRememberMe}
                  className="opacity-0 absolute h-5 w-5 cursor-pointer"
                />
                <div className="relative w-5 h-5 flex flex-shrink-0">
                  <div className={`w-5 h-5 border border-gray-300 rounded transition-all duration-300 ${rememberMe ? 'bg-gradient-to-r from-green-500 to-teal-500 border-green-500' : ''}`}></div>
                  {rememberMe && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-3.5 border-r-2 border-b-2 border-white transform rotate-45 translate-y-[-1px]"></div>
                    </div>
                  )}
                </div>
                <span className="ml-2 text-sm text-gray-600 group-hover:text-green-600 transition-colors duration-300">Ghi nhớ đăng nhập</span>
              </label>

              <a
                href="#"
                onClick={handleForgotPassword}
                className="text-sm text-green-600 hover:text-green-800 transition-colors duration-300 hover:underline px-2 py-1"
              >
                Quên mật khẩu?
              </a>
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
                  <span>Đăng Nhập</span>
                  <ChevronRight size={18} className="ml-2" />
                </div>
              )}
            </motion.button>
          </form>

          <motion.div className="mt-8 text-center" variants={itemVariants}>
            <p className="text-gray-600">
              Chưa có tài khoản?{' '}
              <a
                href="#"
                onClick={handleRegisterClick}
                className="text-green-600 hover:text-green-800 font-medium transition-colors duration-300 hover:underline px-2 py-1"
              >
                Đăng ký ngay
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>

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

          <h2 className="text-4xl font-bold text-white mb-6">Chào mừng đến với Chatbot Hỗ Trợ</h2>

          <p className="text-white/80 text-lg mb-8 max-w-lg">
            Hệ thống trí tuệ nhân tạo tư vấn chính sách dành cho người có công tại Việt Nam.
            Công nghệ hiện đại kết hợp với dữ liệu đầy đủ sẽ giúp bạn dễ dàng tiếp cận thông tin.
          </p>

          <div className="w-20 h-1 bg-gradient-to-r from-white/40 to-white/10 rounded mb-8"></div>

          <p className="text-white/90 italic">
            "Đền ơn đáp nghĩa là truyền thống tốt đẹp của dân tộc Việt Nam."
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LoginPage;