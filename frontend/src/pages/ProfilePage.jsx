import React, { useState } from 'react';
import { User, Mail, Phone, Key, Shield, Settings, Save, ChevronLeft, Camera, Clock, Calendar, AlertTriangle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const ProfilePage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: 'Nguyễn Văn A',
    email: 'nguyenvana@gmail.com',
    phone: '0912345678',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Sử dụng SweetAlert2 thay vì alert
    Swal.fire({
      title: 'Thành công!',
      text: 'Thông tin cá nhân đã được cập nhật',
      icon: 'success',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#16a34a'
    });
    
    setEditMode(false);
  };
  
  const handlePasswordChange = (e) => {
    e.preventDefault();
    
    // Kiểm tra mật khẩu mới và xác nhận mật khẩu
    if (formData.newPassword !== formData.confirmPassword) {
      Swal.fire({
        title: 'Lỗi!',
        text: 'Mật khẩu mới và xác nhận mật khẩu không khớp',
        icon: 'error',
        confirmButtonText: 'Thử lại',
        confirmButtonColor: '#16a34a'
      });
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
      return;
    }
    
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 shadow-lg">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center relative">
            <button 
              onClick={navigateToChat}
              className="flex items-center text-white hover:text-green-100 transition-colors absolute left-0"
            >
              <ChevronLeft size={20} />
              <span className="text-sm font-medium">Quay lại chat</span>
            </button>
            <h1 className="text-lg font-bold">Hồ sơ người dùng</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              className={`px-6 py-3 text-xs font-medium transition-colors duration-200 ${
                activeTab === 'profile'
                  ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('profile')}
            >
              <div className="flex items-center">
                <User size={14} className="mr-1.5" />
                <span>Thông tin cá nhân</span>
              </div>
            </button>
            <button
              className={`px-6 py-3 text-xs font-medium transition-colors duration-200 ${
                activeTab === 'security'
                  ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('security')}
            >
              <div className="flex items-center">
                <Shield size={14} className="mr-1.5" />
                <span>Bảo mật</span>
              </div>
            </button>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 flex items-center">
                  <User size={16} className="mr-1.5 text-green-600" />
                  Thông tin cá nhân
                </h2>
                <button
                  type="button"
                  className={`flex items-center text-xs px-3 py-1.5 rounded-full transition-all ${
                    editMode 
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                  onClick={() => setEditMode(!editMode)}
                >
                  <Settings size={14} className="mr-1.5" />
                  <span>{editMode ? 'Hủy chỉnh sửa' : 'Chỉnh sửa'}</span>
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:space-x-6">
                    <div className="w-full md:w-1/3 flex justify-center mb-6 md:mb-0">
                      <div className="relative">
                        <div className="w-32 h-32 bg-gradient-to-br from-green-50 to-teal-50 rounded-full flex items-center justify-center overflow-hidden border-4 border-green-100 transition-all duration-300 hover:shadow-lg">
                          <User size={64} className="text-green-500" />
                        </div>
                        {editMode && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={handleAvatarChange}
                              className="bg-green-600 bg-opacity-80 hover:bg-opacity-100 text-white rounded-full p-2 shadow-md hover:bg-green-700 transition-all duration-200 transform hover:scale-110"
                            >
                              <Camera size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full md:w-2/3 space-y-4">
                      <div>
                        <label htmlFor="fullName" className="block text-xs font-medium text-gray-700 mb-1">
                          Họ và tên
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="fullName"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            disabled={!editMode}
                            className={`block w-full pl-10 pr-3 py-2 text-sm border ${
                              editMode 
                                ? 'border-gray-300 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500' 
                                : 'border-gray-200 bg-gray-50'
                            } rounded-lg shadow-sm transition-all`}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={!editMode}
                            className={`block w-full pl-10 pr-3 py-2 text-sm border ${
                              editMode 
                                ? 'border-gray-300 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500' 
                                : 'border-gray-200 bg-gray-50'
                            } rounded-lg shadow-sm transition-all`}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">
                          Số điện thoại
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Phone size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            disabled={!editMode}
                            className={`block w-full pl-10 pr-3 py-2 text-sm border ${
                              editMode 
                                ? 'border-gray-300 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500' 
                                : 'border-gray-200 bg-gray-50'
                            } rounded-lg shadow-sm transition-all`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {editMode && (
                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        className="flex items-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:translate-y-[-2px]"
                      >
                        <Save size={16} className="mr-1.5" />
                        Lưu thay đổi
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="p-6">
              <div className="flex items-center mb-4">
                <Shield size={16} className="text-green-600 mr-1.5" />
                <h2 className="text-base font-semibold text-gray-900">Thay đổi mật khẩu</h2>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md mb-8">
                <div>
                  <label htmlFor="currentPassword" className="block text-xs font-medium text-gray-700 mb-1">
                    Mật khẩu hiện tại
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="password"
                      id="currentPassword"
                      name="currentPassword"
                      placeholder="Nhập mật khẩu hiện tại"
                      value={formData.currentPassword}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-xs font-medium text-gray-700 mb-1">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      placeholder="Nhập mật khẩu mới"
                      value={formData.newPassword}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      required
                    />
                  </div>
                  <div className="mt-1 flex items-start">
                    <AlertTriangle size={12} className="text-amber-500 mt-0.5 mr-1 flex-shrink-0" />
                    <p className="text-xs text-gray-500">
                      Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ hoa, chữ thường và số.
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      placeholder="Nhập lại mật khẩu mới"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:translate-y-[-2px]"
                  >
                    <Save size={16} className="mr-1.5" />
                    Cập nhật mật khẩu
                  </button>
                </div>
              </form>

              <div className="border-t border-gray-200 pt-5">
                <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                  <Shield size={16} className="text-green-600 mr-1.5" />
                  Bảo mật tài khoản
                </h3>
                
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 p-3 mb-5 rounded-r shadow-sm">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Shield size={18} className="text-amber-500" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs text-amber-700">
                        Để bảo vệ tài khoản của bạn, hãy sử dụng mật khẩu mạnh và thay đổi định kỳ 3 tháng một lần.
                        Không chia sẻ mật khẩu với bất kỳ ai và đảm bảo đăng xuất khi sử dụng máy tính công cộng.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center">
                      <div className="p-1.5 bg-green-100 rounded-full mr-2">
                        <Clock size={14} className="text-green-600" />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-900">Đăng nhập lần cuối</h4>
                        <p className="text-xs text-gray-500 mt-0.5">12/03/2024, 14:30</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center">
                      <div className="p-1.5 bg-green-100 rounded-full mr-2">
                        <Calendar size={14} className="text-green-600" />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-900">Thay đổi mật khẩu lần cuối</h4>
                        <p className="text-xs text-gray-500 mt-0.5">05/02/2024</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Additional info panel */}
        <div className="mt-6 bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="p-6">
            <h2 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <div className="bg-green-100 p-1.5 rounded-full mr-2">
                <Info size={14} className="text-green-600" />
              </div>
              Thông tin về ứng dụng
            </h2>
            <div className="space-y-3 text-gray-600 text-xs">
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
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;