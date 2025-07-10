import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { chatAPI, userAPI } from './apiService';
import { getAuthData } from './utils/formatUtils';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat phải được sử dụng trong ChatProvider');
  return context;
};

export const ChatProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeChatMessages, setActiveChatMessages] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const resetAuthState = useCallback(() => {
    console.log('Đặt lại trạng thái xác thực');
    setUser(null);
    setChatHistory([]);
    setActiveChatMessages([]);
    setCurrentChatId(null);
    setIsLoading(false);
    setError(null);
    setUserLoaded(false);
  }, []);

  const fetchUserInfo = useCallback(async (userId, forceRefresh = false) => {
    if (!userId) {
      console.log('Không có userId để tải thông tin');
      return null;
    }

    if (userLoaded && !forceRefresh && user) {
      console.log('Thông tin user đã được tải, không tải lại');
      return user;
    }

    try {
      console.log(`Bắt đầu tải thông tin user cho userId: ${userId}`);
      setIsLoading(true);

      const response = await userAPI.getInfo(userId);

      // Xử lý cả 2 trường hợp: response trực tiếp hoặc trong user object
      let userInfo;
      if (response.user) {
        // Nếu response có nằm trong user object
        userInfo = response.user;
      } else {
        // Nếu response là user data trực tiếp  
        userInfo = response;
      }

      // Mapping dữ liệu user
      const userData = {
        id: userInfo.id || userId,
        username: userInfo.username || '',
        email: userInfo.email || '',
        fullName: userInfo.fullName || '',
        phoneNumber: userInfo.phoneNumber || '',
        role: userInfo.role || 'user',
        status: userInfo.status || 'active',
        // Các field khác nếu có
        avatarUrl: userInfo.avatarUrl || userInfo.avatar_url || '',
        personalInfo: userInfo.personalInfo || userInfo.personal_info || '',
        // Tạo name field cho TopNavBar
        name: userInfo.fullName || userInfo.username || 'Người dùng'
      };

      // Set thông tin người dùng
      setUser({ ...userData });
      setUserLoaded(true);
      setError(null);

      return userData;
    } catch (error) {
      console.error('Lỗi khi tải thông tin người dùng:', error);
      setError('Không thể tải thông tin người dùng');
      setUserLoaded(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchChatHistory = useCallback(async (retries = 3) => {
    try {
      setIsLoading(true);
      const chats = await chatAPI.getAll();
      const formattedChats = chats.map(chat => ({
        id: chat.id,
        title: chat.title || "Cuộc trò chuyện mới",
        date: new Date(chat.created_at).toLocaleDateString('vi-VN'),
        updated_at: chat.updated_at || chat.created_at,
        time: new Date(chat.updated_at || chat.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        status: 'active'
      }));
      setChatHistory(formattedChats);
      return formattedChats;
    } catch (error) {
      console.error('Lỗi khi tải lịch sử trò chuyện:', error);
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchChatHistory(retries - 1);
      }
      setError('Không thể tải lịch sử trò chuyện');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNewChat = useCallback(async (title = 'Cuộc trò chuyện mới') => {
    try {
      setIsLoading(true);
      const { userId } = getAuthData();
      if (!userId) throw new Error('Bạn cần đăng nhập để tạo cuộc trò chuyện');

      const response = await chatAPI.create(title);
      const newChatId = response.id;

      const newChat = {
        id: newChatId, 
        title,
        date: new Date().toLocaleDateString('vi-VN'),
        updated_at: new Date().toISOString(),
        status: 'active'
      };

      setChatHistory(prev => [newChat, ...prev]);
      setCurrentChatId(newChatId);
      setActiveChatMessages([]);
      return { id: newChatId };
    } catch (error) {
      console.error('Lỗi khi tạo cuộc trò chuyện:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchChat = useCallback(async (chatId, retries = 3) => {
    try {
      setIsLoading(true);
      const chat = await chatAPI.getMessages(chatId);
      const formattedMessages = [];

      if (chat.messages?.length) {
        chat.messages.forEach((msg, index) => {
          formattedMessages.push({
            id: `msg_${chatId}_${index}_${Date.now()}`,
            sender: msg.sender,
            text: msg.text,
            timestamp: msg.timestamp,
            processingTime: msg.processingTime || 0,
            context: msg.context || []
          });
        });
      }

      setActiveChatMessages(formattedMessages);
      setCurrentChatId(chatId);
      return true;
    } catch (error) {
      console.error('Lỗi khi chuyển cuộc trò chuyện:', error);
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return switchChat(chatId, retries - 1);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addExchange = useCallback((userMessage, botMessage) => {
    const userMsg = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender: 'user',
      text: userMessage.text,
      timestamp: userMessage.timestamp
    };

    const botMsg = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender: 'bot',
      text: botMessage.text,
      timestamp: botMessage.timestamp,
      processingTime: botMessage.processingTime || 0,
      context: botMessage.context || []
    };

    setActiveChatMessages(prev => [...prev, userMsg, botMsg]);
  }, []);

  // Tải dữ liệu ban đầu khi component mount
  useEffect(() => {
    const initializeData = async () => {
      const { userId, token } = getAuthData();
      console.log('Khởi tạo dữ liệu - userId:', userId, 'token tồn tại:', !!token);

      if (userId && token && !userLoaded) {
        console.log('Bắt đầu tải user và lịch sử chat');
        try {
          // Đảm bảo user được tải trước
          const loadedUser = await fetchUserInfo(userId, true);

          // Sau đó mới tải chat history
          await fetchChatHistory();
        } catch (error) {
          console.error('Lỗi khi khởi tạo dữ liệu:', error);
        }
      }
    };

    initializeData();
  }, []);

  // Kiểm tra trạng thái xác thực định kỳ
  useEffect(() => {
    const checkAuthState = () => {
      const { userId, token } = getAuthData();
      if (!userId || !token) {
        if (user) {
          console.log('Xác thực không hợp lệ, đặt lại trạng thái');
          resetAuthState();
        }
      }
    };

    const interval = setInterval(checkAuthState, 30000);
    return () => clearInterval(interval);
  }, [user, resetAuthState]);

  const value = {
    user, chatHistory, activeChatMessages, currentChatId, isLoading, error,
    setUser, setChatHistory, setActiveChatMessages, setCurrentChatId, setIsLoading, setError,
    createNewChat, switchChat, addExchange, fetchChatHistory, fetchUserInfo, resetAuthState
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};