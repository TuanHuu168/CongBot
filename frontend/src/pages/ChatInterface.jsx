import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, MessageSquare, History, Info, LogOut, User, X, FileText, Search, Plus, Settings, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChat } from '../ChatContext';
import { askQuestion, updateChatTitle } from '../apiService';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import Swal from 'sweetalert2';

const ChatInterface = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;

  const {
    user,
    chatHistory,
    isLoading,
    setIsLoading,
    activeChatMessages,
    setActiveChatMessages,
    currentChatId,
    setCurrentChatId,
    createNewChat,
    switchChat,
    addExchange,
    setChatHistory,
    fetchChatHistory,
    error
  } = useChat();

  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [localError, setLocalError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getDisplayTitle = (chat) => {
    if (!chat.title) return "Cuộc trò chuyện mới";

    // Kiểm tra xem title có phải là ID hay không (format ObjectId của MongoDB)
    const isIdTitle = chat.title.match(/^[0-9a-f]{24}$/i);

    // Nếu title trống hoặc là ID, trả về title mặc định
    if (isIdTitle || chat.title.trim() === "") {
      return "Cuộc trò chuyện mới";
    }

    return chat.title;
  };

  // Kiểm tra xem nếu đến từ trang đăng nhập
  useEffect(() => {
    if (state?.freshLogin) {
      console.log('Đăng nhập mới, đang tải lịch sử chat...');
      fetchChatHistory();
    }
  }, [state]);

  // Ghi log thông tin debug
  useEffect(() => {
    console.log('ChatHistory:', chatHistory);
    console.log('Current Chat ID:', currentChatId);
    console.log('Active Chat Messages:', activeChatMessages);
  }, [chatHistory, currentChatId, activeChatMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [activeChatMessages]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (input.trim() === '' || isLoading) return;

    const userQuestion = input;
    setInput('');
    setIsLoading(true);
    setLocalError(null);

    // Đóng sidebar trên mobile khi gửi tin nhắn
    if (isMobile) {
      setIsSidebarOpen(false);
    }

    let chatId = currentChatId; // Lưu lại ID hiện tại hoặc ID mới

    try {
      // Nếu chưa có cuộc trò chuyện hiện tại, tạo mới và LƯU lại ID
      if (!currentChatId) {
        console.log('Không có ID cuộc trò chuyện hiện tại, đang tạo cuộc trò chuyện mới...');
        chatId = await createNewChat();
        setCurrentChatId(chatId);
        console.log('Đã tạo cuộc trò chuyện mới với ID:', chatId);
      }

      // Thêm tin nhắn người dùng vào UI ngay lập tức
      const userMessageId = `user_${Date.now()}`;
      setActiveChatMessages(prev => [...prev, {
        id: userMessageId,
        sender: 'user',
        text: userQuestion,
        timestamp: new Date().toISOString()
      }]);

      // Gọi API với ID cuộc trò chuyện đã có hoặc vừa tạo
      console.log('Đang gửi câu hỏi đến API, id cuộc trò chuyện:', chatId);
      const response = await askQuestion(userQuestion, chatId);
      console.log('Phản hồi từ API:', response);

      // Thêm tin nhắn bot vào UI
      const botMessageId = `bot_${Date.now()}`;
      setActiveChatMessages(prev => [...prev, {
        id: botMessageId,
        sender: 'bot',
        text: response.answer,
        timestamp: new Date().toISOString(),
        processingTime: response.total_time || 0,
        context: response.top_chunks || []
      }]);

      // Cập nhật ID cuộc trò chuyện nếu có ID mới và khác với ID hiện tại
      if (response.id && response.id !== chatId) {
        console.log('Cập nhật ID cuộc trò chuyện từ', chatId, 'thành', response.id);
        setCurrentChatId(response.id);
        chatId = response.id;

        // Nếu là chat mới, thêm vào danh sách chat trong state
        if (chatHistory.findIndex(chat => chat.id === response.id) === -1) {
          const newChat = {
            id: response.id,
            title: userQuestion.substring(0, 30) + (userQuestion.length > 30 ? '...' : ''),
            date: new Date().toLocaleDateString('vi-VN'),
            updated_at: new Date().toISOString(),
            status: 'active'
          };

          setChatHistory(prev => [newChat, ...prev]);
        }
      }

      // Xác định xem có phải tin nhắn đầu tiên không để cập nhật tiêu đề
      const isFirstMessage = activeChatMessages.length <= 2; // 2 vì chúng ta vừa thêm tin nhắn user và có thể có tin nhắn chào mừng

      if (isFirstMessage) {
        // Chuẩn bị tiêu đề mới
        const newTitle = userQuestion.length > 30
          ? userQuestion.substring(0, 30) + '...'
          : userQuestion;

        console.log('Cập nhật tiêu đề cuộc trò chuyện:', newTitle, 'cho chat ID:', chatId);

        // Cập nhật trong state
        setChatHistory(prev =>
          prev.map(chat =>
            chat.id === chatId
              ? { ...chat, title: newTitle, updated_at: new Date().toISOString() }
              : chat
          )
        );

        // Cập nhật tiêu đề thông qua API
        try {
          await updateChatTitle(chatId, newTitle);
          console.log("Tiêu đề cuộc trò chuyện đã được cập nhật thành công:", newTitle);
        } catch (titleError) {
          console.error('Lỗi khi cập nhật tiêu đề:', titleError);
          // Không hiển thị lỗi cho người dùng vì đây không phải lỗi nghiêm trọng
        }
      }

    } catch (error) {
      console.error('Error getting response:', error);
      setLocalError(error.detail || 'Có lỗi khi kết nối với máy chủ');

      // Thêm thông báo lỗi vào UI
      setActiveChatMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        sender: 'bot',
        text: 'Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
        timestamp: new Date().toISOString()
      }]);

      // Hiển thị thông báo lỗi với SweetAlert2
      Swal.fire({
        icon: 'error',
        title: 'Lỗi kết nối',
        text: error.detail || 'Có lỗi khi kết nối với máy chủ. Vui lòng thử lại sau.',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setIsLoading(false);
      // Cuộn đến tin nhắn mới nhất
      scrollToBottom();
    }
  };

  // Lọc lịch sử chat dựa trên tìm kiếm
  const filteredChats = chatHistory?.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    chat.status === 'active'
  ) || [];

  // Sắp xếp lịch sử chat theo thời gian gần nhất
  const sortedFilteredChats = [...filteredChats].sort((a, b) =>
    new Date(b.updated_at || b.date) - new Date(a.updated_at || a.date)
  ).slice(0, 5); // Chỉ hiển thị 5 cuộc trò chuyện gần nhất

  const handleNewChat = () => {
    createNewChat();
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    // Xóa token trong localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    navigate('/login');
  };

  // Animation variants
  const pageVariants = {
    initial: {
      opacity: 0,
      y: 20
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut"
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.3,
        ease: "easeIn"
      }
    }
  };

  const messageVariants = {
    initial: {
      opacity: 0,
      y: 20
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3
      }
    }
  };

  // Hiển thị thông báo lỗi nếu có
  const renderError = () => {
    if (!error && !localError) return null;

    return (
      <motion.div
        className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg shadow-md z-50 flex items-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <AlertTriangle size={16} className="mr-2" />
        <span>{error || localError}</span>
        <button
          className="ml-3 text-red-500 hover:text-red-700"
          onClick={() => setLocalError(null)}
        >
          <X size={14} />
        </button>
      </motion.div>
    );
  };

  return (
    <motion.div
      className="flex h-screen w-screen overflow-hidden bg-gray-50"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {renderError()}

      {/* Overlay for mobile */}
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:z-0 md:shadow-none md:border-r md:border-gray-200`}
      >
        <div className="flex flex-col h-full">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center mr-2">
                <MessageSquare size={16} className="text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-800">CongBot Chat</h1>
            </div>
          </div>

          <div className="flex items-center p-3 border-b border-gray-200 bg-gray-50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mr-2">
              <User size={18} className="text-white" />
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-gray-800 truncate">{user?.name || 'Người dùng'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email || user?.username || 'user@example.com'}</p>
            </div>
          </div>

          <div className="p-3">
            <button
              onClick={handleNewChat}
              className="flex items-center w-full py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg mb-3 transition-colors duration-200 shadow-sm"
            >
              <Plus size={16} className="mr-2" />
              <span className="font-medium">Cuộc trò chuyện mới</span>
            </button>

            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Tìm kiếm cuộc trò chuyện..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2 pl-9 pr-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="p-3">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <History size={16} className="mr-2 text-gray-600" />
                  <h2 className="text-sm font-semibold text-gray-800">Lịch sử trò chuyện</h2>
                </div>
                <button
                  className="text-xs text-green-600 hover:text-green-700 font-medium"
                  onClick={() => navigate('/history')}
                >
                  Xem tất cả
                </button>
              </div>

              {sortedFilteredChats.length > 0 ? (
                <div className="space-y-1">
                  {sortedFilteredChats.map((chat) => (
                    <button
                      key={chat.id}
                      className={`flex items-center w-full py-2 px-3 rounded-lg transition-all duration-200 ${currentChatId === chat.id
                          ? 'bg-green-50 text-green-700 border-l-4 border-green-600 shadow-sm'
                          : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      onClick={() => {
                        switchChat(chat.id);
                        if (isMobile) {
                          setIsSidebarOpen(false);
                        }
                      }}
                    >
                      <div className="flex-1 text-left overflow-hidden">
                        <p className="truncate text-sm font-medium">{getDisplayTitle(chat)}</p>
                        <p className="text-xs text-gray-500 mt-1">{chat.date}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-gray-500 text-sm">
                  {searchQuery
                    ? "Không tìm thấy cuộc trò chuyện nào"
                    : isLoading ? "Đang tải..." : "Chưa có lịch sử trò chuyện"}
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto p-3 border-t border-gray-200 bg-gray-50">
            <button
              className="flex items-center w-full py-2 px-3 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 text-sm mt-1"
              onClick={() => navigate('/profile')}
            >
              <User size={16} className="mr-2" />
              <span>Hồ sơ cá nhân</span>
            </button>

            <button
              className="flex items-center w-full py-2 px-3 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 text-sm mt-1"
            >
              <Info size={16} className="mr-2" />
              <span>Hướng dẫn sử dụng</span>
            </button>

            <button
              className="flex items-center w-full py-2 px-3 hover:bg-red-50 rounded-lg transition-colors text-red-600 text-sm mt-2"
              onClick={handleLogout}
            >
              <LogOut size={16} className="mr-2" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          className="absolute top-3 right-3 p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Navbar */}
        <div className="bg-white border-b border-gray-200 flex items-center justify-between px-3 py-2 shadow-sm">
          <button
            className="md:hidden text-gray-600 hover:text-green-600 p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="hidden md:block"></div> {/* Spacer for desktop */}

          <div className="ml-auto flex items-center space-x-2">
            <button className="text-gray-700 hover:text-green-600 p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Settings size={18} />
            </button>
            <button className="bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 text-sm rounded-lg flex items-center transition-colors border border-green-200">
              <FileText size={16} className="mr-1.5" />
              <span className="font-medium">Tài liệu hướng dẫn</span>
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div
          className="flex-1 overflow-y-auto p-3 bg-gray-50"
          ref={chatContainerRef}
          style={{
            scrollbarWidth: 'none', /* Firefox */
            msOverflowStyle: 'none', /* IE and Edge */
          }}
        >
          <style>
            {`
              /* Hide scrollbar for Chrome, Safari and Opera */
              ::-webkit-scrollbar {
                display: none;
              }
              
              /* Markdown styles */
              .markdown-content p { margin-bottom: 0.5rem; }
              .markdown-content h1, .markdown-content h2, .markdown-content h3 { font-weight: bold; margin: 0.5rem 0; }
              .markdown-content h1 { font-size: 1.25rem; }
              .markdown-content h2 { font-size: 1.125rem; }
              .markdown-content h3 { font-size: 1rem; }
              .markdown-content ul, .markdown-content ol { padding-left: 1.5rem; margin: 0.5rem 0; }
              .markdown-content ul { list-style-type: disc; }
              .markdown-content ol { list-style-type: decimal; }
              .markdown-content table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
              .markdown-content th, .markdown-content td { border: 1px solid #e2e8f0; padding: 0.25rem 0.5rem; text-align: left; }
              .markdown-content a { color: #2563eb; text-decoration: underline; }
              .markdown-content strong { font-weight: bold; }
              .markdown-content em { font-style: italic; }
              .markdown-content code { background-color: #f1f5f9; padding: 0.1rem 0.2rem; border-radius: 0.2rem; font-size: 0.875em; }
              .markdown-content pre { background-color: #f1f5f9; padding: 0.5rem; border-radius: 0.2rem; overflow-x: auto; margin: 0.5rem 0; }
              .markdown-content blockquote { border-left: 3px solid #e2e8f0; padding-left: 0.5rem; margin: 0.5rem 0; color: #4a5568; }
            `}
          </style>
          <div className="max-w-3xl mx-auto">
            {activeChatMessages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center text-gray-500">
                <MessageSquare size={48} className="text-green-200 mb-4" />
                <h3 className="text-lg font-medium mb-2">Bắt đầu cuộc trò chuyện mới</h3>
                <p className="text-sm max-w-md">
                  Hãy nhập câu hỏi của bạn về chính sách người có công vào ô bên dưới để bắt đầu trò chuyện với CongBot.
                </p>
              </div>
            )}

            {activeChatMessages.map((message, index) => (
              <motion.div
                key={message.id || `msg_${index}_${Date.now()}`} // Đảm bảo key luôn duy nhất
                className={`mb-3 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                initial="initial"
                animate="animate"
                variants={messageVariants}
                custom={index}
              >
                {message.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex-shrink-0 mr-2 mt-1 flex items-center justify-center shadow-sm">
                    <MessageSquare size={14} className="text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 max-w-[75%] shadow-sm ${message.sender === 'user'
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                >
                  {message.sender === 'user' ? (
                    <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                  ) : (
                    <div className="text-sm markdown-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSanitize, rehypeRaw]}
                      >
                        {message.text}
                      </ReactMarkdown>

                      {message.processingTime > 0 && (
                        <div className="text-xs text-gray-400 mt-2 text-right">
                          Thời gian xử lý: {message.processingTime.toFixed(2)}s
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {message.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 ml-2 mt-1 flex items-center justify-center">
                    <User size={14} className="text-gray-600" />
                  </div>
                )}
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                className="flex justify-start mb-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex-shrink-0 mr-2 mt-1 flex items-center justify-center shadow-sm">
                  <MessageSquare size={14} className="text-white" />
                </div>
                <div className="bg-white text-gray-800 rounded-2xl px-3.5 py-2.5 max-w-[75%] border border-gray-200 shadow-sm">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-3">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSend} className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Nhập câu hỏi của bạn về chính sách người có công..."
                  className="w-full border border-gray-300 rounded-2xl py-2.5 px-3.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none shadow-sm"
                  rows={1}
                  style={{
                    minHeight: '46px',
                    maxHeight: '150px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                ></textarea>
              </div>

              <motion.button
                type="submit"
                className={`p-2.5 h-[46px] w-[46px] flex items-center justify-center rounded-full shadow-md ${input.trim() === '' || isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:shadow-lg'
                  } transition-all`}
                disabled={input.trim() === '' || isLoading}
                whileHover={{ scale: input.trim() === '' || isLoading ? 1 : 1.05 }}
                whileTap={{ scale: input.trim() === '' || isLoading ? 1 : 0.95 }}
              >
                <Send size={18} />
              </motion.button>
            </form>

            <div className="text-xs text-gray-500 mt-1.5 text-center">
              Chatbot sử dụng kỹ thuật RAG để truy xuất thông tin từ cơ sở dữ liệu pháp luật về người có công.
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatInterface;