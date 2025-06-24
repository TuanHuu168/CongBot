import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { chatAPI, userAPI } from './apiService';
import { getAuthData } from './utils/formatUtils';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
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
    console.log('Reset auth state');
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
      console.log('Không có userId để fetch');
      return null;
    }
    
    if (userLoaded && !forceRefresh && user) {
      console.log('User đã được load, không fetch lại');
      return user;
    }
    
    try {
      console.log(`Bắt đầu fetch user info cho userId: ${userId}`);
      setIsLoading(true);
      
      const userInfo = await userAPI.getInfo(userId);
      console.log('API trả về userInfo:', userInfo);
      
      const userData = {
        id: userId,
        name: userInfo.fullName || userInfo.username || 'Người dùng',
        email: userInfo.email || '',
        username: userInfo.username || '',
        fullName: userInfo.fullName || '',
        phoneNumber: userInfo.phoneNumber || '',
        role: userInfo.role || 'user',
        status: userInfo.status || 'active',
        avatarUrl: userInfo.avatar_url || '',
        personalInfo: userInfo.personal_info || ''
      };
      
      console.log('User data được tạo:', userData);
      
      setUser(userData);
      setUserLoaded(true);
      setError(null);
      
      return userData;
    } catch (error) {
      console.error('Lỗi khi tải thông tin người dùng:', error);
      setError('Không thể tải thông tin người dùng');
      setUserLoaded(true); // Vẫn đánh dấu đã load để tránh loop
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, userLoaded]);

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
        id: newChatId, title,
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

  // Kiểm tra auth state định kỳ
  useEffect(() => {
    const checkAuthState = () => {
      const { userId, token } = getAuthData();
      if (!userId || !token) {
        if (user) {
          console.log('Auth không hợp lệ, reset state');
          resetAuthState();
        }
      }
    };

    const interval = setInterval(checkAuthState, 10000);
    return () => clearInterval(interval);
  }, [user, resetAuthState]);

  // Load initial data khi component mount
  useEffect(() => {
    const initializeData = async () => {
      const { userId, token } = getAuthData();
      console.log('Initialize data - userId:', userId, 'token exists:', !!token);
      
      if (userId && token && !userLoaded) {
        console.log('Bắt đầu load user và chat history');
        await Promise.allSettled([
          fetchUserInfo(userId),
          fetchChatHistory()
        ]);
      }
    };

    initializeData();
  }, []); // Chỉ chạy 1 lần khi mount

  const value = {
    user, chatHistory, activeChatMessages, currentChatId, isLoading, error,
    setUser, setChatHistory, setActiveChatMessages, setCurrentChatId, setIsLoading, setError,
    createNewChat, switchChat, addExchange, fetchChatHistory, fetchUserInfo, resetAuthState
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};