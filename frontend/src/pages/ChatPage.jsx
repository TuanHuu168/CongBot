import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Menu, MessageSquare, History, LogOut, User, X, Search, Plus, ChevronDown, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChat } from '../ChatContext';
import { askQuestion, updateChatTitle } from '../apiService';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import Swal from 'sweetalert2';

const ChatPage = () => {
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
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [formKey, setFormKey] = useState(Date.now()); // Thêm key để buộc render lại form

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);
  const userDropdownRef = useRef(null);
  const sendButtonRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getDisplayTitle = (chat) => {
    if (!chat || !chat.title) return "Cuộc trò chuyện mới";
    const isIdTitle = chat.title.match(/^[0-9a-f]{24}$/i);
    return (isIdTitle || chat.title.trim() === "") ? "Cuộc trò chuyện mới" : chat.title;
  };

  // Lấy tiêu đề cuộc trò chuyện hiện tại
  const getCurrentChatTitle = () => {
    if (!currentChatId || !chatHistory) return "Cuộc trò chuyện mới";
    const currentChat = chatHistory.find(chat => chat.id === currentChatId);
    return getDisplayTitle(currentChat);
  };

  // Kiểm tra xem nếu đến từ trang đăng nhập
  useEffect(() => {
    if (state?.freshLogin) {
      fetchChatHistory();
    }

    // Kiểm tra nếu có suggested question từ ProfilePage
    if (state?.suggestedQuestion) {
      setInput(state.suggestedQuestion);
    }
  }, [state]);

  useEffect(() => {
    scrollToBottom();
  }, [activeChatMessages]);

  // Thêm debounce cho resize event
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      if (!isMobileView) {
        setIsSidebarOpen(false);
      }
    };

    // Debounce để giảm số lần gọi hàm
    let timeoutId;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Auto-adjust textarea height - FIX
  const adjustTextareaHeight = useCallback(() => {
    if (!textareaRef.current) return;

    // Đặt lại chiều cao về mặc định khi input rỗng
    if (input === '') {
      textareaRef.current.style.height = '50px';
      setTextareaHeight(50);
      return;
    }

    // Reset height to calculate proper scrollHeight
    textareaRef.current.style.height = '50px';

    // Calculate new height (min 50px, max 200px)
    const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 50), 200);

    // Set new height
    textareaRef.current.style.height = `${newHeight}px`;
    setTextareaHeight(newHeight);
  }, [input]);

  // Update textarea height when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Focus textarea when needed
  useEffect(() => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  }, [isMobile, currentChatId]);

  // Xử lý click bên ngoài dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Xử lý input change với debounce
  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  // Tách hàm xử lý gửi tin nhắn
  const prepareAndSendMessage = async (userQuestion) => {
    if (userQuestion.trim() === '' || isLoading) return;

    try {
      setIsLoading(true);
      setLocalError(null);

      // Đóng sidebar trên mobile
      if (isMobile) {
        setIsSidebarOpen(false);
      }

      let chatId = currentChatId;

      // Tạo chat mới nếu cần
      if (!chatId) {
        try {
          const newChatResult = await createNewChat();
          chatId = newChatResult.id;
          setCurrentChatId(chatId);
        } catch (error) {
          console.error('Error creating new chat:', error);
          setLocalError("Không thể tạo cuộc trò chuyện mới. Vui lòng thử lại.");
          setIsLoading(false);
          return;
        }
      }

      // Thêm tin nhắn user vào UI ngay lập tức
      const userMessageId = `user_${Date.now()}`;
      setActiveChatMessages(prev => [...prev, {
        id: userMessageId,
        sender: 'user',
        text: userQuestion,
        timestamp: new Date().toISOString()
      }]);

      // Gọi API với retry logic
      let retryCount = 0;
      let response = null;

      while (retryCount < 3) {
        try {
          response = await askQuestion(userQuestion, chatId);
          break; // Nếu thành công thì thoát loop
        } catch (error) {
          retryCount++;
          if (retryCount >= 3) {
            // Hết số lần retry -> fail
            throw error;
          }
          // Đợi trước khi retry (backoff tăng dần)
          await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
        }
      }

      if (!response) {
        throw new Error("Không thể kết nối đến máy chủ sau nhiều lần thử");
      }

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
        const newTitle = userQuestion.length > 30
          ? userQuestion.substring(0, 30) + '...'
          : userQuestion;

        try {
          await updateChatTitle(response.id, newTitle);
          // Refetch chat history (sử dụng setTimeout để tránh block UI)
          setTimeout(() => fetchChatHistory(), 100);
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
      scrollToBottom();
    }
  };

  // Xử lý form submit
  const handleSend = (e) => {
    e.preventDefault();

    const messageText = input.trim();
    if (messageText === '' || isLoading) return;

    // Lưu lại tin nhắn trước khi xóa input
    const messageToSend = messageText;
    setInput('');
    setFormKey(Date.now()); // Đổi key để buộc render lại form

    // Gửi tin nhắn bất đồng bộ
    prepareAndSendMessage(messageToSend);
  };

  // Xử lý phím Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() !== '' && !isLoading) {
        handleSend(e);
      }
    }
  };

  // Lọc và sắp xếp lịch sử chat
  const sortedFilteredChats = React.useMemo(() => {
    if (!chatHistory) return [];

    return [...chatHistory]
      .filter(chat =>
        (chat.title?.toLowerCase().includes(searchQuery.toLowerCase()) || '') &&
        chat.status === 'active'
      )
      .sort((a, b) =>
        new Date(b.updated_at || b.date) - new Date(a.updated_at || a.date)
      )
      .slice(0, 5);
  }, [chatHistory, searchQuery]);

  const handleNewChat = async () => {
    try {
      await createNewChat();
      if (isMobile) {
        setIsSidebarOpen(false);
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      setLocalError("Không thể tạo cuộc trò chuyện mới");
    }
  };

  const handleLogout = () => {
    Swal.fire({
      title: 'Đăng xuất',
      text: 'Bạn có chắc chắn muốn đăng xuất?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('user_id');
        navigate('/login');
      }
    });
  };

  const toggleUserDropdown = () => {
    setShowUserDropdown(!showUserDropdown);
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
      className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50"
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
      <AnimatePresence mode="sync">
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

      {/* Unified Top Navbar */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-md">
        <div className="flex justify-between items-center px-5 py-3">
          {/* Left Section - Logo and menu button */}
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              className="md:hidden mr-3 text-white"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>

            {/* Logo */}
            <button onClick={() => navigate('/')} className="flex items-center">
              <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center mr-2 backdrop-blur-sm">
                <MessageSquare size={20} className="text-white" />
              </div>
              <h1 className="text-lg font-bold text-white">CongBot</h1>
            </button>
          </div>

          {/* Center - Current chat title */}
          <div className="flex-1 text-center mx-4">
            <h1 className="text-lg font-semibold text-white truncate max-w-xs mx-auto">
              {getCurrentChatTitle()}
            </h1>
          </div>

          {/* Right - User profile dropdown */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={toggleUserDropdown}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg py-1.5 px-3 backdrop-blur-sm"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-white/20">
                {user?.avatar ? (
                  <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <User size={16} className="text-white" />
                )}
              </div>
              <span className="text-sm font-medium text-white hidden sm:inline">
                {user?.name || 'Người dùng'}
              </span>
              <ChevronDown size={16} className={`text-white/80 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            <AnimatePresence mode="sync">
              {showUserDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 z-50"
                >
                  <button
                    className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setShowUserDropdown(false);
                      navigate('/profile');
                    }}
                  >
                    <User size={16} className="mr-2 text-gray-500" />
                    <span>Hồ sơ cá nhân</span>
                  </button>
                  <button
                    className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setShowUserDropdown(false);
                      navigate('/history');
                    }}
                  >
                    <History size={16} className="mr-2 text-gray-500" />
                    <span>Lịch sử trò chuyện</span>
                  </button>
                  <button
                    className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100 mt-1"
                    onClick={() => {
                      setShowUserDropdown(false);
                      handleLogout();
                    }}
                  >
                    <LogOut size={16} className="mr-2" />
                    <span>Đăng xuất</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-white shadow-xl transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:z-10 md:mt-[73px] md:h-[calc(100vh-73px)]`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile - Header */}
          <div className="md:hidden bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 px-4">
            <div className="flex items-center justify-between">
              <button onClick={() => navigate('/')} className="flex items-center">
                <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center mr-2 backdrop-blur-sm">
                  <MessageSquare size={20} className="text-white" />
                </div>
                <h1 className="text-lg font-bold text-white">CongBot</h1>
              </button>

              {/* Close button */}
              <button
                className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* New chat button and search */}
          <div className="p-4">
            <button
              onClick={handleNewChat}
              className="flex items-center justify-center w-full py-2.5 px-3.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg mb-4 transition-colors duration-200 shadow-sm hover:opacity-90"
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
                className="w-full py-2.5 pl-9 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
              />
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Chat history */}
          <div className="px-4 flex-1 overflow-y-auto">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-3">
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
                <div className="space-y-2">
                  {sortedFilteredChats.map((chat) => (
                    <button
                      key={chat.id}
                      className={`flex items-center w-full py-2.5 px-3.5 rounded-lg transition-all duration-200 ${currentChatId === chat.id
                        ? 'bg-green-50 text-green-700 border-l-4 border-green-600 shadow-sm'
                        : 'hover:bg-gray-50 text-gray-700'
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
                <div className="text-center py-10 text-gray-500 text-sm bg-gray-50 rounded-xl">
                  {searchQuery
                    ? "Không tìm thấy cuộc trò chuyện nào"
                    : isLoading ? "Đang tải..." : "Chưa có lịch sử trò chuyện"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Chat Area */}
        <div
          className="flex-1 overflow-y-auto p-4 pb-20 bg-transparent mt-[73px]"
          ref={chatContainerRef}
        >
          <div className="max-w-3xl mx-auto">
            {activeChatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-280px)] text-center text-gray-600">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg">
                  <MessageSquare size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-medium mb-3">Bắt đầu cuộc trò chuyện mới</h3>
                <p className="text-sm max-w-md opacity-80">
                  Hãy nhập câu hỏi của bạn về chính sách người có công vào ô bên dưới để bắt đầu trò chuyện với CongBot.
                </p>
              </div>
            ) : (
              <div>
                {activeChatMessages.map((message, index) => (
                  <motion.div
                    key={message.id || `msg_${index}`}
                    className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    variants={messageVariants}
                    initial="initial"
                    animate="animate"
                  >
                    {message.sender === 'bot' && (
                      <div className="w-10 h-10 rounded-full flex-shrink-0 mr-2 overflow-hidden shadow-md">
                        <img
                          src="/src/assets/images/chatbot-icon.png"
                          alt="Bot"
                          className="w-full h-full object-cover"
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
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Loading animation - Only show when isLoading is true AND we have messages */}
            {isLoading && activeChatMessages.length > 0 && (
              <div className="flex justify-start mb-4">
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
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Floating Chat Input */}
        <div className="fixed bottom-0 left-0 right-0 md:left-72">
          <div className="max-w-3xl mx-auto px-4 pb-6">
            <div className="bg-white rounded-[20px] shadow-xl border border-gray-100 p-1.5 overflow-hidden">
              <form key={formKey} onSubmit={handleSend} className="flex items-center">
                <div className="flex-1 relative">
                  {/* Improved textarea handling */}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhập câu hỏi của bạn về chính sách người có công..."
                    className="w-full border border-gray-200 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none text-sm rounded-[20px] my-1 py-3.5 px-3 resize-none transition-all duration-200"
                    style={{
                      height: `${textareaHeight}px`,
                      minHeight: '50px',
                      maxHeight: '200px'
                    }}
                  ></textarea>
                </div>

                <div className="flex items-center ml-2">
                  <button
                    ref={sendButtonRef}
                    type="submit"
                    disabled={input.trim() === '' || isLoading}
                    className={`p-2.5 h-[46px] min-w-[46px] flex items-center justify-center rounded-full transition-all duration-200 ${input.trim() === '' || isLoading
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:shadow-md'
                      }`}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatPage;