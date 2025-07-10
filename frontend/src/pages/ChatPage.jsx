import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChat } from '../ChatContext';
import { askQuestion, updateChatTitle } from '../apiService';
import { getAuthData, showError, getDisplayTitle, pageVariants } from '../utils/formatUtils';
import TopNavBar from '../components/common/TopNavBar';
import ChatSidebar from '../components/chat/ChatSidebar';
import MessageItem from '../components/chat/MessageItem';
import ErrorMessage from '../components/common/ErrorMessage';

const ChatPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;

  // Hook chat context để quản lý state chat toàn cục
  const {
    user, chatHistory, isLoading, setIsLoading, activeChatMessages, setActiveChatMessages,
    currentChatId, setCurrentChatId, createNewChat, switchChat, fetchChatHistory,
    fetchUserInfo, resetAuthState
  } = useChat();

  // State quản lý UI và input
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [localError, setLocalError] = useState(null);
  const [textareaHeight, setTextareaHeight] = useState(46);
  const [formKey, setFormKey] = useState(Date.now());
  const [authChecked, setAuthChecked] = useState(false);

  // Các ref để điều khiển DOM elements
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Kiểm tra xác thực và tải thông tin người dùng khi component mount
  useEffect(() => {
    const checkAuthAndLoadUser = async () => {
      console.log('ChatPage: Kiểm tra xác thực và tải thông tin người dùng');
      const { token, userId } = getAuthData();
      
      if (!token || !userId) {
        console.log('Không có token hoặc userId, chuyển hướng đến trang đăng nhập');
        resetAuthState();
        navigate('/login');
        return;
      }

      setAuthChecked(true);

      // Nếu chưa có user hoặc thông tin user chưa đầy đủ, tải lại
      if (!user || !user.name || user.name === 'Người dùng') {
        console.log('Thông tin người dùng chưa đầy đủ, đang tải lại');
        try {
          await fetchUserInfo(userId, true);
        } catch (error) {
          console.error('Lỗi khi tải thông tin người dùng:', error);
        }
      }
    };

    checkAuthAndLoadUser();
  }, []);

  // Xử lý state từ navigation (fresh login, suggested question, etc.)
  useEffect(() => {
    if (!authChecked) return;

    if (state?.freshLogin) {
      console.log('Phát hiện đăng nhập mới, tải lịch sử chat');
      fetchChatHistory();
    }
    
    if (state?.suggestedQuestion) {
      setInput(state.suggestedQuestion);
    }
    
    if (!state?.chatId && !state?.freshLogin) {
      setCurrentChatId(null);
      setActiveChatMessages([]);
    }
  }, [state, authChecked, fetchChatHistory, setCurrentChatId, setActiveChatMessages]);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages]);

  // Xử lý responsive design
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      if (!isMobileView) setIsSidebarOpen(false);
    };

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

  // Điều chỉnh chiều cao textarea theo nội dung
  useEffect(() => {
    const adjustTextareaHeight = () => {
      if (!textareaRef.current) return;
      if (input === '') {
        textareaRef.current.style.height = '50px';
        setTextareaHeight(50);
        return;
      }
      textareaRef.current.style.height = '50px';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 50), 200);
      textareaRef.current.style.height = `${newHeight}px`;
      setTextareaHeight(newHeight);
    };

    adjustTextareaHeight();
  }, [input]);

  // Tự động focus vào textarea trên desktop
  useEffect(() => {
    if (textareaRef.current && !isMobile && authChecked) {
      textareaRef.current.focus();
    }
  }, [isMobile, authChecked]);

  // Kiểm tra xác thực định kỳ để đảm bảo session vẫn hợp lệ
  useEffect(() => {
    const authInterval = setInterval(() => {
      const { token, userId } = getAuthData();
      if (!token || !userId) {
        console.log('Phiên đăng nhập đã hết hạn, chuyển hướng đến trang đăng nhập');
        resetAuthState();
        navigate('/login');
      }
    }, 30000); // Kiểm tra mỗi 30 giây

    return () => clearInterval(authInterval);
  }, [resetAuthState, navigate]);

  // Chuẩn bị và gửi tin nhắn với xử lý lỗi và retry logic
  const prepareAndSendMessage = async (userQuestion) => {
    if (userQuestion.trim() === '' || isLoading) return;

    try {
      setIsLoading(true);
      setLocalError(null);
      if (isMobile) setIsSidebarOpen(false);

      let chatId = currentChatId;
      // Tạo chat mới nếu chưa có
      if (!chatId) {
        try {
          const newChatResult = await createNewChat();
          chatId = newChatResult.id;
          setCurrentChatId(chatId);
        } catch (error) {
          console.error('Lỗi khi tạo cuộc trò chuyện mới:', error);
          setLocalError("Không thể tạo cuộc trò chuyện mới. Vui lòng thử lại.");
          setIsLoading(false);
          return;
        }
      }

      // Thêm tin nhắn người dùng vào giao diện ngay lập tức
      setActiveChatMessages(prev => [...prev, {
        id: `user_${Date.now()}`,
        sender: 'user',
        text: userQuestion,
        timestamp: new Date().toISOString()
      }]);

      // Thử gửi request với retry logic
      let retryCount = 0;
      let response = null;
      while (retryCount < 3) {
        try {
          response = await askQuestion(userQuestion, chatId);
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= 3) throw error;
          await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
        }
      }

      if (!response) {
        throw new Error("Không thể kết nối đến máy chủ sau nhiều lần thử");
      }

      // Thêm phản hồi của bot vào giao diện
      setActiveChatMessages(prev => [...prev, {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: response.answer,
        timestamp: new Date().toISOString(),
        processingTime: response.total_time || 0,
        context: response.top_chunks || []
      }]);

      // Cập nhật tiêu đề chat nếu đây là tin nhắn đầu tiên
      const isFirstMessage = activeChatMessages.length <= 2;
      if (isFirstMessage && response.id) {
        const newTitle = userQuestion.length > 30
          ? userQuestion.substring(0, 30) + '...'
          : userQuestion;
        try {
          await updateChatTitle(response.id, newTitle);
          setTimeout(() => fetchChatHistory(), 100);
        } catch (titleError) {
          console.error('Lỗi khi cập nhật tiêu đề cuộc trò chuyện:', titleError);
        }
      }
    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn:', error);
      setLocalError(error.detail || 'Có lỗi khi kết nối với máy chủ');
      // Thêm tin nhắn lỗi vào giao diện
      setActiveChatMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        sender: 'bot',
        text: 'Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
        timestamp: new Date().toISOString()
      }]);
      showError(error.detail || 'Có lỗi khi kết nối với máy chủ. Vui lòng thử lại sau.', 'Lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý gửi tin nhắn từ form
  const handleSend = (e) => {
    e.preventDefault();
    const messageText = input.trim();
    if (messageText === '' || isLoading) return;
    const messageToSend = messageText;
    setInput('');
    setFormKey(Date.now());
    prepareAndSendMessage(messageToSend);
  };

  // Xử lý phím tắt Enter để gửi tin nhắn
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() !== '' && !isLoading) {
        handleSend(e);
      }
    }
  };

  // Xử lý tạo cuộc trò chuyện mới
  const handleNewChat = async () => {
    try {
      await createNewChat();
      if (isMobile) setIsSidebarOpen(false);
    } catch (error) {
      console.error('Lỗi khi tạo cuộc trò chuyện mới:', error);
      setLocalError("Không thể tạo cuộc trò chuyện mới");
    }
  };

  // Lấy tiêu đề cuộc trò chuyện hiện tại
  const getCurrentChatTitle = () => {
    if (!currentChatId || !chatHistory) return "Cuộc trò chuyện mới";
    const currentChat = chatHistory.find(chat => chat.id === currentChatId);
    const title = currentChat?.title;
    if (!title || title.trim() === '') return "Cuộc trò chuyện mới";
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(title);
    return isMongoId ? "Cuộc trò chuyện mới" : title;
  };

  // Hiển thị loading khi đang kiểm tra xác thực
  if (!authChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang kiểm tra thông tin đăng nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* CSS styles cho markdown content */}
      <style jsx>{`
        * { scrollbar-width: none; -ms-overflow-style: none; }
        *::-webkit-scrollbar { display: none; }
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

      {/* Hiển thị thông báo lỗi nếu có */}
      <AnimatePresence mode="sync">
        {localError && <ErrorMessage message={localError} onClose={() => setLocalError(null)} />}
      </AnimatePresence>

      <div className="flex flex-col w-full h-full">
        {/* Header với thanh điều hướng */}
        <div className="flex-shrink-0">
          <TopNavBar
            title={getCurrentChatTitle()}
            user={user}
            onMenuClick={() => setIsSidebarOpen(true)}
            variant="chat"
          />
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          {/* Sidebar chứa lịch sử chat */}
          <ChatSidebar
            isMobile={isMobile}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            chatHistory={chatHistory}
            currentChatId={currentChatId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            switchChat={switchChat}
            handleNewChat={handleNewChat}
            getDisplayTitle={getDisplayTitle}
            fetchChatHistory={fetchChatHistory}
          />

          {/* Overlay cho mobile khi sidebar mở */}
          {isSidebarOpen && isMobile && (
            <div
              className="fixed inset-0 bg-white/10 backdrop-blur-md z-45 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Khu vực nội dung chat chính */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Khu vực hiển thị tin nhắn */}
            <div
              className="flex-1 overflow-y-auto p-4 pb-32 bg-transparent"
              ref={chatContainerRef}
              style={{ paddingTop: '1rem' }}
            >
              <div className="max-w-3xl mx-auto">
                {/* Hiển thị giao diện welcome khi chưa có tin nhắn */}
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
                  /* Hiển thị danh sách tin nhắn */
                  <div>
                    {activeChatMessages.map((message, index) => (
                      <MessageItem 
                        key={message.id || `msg_${index}`} 
                        message={message} 
                      />
                    ))}
                  </div>
                )}

                {/* Hiển thị indicator khi bot đang typing */}
                {isLoading && activeChatMessages.length > 0 && (
                  <div className="flex justify-start mb-4">
                    <div className="w-10 h-10 rounded-full flex-shrink-0 mr-2 overflow-hidden shadow-md">
                      <img
                        src="/src/assets/images/chatbot-icon.png"
                        alt="Bot"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2310b981' viewBox='0 0 24 24'%3E%3Cpath d='M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z'/%3E%3C/svg%3E";
                        }}
                      />
                    </div>
                    <div className="bg-white text-gray-800 rounded-2xl px-4 py-3.5 border border-gray-100 shadow-md">
                      <div className="flex space-x-2">
                        {[0, 200, 400].map((delay, i) => (
                          <div key={i} className="w-2.5 h-2.5 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }}></div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>

            {/* Khu vực input cố định ở dưới cùng */}
            <div className="fixed bottom-0 left-0 right-0 md:left-72 z-40">
              <div className="max-w-3xl mx-auto px-4 py-4 bg-gradient-to-t from-green-50 via-teal-50 to-transparent">
                <div className="bg-white rounded-[20px] shadow-xl border border-gray-100 p-1.5 overflow-hidden">
                  <form key={formKey} onSubmit={handleSend} className="flex items-center">
                    {/* Textarea để nhập tin nhắn */}
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập câu hỏi của bạn..."
                        className="w-full border border-gray-200 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none text-sm rounded-[20px] my-1 py-3.5 px-3 resize-none transition-all duration-200"
                        style={{
                          height: `${textareaHeight}px`,
                          minHeight: '50px',
                          maxHeight: '200px'
                        }}
                      ></textarea>
                    </div>

                    {/* Nút gửi tin nhắn */}
                    <div className="flex items-center ml-2">
                      <button
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
        </div>
      </div>
    </motion.div>
  );
};

export default ChatPage;