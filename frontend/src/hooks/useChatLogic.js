import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChat } from '../ChatContext';
import { askQuestion, updateChatTitle } from '../apiService';
import { getAuthData, showError } from '../utils/formatUtils';

export const useChatLogic = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;

  const {
    user, chatHistory, isLoading, setIsLoading, activeChatMessages, setActiveChatMessages,
    currentChatId, setCurrentChatId, createNewChat, switchChat, fetchChatHistory,
    fetchUserInfo, resetAuthState
  } = useChat();

  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [localError, setLocalError] = useState(null);
  const [textareaHeight, setTextareaHeight] = useState(46);
  const [formKey, setFormKey] = useState(Date.now());

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { token, userId } = getAuthData();
      
      if (!token || !userId) {
        resetAuthState();
        navigate('/login');
        return;
      }

      if (!user && userId) {
        try {
          await fetchUserInfo(userId);
        } catch (error) {
          console.error('Lỗi khi tải thông tin user:', error);
        }
      }
    };

    checkAuth();
    
    const interval = setInterval(() => {
      const { token, userId } = getAuthData();
      if (!token || !userId) {
        resetAuthState();
        navigate('/login');
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [user, fetchUserInfo, resetAuthState, navigate]);

  // Handle initial state
  useEffect(() => {
    if (state?.freshLogin) fetchChatHistory();
    if (state?.suggestedQuestion) setInput(state.suggestedQuestion);
    if (!state?.chatId && !state?.freshLogin) {
      setCurrentChatId(null);
      setActiveChatMessages([]);
    }
  }, [state, fetchChatHistory, setCurrentChatId, setActiveChatMessages]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages]);

  // Responsive handling
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

  // Textarea height adjustment
  const adjustTextareaHeight = useCallback(() => {
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
  }, [input]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  useEffect(() => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  }, [isMobile, currentChatId]);

  // Message handling
  const prepareAndSendMessage = async (userQuestion) => {
    if (userQuestion.trim() === '' || isLoading) return;

    try {
      setIsLoading(true);
      setLocalError(null);

      if (isMobile) setIsSidebarOpen(false);

      let chatId = currentChatId;

      if (!chatId) {
        try {
          const newChatResult = await createNewChat();
          chatId = newChatResult.id;
          setCurrentChatId(chatId);
        } catch (error) {
          console.error('Lỗi tạo chat mới:', error);
          setLocalError("Không thể tạo cuộc trò chuyện mới. Vui lòng thử lại.");
          setIsLoading(false);
          return;
        }
      }

      const userMessageId = `user_${Date.now()}`;
      setActiveChatMessages(prev => [...prev, {
        id: userMessageId,
        sender: 'user',
        text: userQuestion,
        timestamp: new Date().toISOString()
      }]);

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

      const botMessageId = `bot_${Date.now()}`;
      setActiveChatMessages(prev => [...prev, {
        id: botMessageId,
        sender: 'bot',
        text: response.answer,
        timestamp: new Date().toISOString(),
        processingTime: response.total_time || 0,
        context: response.top_chunks || []
      }]);

      const isFirstMessage = activeChatMessages.length <= 2;

      if (isFirstMessage && response.id) {
        const newTitle = userQuestion.length > 30
          ? userQuestion.substring(0, 30) + '...'
          : userQuestion;

        try {
          await updateChatTitle(response.id, newTitle);
          setTimeout(() => fetchChatHistory(), 100);
        } catch (titleError) {
          console.error('Lỗi khi cập nhật tiêu đề:', titleError);
        }
      }

    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn:', error);
      setLocalError(error.detail || 'Có lỗi khi kết nối với máy chủ');

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

  const handleSend = (e) => {
    e.preventDefault();
    const messageText = input.trim();
    if (messageText === '' || isLoading) return;

    const messageToSend = messageText;
    setInput('');
    setFormKey(Date.now());
    prepareAndSendMessage(messageToSend);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() !== '' && !isLoading) {
        handleSend(e);
      }
    }
  };

  const handleNewChat = async () => {
    try {
      await createNewChat();
      if (isMobile) setIsSidebarOpen(false);
    } catch (error) {
      console.error('Lỗi tạo chat mới:', error);
      setLocalError("Không thể tạo cuộc trò chuyện mới");
    }
  };

  const getCurrentChatTitle = () => {
    if (!currentChatId || !chatHistory) return "Cuộc trò chuyện mới";
    const currentChat = chatHistory.find(chat => chat.id === currentChatId);
    const title = currentChat?.title;
    if (!title || title.trim() === '') return "Cuộc trò chuyện mới";
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(title);
    return isMongoId ? "Cuộc trò chuyện mới" : title;
  };

  return {
    // State
    input, setInput, isSidebarOpen, setIsSidebarOpen, searchQuery, setSearchQuery,
    isMobile, localError, setLocalError, textareaHeight, formKey,
    
    // Refs
    messagesEndRef, textareaRef, chatContainerRef,
    
    // Data
    user, chatHistory, activeChatMessages, currentChatId, isLoading,
    
    // Functions
    handleSend, handleKeyDown, handleNewChat, switchChat, getCurrentChatTitle,
    fetchChatHistory,
    
    // Utils
    handleInputChange: (e) => setInput(e.target.value)
  };
};