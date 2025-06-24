import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Key, Shield, Save, Camera, Clock, Calendar, AlertTriangle, Info, Check,
  MessageSquare, Award, FileText, BookOpen, HeartHandshake, ArrowRight, Eye, EyeOff
} from 'lucide-react';
import { useProfileLogic } from '../hooks/useProfileLogic';
import TopNavBar from '../components/common/TopNavBar';
import { formatDate, pageVariants, slideUpVariants, containerVariants } from '../utils/formatUtils';

const ProfilePage = () => {
  const navigate = useNavigate();
  const {
    formData, stats, recentChats, passwordVisibility, editMode, isLoading, passwordLoading,
    user, handleChange, handleSubmit, handlePasswordChange, handleAvatarChange, 
    handleChatClick, formatChatTitle, togglePasswordVisibility, setEditMode
  } = useProfileLogic();

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1, scale: 1,
      transition: { type: "spring", stiffness: 300, damping: 30 }
    },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <TopNavBar
        title="Cài đặt"
        showBackButton={true}
        backButtonDestination="/chat"
        backButtonText="Quay lại chat"
        user={user}
      />

      {/* User Header */}
      <div className="bg-white shadow-md border-b border-gray-200 mb-6">
        <div className="container mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-green-100 shadow-md overflow-hidden bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
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
                  <span>Chỉnh sửa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
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
                    <span className="sr-only">Đóng</span>
                    <span className="text-xl">&times;</span>
                  </button>
                </div>
              </div>

              <div className="p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {[
                    { name: 'fullName', label: 'Họ và tên', placeholder: 'Nhập họ và tên' },
                    { name: 'email', label: 'Email', placeholder: 'Nhập email', type: 'email' },
                    { name: 'phoneNumber', label: 'Số điện thoại', placeholder: 'Nhập số điện thoại', type: 'tel' },
                    { name: 'personalInfo', label: 'Thông tin cá nhân', placeholder: 'VD: Thương binh hạng 1/4, Con liệt sĩ...', isTextarea: true }
                  ].map(({ name, label, placeholder, type = 'text', isTextarea = false }) => (
                    <div key={name}>
                      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
                        {label}
                      </label>
                      {isTextarea ? (
                        <textarea
                          id={name}
                          name={name}
                          value={formData[name]}
                          onChange={handleChange}
                          disabled={isLoading}
                          rows="3"
                          className="block w-full px-4 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                          placeholder={placeholder}
                        />
                      ) : (
                        <input
                          type={type}
                          id={name}
                          name={name}
                          value={formData[name]}
                          onChange={handleChange}
                          disabled={isLoading}
                          className="block w-full px-4 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                          placeholder={placeholder}
                        />
                      )}
                    </div>
                  ))}

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

      <div className="container mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Security & About */}
          <div className="lg:col-span-1">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Security Section */}
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
                    {[
                      { name: 'currentPassword', label: 'Mật khẩu hiện tại', field: 'current' },
                      { name: 'newPassword', label: 'Mật khẩu mới', field: 'new' },
                      { name: 'confirmPassword', label: 'Xác nhận mật khẩu mới', field: 'confirm' }
                    ].map(({ name, label, field }) => (
                      <div key={name}>
                        <label htmlFor={name} className="block text-xs font-medium text-gray-700 mb-1.5">
                          {label}
                        </label>
                        <div className="relative">
                          <input
                            type={passwordVisibility[field] ? "text" : "password"}
                            id={name}
                            name={name}
                            value={formData[name]}
                            onChange={handleChange}
                            disabled={passwordLoading}
                            className="block w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10 transition-colors"
                            placeholder="●●●●●●●●"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(field)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          >
                            {passwordVisibility[field] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    ))}

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

              {/* About App Section */}
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

          {/* Right Column - Stats & Activities */}
          <div className="lg:col-span-2">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Stats Section */}
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
                    {[
                      { icon: MessageSquare, value: stats.chatCount, label: 'Cuộc trò chuyện' },
                      { icon: BookOpen, value: 0, label: 'Văn bản đã truy cập' },
                      { icon: HeartHandshake, value: 0, label: 'Phản hồi đã gửi' },
                      { icon: FileText, value: 0, label: 'Tài liệu đã lưu' }
                    ].map(({ icon: Icon, value, label }, index) => (
                      <div key={index} className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-teal-500 text-white mb-2">
                          <Icon size={20} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">{value}</h3>
                        <p className="text-xs text-gray-600">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Recent Activity */}
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
                            <h3 className="text-sm font-medium text-gray-900 truncate max-w-[250px] sm:max-w-md">
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

              {/* Suggested Questions */}
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
                    {[
                      "Ai được xác nhận là người có công với cách mạng?",
                      "Mức trợ cấp ưu đãi hàng tháng cho thương binh hạng 1/4?",
                      "Quy trình xác nhận liệt sĩ cần những giấy tờ gì?",
                      "Chính sách ưu đãi về giáo dục đối với con của người có công?"
                    ].map((question, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg cursor-pointer hover:shadow-md transition-all"
                        onClick={() => {
                          navigate('/chat', {
                            state: { suggestedQuestion: question }
                          });
                        }}
                      >
                        <p className="text-sm text-green-700">{question}</p>
                      </div>
                    ))}
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

              {/* Feedback Section */}
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