import React, { useState } from 'react';
import { Eye, EyeOff, User, Lock } from 'lucide-react';

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    // Login logic here
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="w-full md:w-1/2 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-lg shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-green-700">Đăng Nhập</h1>
            <p className="text-gray-600 mt-2">Chatbot Hỗ Trợ Chính Sách Người Có Công</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                <User size={20} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                <Lock size={20} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full px-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-green-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                <span className="ml-2 text-sm text-gray-600">Ghi nhớ đăng nhập</span>
              </label>
              <a href="#" className="text-sm text-green-600 hover:underline">Quên mật khẩu?</a>
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out"
            >
              Đăng Nhập
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Chưa có tài khoản?{' '}
              <a href="/register" className="text-green-600 hover:underline font-medium">
                Đăng ký ngay
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden md:block md:w-1/2 bg-green-600 p-12 relative">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("/images/bg-pattern.svg")', opacity: 0.2 }}></div>
        <div className="relative h-full flex flex-col justify-center">
          <h2 className="text-4xl font-bold text-white mb-6">Chào mừng đến với Chatbot Hỗ Trợ Chính Sách Người Có Công</h2>
          <p className="text-white text-lg mb-8">
            Hệ thống trí tuệ nhân tạo hỗ trợ tư vấn chính sách dành cho người có công với cách mạng tại Việt Nam.
          </p>
          <div className="w-20 h-1 bg-white rounded mb-8"></div>
          <p className="text-white">
            "Đền ơn đáp nghĩa là truyền thống tốt đẹp của dân tộc Việt Nam."
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;