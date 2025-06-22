import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare, Book, Award, Users, ArrowRight, Check, ChevronRight,
  Shield, Search, Clock, FileText, Star, User, LogOut, ChevronDown
} from 'lucide-react';
import { useChat } from '../ChatContext';
import { getAuthData, clearAuthData, showConfirm, showSuccess } from '../utils/formatUtils';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, fetchUserInfo } = useChat();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const { token, userId } = getAuthData();

      if (token && userId) {
        setIsLoggedIn(true);

        if (user) {
          setUserInfo(user);
        } else {
          try {
            const userData = await fetchUserInfo(userId);
            if (userData) {
              setUserInfo({
                name: userData.fullName || userData.username,
                email: userData.email
              });
            }
          } catch (error) {
            console.error('Error fetching user info:', error);
          }
        }
      } else {
        setIsLoggedIn(false);
        setUserInfo(null);
      }
    };

    checkAuthStatus();
  }, [user, fetchUserInfo]);

  const handleLogout = () => {
    showConfirm('Bạn có chắc chắn muốn đăng xuất?', 'Đăng xuất').then((result) => {
      if (result.isConfirmed) {
        clearAuthData();
        setIsLoggedIn(false);
        setUserInfo(null);
        setShowUserDropdown(false);

        showSuccess('Bạn đã đăng xuất khỏi hệ thống', 'Đăng xuất thành công');

        setTimeout(() => {
          navigate('/');
          window.location.reload();
        }, 1500);
      }
    });
  };

  const features = [
    {
      title: 'Trò chuyện thông minh',
      description: 'Tương tác tự nhiên với hệ thống trí tuệ nhân tạo được huấn luyện đặc biệt để hiểu và trả lời các câu hỏi về chính sách người có công.'
    },
    {
      title: 'Thông tin chính xác',
      description: 'Dữ liệu được tổng hợp từ các văn bản pháp luật chính thức về chính sách ưu đãi người có công với cách mạng.'
    },
    {
      title: 'Cập nhật liên tục',
      description: 'Hệ thống được cập nhật thường xuyên theo các chính sách mới nhất, đảm bảo thông tin luôn chính xác và đáp ứng nhu cầu người dùng.'
    },
    {
      title: 'Hỗ trợ mọi đối tượng',
      description: 'Thiết kế thân thiện, dễ sử dụng với mọi đối tượng người dùng, không cần kiến thức chuyên môn về công nghệ.'
    }
  ];

  const benefits = [
    'Tiếp cận thông tin chính sách một cách nhanh chóng',
    'Xác định chính xác quyền lợi và thủ tục cần thiết',
    'Tiết kiệm thời gian tìm kiếm qua nhiều văn bản pháp luật',
    'Thuận tiện sử dụng mọi lúc, mọi nơi',
    'Không cần kiến thức chuyên môn về luật',
    'Dữ liệu được cập nhật liên tục theo quy định mới nhất'
  ];

  const faqs = [
    {
      question: 'Chatbot này hoạt động như thế nào?',
      answer: 'Chatbot sử dụng công nghệ RAG (Retrieval Augmented Generation) kết hợp với mô hình ngôn ngữ lớn để truy xuất thông tin chính xác từ cơ sở dữ liệu văn bản pháp luật về người có công, sau đó tạo ra câu trả lời phù hợp với câu hỏi của người dùng.'
    },
    {
      question: 'Thông tin do chatbot cung cấp có chính xác không?',
      answer: 'Chatbot truy xuất thông tin từ nguồn dữ liệu chính thức về chính sách người có công. Tuy nhiên, kết quả chỉ mang tính chất tham khảo và người dùng nên xác minh với cơ quan chức năng cho các quyết định quan trọng.'
    },
    {
      question: 'Tôi có phải trả phí để sử dụng chatbot này không?',
      answer: 'Không, chatbot này hoàn toàn miễn phí. Đây là sản phẩm từ đồ án tốt nghiệp nhằm hỗ trợ cộng đồng tiếp cận thông tin về chính sách người có công.'
    },
    {
      question: 'Chatbot có thể hỗ trợ những thông tin gì?',
      answer: 'Chatbot có thể cung cấp thông tin về các chế độ ưu đãi, trợ cấp, quy trình thủ tục hành chính, và quyền lợi dành cho người có công với cách mạng và thân nhân của họ.'
    }
  ];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50">
      <header className="w-full bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
                  <div className="relative">
                    <Award size={20} className="text-white" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white"></div>
                  </div>
                </div>
              </div>
              <div className="ml-2">
                <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">CongBot</span>
                <p className="text-xs text-gray-500 -mt-1">Hỗ trợ người có công</p>
              </div>
            </div>
            
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">Tính năng</a>
              <a href="#benefits" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">Lợi ích</a>
              <a href="#faq" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">Hỏi đáp</a>
            </nav>

            <div className="flex items-center space-x-4">
              {isLoggedIn ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg py-2 px-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                      <User size={16} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                      {userInfo?.name || 'Người dùng'}
                    </span>
                    <ChevronDown size={16} className={`text-gray-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-100">
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          navigate('/chat');
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <MessageSquare size={16} className="mr-2 text-gray-500" />
                        <span>Vào trang chat</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          navigate('/profile');
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <User size={16} className="mr-2 text-gray-500" />
                        <span>Hồ sơ cá nhân</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          navigate('/history');
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Clock size={16} className="mr-2 text-gray-500" />
                        <span>Lịch sử trò chuyện</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          handleLogout();
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100 mt-1"
                      >
                        <LogOut size={16} className="mr-2" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-green-600 hover:text-green-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="bg-gradient-to-r from-green-500 to-teal-600 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all"
                  >
                    Đăng ký
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-teal-700 clip-hero-shape"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-28 md:pt-32 md:pb-40">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <motion.div
              className="md:w-1/2 space-y-6 text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Chatbot Hỗ Trợ Chính Sách Người Có Công
              </h1>
              <p className="text-lg md:text-xl text-green-50">
                Tra cứu thông tin chính sách dễ dàng thông qua trò chuyện thông minh. Tiếp cận thông tin chính xác về quyền lợi và thủ tục dành cho người có công với cách mạng.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                {isLoggedIn ? (
                  <button
                    onClick={() => navigate('/chat')}
                    className="inline-flex items-center justify-center bg-white text-green-700 font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:translate-y-[-2px] transition-all"
                  >
                    Vào trang chat
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => navigate('/register')}
                      className="inline-flex items-center justify-center bg-white text-green-700 font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:translate-y-[-2px] transition-all"
                    >
                      Bắt đầu ngay
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </button>
                    <button
                      onClick={() => navigate('/chat')}
                      className="inline-flex items-center justify-center bg-green-700 bg-opacity-30 text-white border border-white border-opacity-30 backdrop-blur-sm font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-opacity-40 transition-all"
                    >
                      Dùng thử
                    </button>
                  </>
                )}
              </div>
            </motion.div>
            <motion.div
              className="md:w-1/2 mt-8 md:mt-0"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="bg-white p-4 rounded-2xl shadow-2xl transform rotate-5">
                <div className="bg-gray-100 rounded-xl p-3 mb-3">
                  <div className="flex space-x-2 mb-1">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex flex-col space-y-4">
                      <div className="flex justify-end">
                        <div className="bg-green-100 text-green-800 p-3 rounded-xl max-w-xs">
                          Tôi muốn biết về mức trợ cấp hàng tháng cho thương binh hạng 1/4 theo quy định mới nhất
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex-shrink-0 mr-2 flex items-center justify-center">
                          <MessageSquare className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-white text-gray-800 p-3 rounded-xl max-w-xs shadow-sm border border-gray-100">
                          Theo quy định mới nhất tại Nghị định 55/2023/NĐ-CP có hiệu lực từ ngày 05/09/2023, mức trợ cấp hàng tháng cho thương binh hạng 1/4 (tỷ lệ tổn thương cơ thể 81-100%) dao động từ 5.335.000 đồng đến 6.589.000 đồng tùy theo tỷ lệ thương tật chính xác.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-green-50"></div>
      </section>

      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Tính năng nổi bật</h2>
            <div className="w-20 h-1.5 bg-gradient-to-r from-green-500 to-teal-600 mx-auto mb-4 rounded-full"></div>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Công nghệ hiện đại kết hợp với dữ liệu đáng tin cậy mang đến trải nghiệm tư vấn chính sách toàn diện
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg border border-gray-100 transition-all duration-300 transform hover:translate-y-[-5px]"
                variants={itemVariants}
              >
                <div className="w-16 h-16 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                  {index === 0 && <MessageSquare className="h-10 w-10 text-green-500" />}
                  {index === 1 && <Book className="h-10 w-10 text-green-500" />}
                  {index === 2 && <Award className="h-10 w-10 text-green-500" />}
                  {index === 3 && <Users className="h-10 w-10 text-green-500" />}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-green-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Cách Thức Hoạt Động</h2>
            <div className="w-20 h-1.5 bg-gradient-to-r from-green-500 to-teal-600 mx-auto mb-4 rounded-full"></div>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Đơn giản, hiệu quả và đáng tin cậy - trải nghiệm tìm kiếm thông tin mới
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 w-4/5 h-0.5 bg-green-200 hidden md:block"></div>

            {[
              { icon: Search, title: 'Đặt câu hỏi', desc: 'Nhập câu hỏi của bạn về chính sách người có công vào chatbot một cách tự nhiên, như đang trò chuyện với chuyên gia.' },
              { icon: Shield, title: 'Xử lý thông minh', desc: 'Hệ thống sử dụng công nghệ RAG để tìm kiếm thông tin chính xác từ cơ sở dữ liệu văn bản pháp luật.' },
              { icon: FileText, title: 'Nhận câu trả lời', desc: 'Nhận được câu trả lời rõ ràng, dễ hiểu với tham chiếu đến các văn bản pháp luật chính thức.' }
            ].map((step, index) => (
              <motion.div
                key={index}
                className="text-center z-1"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: (index + 1) * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white text-green-600 mb-6 shadow-md border border-green-100">
                  <step.icon className="h-7 w-7" />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h3 className="text-xl font-semibold mb-3 text-gray-900">{step.title}</h3>
                  <p className="text-gray-600">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Lợi ích khi sử dụng</h2>
            <div className="w-20 h-1.5 bg-gradient-to-r from-green-500 to-teal-600 mx-auto mb-4 rounded-full"></div>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Tiếp cận thông tin nhanh chóng và chính xác
            </p>
          </motion.div>

          <motion.div
            className="bg-gradient-to-br from-green-50 to-teal-50 rounded-2xl shadow-lg p-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  className="flex items-start"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-green-500 to-teal-600 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <p className="ml-3 text-gray-700 font-medium">{benefit}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="faq" className="py-20 bg-gradient-to-br from-green-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Câu hỏi thường gặp</h2>
            <div className="w-20 h-1.5 bg-gradient-to-r from-green-500 to-teal-600 mx-auto mb-4 rounded-full"></div>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Giải đáp thắc mắc của bạn
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto divide-y divide-gray-200">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                className="py-6"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
              >
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm mr-3 flex-shrink-0">Q</span>
                  {faq.question}
                </h3>
                <p className="mt-3 text-gray-600 ml-9">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Đánh giá từ người dùng</h2>
            <div className="w-20 h-1.5 bg-gradient-to-r from-green-500 to-teal-600 mx-auto mb-4 rounded-full"></div>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Trải nghiệm thực tế từ người sử dụng hệ thống
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                content: "Tôi là thương binh hạng 2/4 và thường xuyên cần tìm hiểu về các chính sách ưu đãi. Chatbot này giúp tôi tiết kiệm rất nhiều thời gian và luôn cung cấp thông tin chính xác.",
                name: "Nguyễn Văn A",
                role: "Thương binh hạng 2/4"
              },
              {
                content: "Là cán bộ phụ trách chính sách người có công, tôi thường xuyên sử dụng công cụ này để tra cứu thông tin. Rất nhanh chóng và thuận tiện, giúp tôi tư vấn cho người dân được tốt hơn.",
                name: "Trần Thị B",
                role: "Cán bộ phòng LĐTBXH"
              },
              {
                content: "Tôi đang tìm hiểu chính sách hỗ trợ cho bố mẹ là người có công. Chatbot đã cung cấp thông tin rất chi tiết, giúp tôi hiểu rõ các quyền lợi gia đình được hưởng.",
                name: "Hoàng Văn C",
                role: "Con của người có công"
              }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                className="bg-green-50 p-6 rounded-xl shadow-md"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: (index + 1) * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} fill="currentColor" />
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 mb-4">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-900">{testimonial.name}</h4>
                    <p className="text-xs text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-green-600 to-teal-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-4">Sẵn sàng trải nghiệm?</h2>
            <p className="text-xl mb-8 text-green-100 max-w-2xl mx-auto">
              Bắt đầu sử dụng Chatbot Hỗ Trợ Chính Sách Người Có Công ngay hôm nay
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              {isLoggedIn ? (
                <button
                  onClick={() => navigate('/chat')}
                  className="inline-flex items-center justify-center bg-white text-green-700 font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transform hover:translate-y-[-2px] transition-all"
                >
                  Vào trang chat
                  <ChevronRight className="ml-2 h-5 w-5" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/register')}
                    className="inline-flex items-center justify-center bg-white text-green-700 font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transform hover:translate-y-[-2px] transition-all"
                  >
                    Đăng ký tài khoản
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="inline-flex items-center justify-center bg-green-500 bg-opacity-20 text-white border border-white border-opacity-30 font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-opacity-30 transition-all"
                  >
                    Đăng nhập
                  </button>
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            viewport={{ once: true }}
          >
            <div>
              <div className="text-4xl font-bold text-white mb-2">100+</div>
              <p className="text-green-100">Văn bản pháp luật</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">24/7</div>
              <p className="text-green-100">Hỗ trợ liên tục</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">5.000+</div>
              <p className="text-green-100">Người dùng hài lòng</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">0đ</div>
              <p className="text-green-100">Miễn phí hoàn toàn</p>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <div className="relative">
                    <Award size={20} className="text-white" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white"></div>
                  </div>
                </div>
                <span className="ml-2 text-xl font-bold bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent">CongBot</span>
              </div>
              <p className="mt-4 max-w-xs text-gray-400">
                Chatbot hỗ trợ tra cứu thông tin về chính sách người có công với cách mạng.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Truy cập nhanh</h3>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Tính năng</a></li>
                  <li><a href="#benefits" className="text-gray-400 hover:text-white transition-colors">Lợi ích</a></li>
                  <li><a href="#faq" className="text-gray-400 hover:text-white transition-colors">Hỏi đáp</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Tài nguyên</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Hướng dẫn sử dụng</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Văn bản pháp luật</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Thư viện</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Liên kết</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Điều khoản sử dụng</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Chính sách bảo mật</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Liên hệ</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .clip-hero-shape {
          clip-path: polygon(0 0, 100% 0, 100% 85%, 0 100%);
        }
      `}</style>
    </div>
  );
};

export default LandingPage;