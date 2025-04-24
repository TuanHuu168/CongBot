import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, MessageSquare, History, Info, LogOut, User, X, FileText, Search, Plus, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    fetchChatHistory,
  } = useChat();

  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [localError, setLocalError] = useState(null);
  const [textareaHeight, setTextareaHeight] = useState(46);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getDisplayTitle = (chat) => {
    if (!chat.title) return "Cuộc trò chuyện mới";
    const isIdTitle = chat.title.match(/^[0-9a-f]{24}$/i);
    return (isIdTitle || chat.title.trim() === "") ? "Cuộc trò chuyện mới" : chat.title;
  };

  // Kiểm tra xem nếu đến từ trang đăng nhập
  useEffect(() => {
    if (state?.freshLogin) {
      fetchChatHistory();
    }
  }, [state]);

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

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '46px';
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 46), 200);
      setTextareaHeight(newHeight);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

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
        chatId = await createNewChat();
        setCurrentChatId(chatId);
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
      const response = await askQuestion(userQuestion, chatId);

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

      // Xác định xem có phải tin nhắn đầu tiên không để cập nhật tiêu đề
      const isFirstMessage = activeChatMessages.length <= 2;

      if (isFirstMessage && response.id) {
        // Chuẩn bị tiêu đề mới
        const newTitle = userQuestion.length > 30
          ? userQuestion.substring(0, 30) + '...'
          : userQuestion;

        // Cập nhật tiêu đề thông qua API
        try {
          await updateChatTitle(response.id, newTitle);
        } catch (titleError) {
          console.error('Lỗi khi cập nhật tiêu đề:', titleError);
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

  // Lọc và sắp xếp lịch sử chat
  const sortedFilteredChats = [...(chatHistory?.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    chat.status === 'active'
  ) || [])].sort((a, b) =>
    new Date(b.updated_at || b.date) - new Date(a.updated_at || a.date)
  ).slice(0, 5);

  const handleNewChat = () => {
    createNewChat();
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    navigate('/login');
  };

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.3 } }
  };

  const messageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  const floatingChatVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 500, damping: 30 } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.2 } }
  };

  return (
    <motion.div
      className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-50 to-green-50"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      <style jsx>{`
        /* Hide all scrollbars */
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        *::-webkit-scrollbar {
          display: none;
        }
        
        /* Markdown styles */
        .markdown-content p { margin-bottom: 0.75rem; }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 { font-weight: bold; margin: 0.75rem 0; }
        .markdown-content h1 { font-size: 1.25rem; }
        .markdown-content h2 { font-size: 1.125rem; }
        .markdown-content h3 { font-size: 1rem; }
        .markdown-content ul, .markdown-content ol { padding-left: 1.5rem; margin: 0.75rem 0; }
        .markdown-content ul { list-style-type: disc; }
        .markdown-content ol { list-style-type: decimal; }
        .markdown-content table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
        .markdown-content th, .markdown-content td { border: 1px solid #e2e8f0; padding: 0.25rem 0.5rem; text-align: left; }
        .markdown-content a { color: #0ea5e9; text-decoration: underline; }
        .markdown-content strong { font-weight: bold; }
        .markdown-content em { font-style: italic; }
        .markdown-content code { background-color: #f1f5f9; padding: 0.1rem 0.2rem; border-radius: 0.2rem; font-size: 0.875em; }
        .markdown-content pre { background-color: #f1f5f9; padding: 0.5rem; border-radius: 0.375rem; overflow-x: auto; margin: 0.75rem 0; }
        .markdown-content blockquote { border-left: 3px solid #10b981; padding-left: 0.75rem; margin: 0.75rem 0; color: #4b5563; background-color: #f0fdf4; border-radius: 0.25rem; }
      `}</style>

      {/* Error notification */}
      <AnimatePresence>
        {localError && (
          <motion.div
            className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <span>{localError}</span>
            <button
              className="ml-3 text-red-500 hover:text-red-700"
              onClick={() => setLocalError(null)}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile overlay */}
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:z-0 md:border-r md:border-gray-200`}
      >
        <div className="flex flex-col h-full">
          {/* Header with logo and user info */}
          <div className="bg-green-600 text-white py-3 px-4">
            <div className="flex items-center mb-3">
              <button onClick={() => navigate('/')} className="flex items-center">
                <div className="h-9 w-9 bg-green-500 rounded-lg flex items-center justify-center mr-2">
                  <MessageSquare size={20} className="text-white" />
                </div>
                <h1 className="text-lg font-bold text-white">CongBot Chat</h1>
              </button>

              <div className="ml-auto flex items-center">
                <button className="text-white hover:bg-green-500 p-1.5 rounded-full transition-colors">
                  <FileText size={16} />
                </button>
                <button className="text-white hover:bg-green-500 p-1.5 rounded-full transition-colors ml-1">
                  <Settings size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center bg-green-500 rounded-lg p-2">
              <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center mr-2 overflow-hidden">
                <img src="/src/assets/images/user-icon.png" alt="User" className="w-full h-full object-cover" onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
                }} />
              </div>
              <div className="overflow-hidden">
                <p className="font-medium text-white truncate">{user?.name || 'Người dùng'}</p>
                <p className="text-xs text-white truncate">{user?.email || user?.username || 'user@example.com'}</p>
              </div>
            </div>
          </div>

          {/* New chat button and search */}
          <div className="p-3">
            <button
              onClick={handleNewChat}
              className="flex items-center w-full py-2.5 px-3.5 bg-green-600 hover:bg-green-700 text-white rounded-lg mb-3 transition-colors duration-200 shadow-sm"
            >
              <Plus size={18} className="mr-2" />
              <span className="font-medium">Cuộc trò chuyện mới</span>
            </button>

            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Tìm kiếm cuộc trò chuyện..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2.5 pl-9 pr-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Chat history */}
          <div className="px-3 flex-1 overflow-y-auto">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <History size={16} className="mr-2 text-green-600" />
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
                <div className="space-y-1.5">
                  {sortedFilteredChats.map((chat) => (
                    <button
                      key={chat.id}
                      className={`flex items-center w-full py-2.5 px-3.5 rounded-lg transition-all duration-200 ${currentChatId === chat.id
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
                <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-lg">
                  {searchQuery
                    ? "Không tìm thấy cuộc trò chuyện nào"
                    : isLoading ? "Đang tải..." : "Chưa có lịch sử trò chuyện"}
                </div>
              )}
            </div>
          </div>

          {/* Bottom menu */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
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
          className="absolute top-3 right-3 p-1.5 rounded-full bg-white bg-opacity-20 text-white hover:bg-white hover:bg-opacity-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile menu button */}
        <button
          className="fixed top-4 left-4 z-30 md:hidden bg-white p-2 rounded-full shadow-lg text-green-600 hover:bg-green-50 transition-colors"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu size={24} />
        </button>

        {/* Chat Area */}
        <div
          className="flex-1 overflow-y-auto p-4 pb-20 bg-transparent"
          ref={chatContainerRef}
        >
          <div className="max-w-3xl mx-auto pt-12 md:pt-4">
            {activeChatMessages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center text-gray-600">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg">
                  <MessageSquare size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-medium mb-3">Bắt đầu cuộc trò chuyện mới</h3>
                <p className="text-sm max-w-md opacity-80">
                  Hãy nhập câu hỏi của bạn về chính sách người có công vào ô bên dưới để bắt đầu trò chuyện với CongBot.
                </p>
              </div>
            )}

            <AnimatePresence>
              {activeChatMessages.map((message, index) => (
                <motion.div
                  key={message.id || `msg_${index}_${Date.now()}`}
                  className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  variants={messageVariants}
                  initial="initial"
                  animate="animate"
                  exit="initial"
                >
                  {message.sender === 'bot' && (
                    <div className="w-10 h-10 rounded-full flex-shrink-0 mr-2 overflow-hidden shadow-md">
                      <img
                        src="/src/assets/images/chatbot-icon.png"
                        alt="Bot"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2310b981' viewBox='0 0 24 24'%3E%3Cpath d='M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zM6.023 15.416C7.491 17.606 9.695 19 12.16 19c2.464 0 4.669-1.393 6.136-3.584A8.968 8.968 0 0120 12.16c0-2.465-1.393-4.669-3.584-6.136A8.968 8.968 0 0112.16 4c-2.465 0-4.67 1.393-6.137 3.584A8.968 8.968 0 014 12.16c0 1.403.453 2.75 1.254 3.876l-.001.001c.244.349.477.685.77 1.379zM8 13a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2zm-4-3a1 1 0 110-2 1 1 0 010 2zm0 6a1 1 0 110-2 1 1 0 010 2z'/%3E%3C/svg%3E";
                        }}
                      />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 max-w-[80%] ${message.sender === 'user'
                      ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-md'
                      : 'bg-white text-gray-800 border border-gray-100 shadow-md'
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
                    <div className="w-10 h-10 rounded-full flex-shrink-0 ml-2 overflow-hidden shadow-md">
                      <img
                        src="/src/assets/images/user-icon.png"
                        alt="User"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23374151'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
                        }}
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading animation */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  className="flex justify-start mb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="w-10 h-10 rounded-full flex-shrink-0 mr-2 overflow-hidden shadow-md">
                    <img
                      src="/src/assets/images/chatbot-icon.png"
                      alt="Bot"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2310b981' viewBox='0 0 24 24'%3E%3Cpath d='M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zM6.023 15.416C7.491 17.606 9.695 19 12.16 19c2.464 0 4.669-1.393 6.136-3.584A8.968 8.968 0 0120 12.16c0-2.465-1.393-4.669-3.584-6.136A8.968 8.968 0 0112.16 4c-2.465 0-4.67 1.393-6.137 3.584A8.968 8.968 0 014 12.16c0 1.403.453 2.75 1.254 3.876l-.001.001c.244.349.477.685.77 1.379zM8 13a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2zm-4-3a1 1 0 110-2 1 1 0 010 2zm0 6a1 1 0 110-2 1 1 0 010 2z'/%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  <div className="bg-white text-gray-800 rounded-2xl px-4 py-3.5 border border-gray-100 shadow-md">
                    <div className="flex space-x-2">
                      <div className="w-2.5 h-2.5 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Floating Chat Input */}
        <motion.div
          className="fixed bottom-0 left-0 right-0 md:left-72"
          variants={floatingChatVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="max-w-3xl mx-auto px-4 pb-6">
            <div className="bg-white rounded-[20px] shadow-xl border border-gray-100 p-1.5 overflow-hidden">
              <form onSubmit={handleSend} className="flex items-center">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Nhập câu hỏi của bạn về chính sách người có công..."
                    className="w-full border border-gray-200 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none text-sm rounded-[20px] my-1 py-3.5 px-3 resize-none transition-all duration-200"
                    style={{
                      height: `${textareaHeight}px`,
                      maxHeight: '200px',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                  ></textarea>
                </div>

                <div className="sflex items-center ml-2">
                  <motion.button
                    type="submit"
                    className={`p-2.5 h-[46px] min-w-[46px] flex items-center justify-center rounded-full ${input.trim() === '' || isLoading
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:shadow-md'
                      } transition-all`}
                    disabled={input.trim() === '' || isLoading}
                    whileHover={{ scale: input.trim() === '' || isLoading ? 1 : 1.05 }}
                    whileTap={{ scale: input.trim() === '' || isLoading ? 1 : 0.95 }}
                  >
                    <Send size={18} />
                  </motion.button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ChatInterface;