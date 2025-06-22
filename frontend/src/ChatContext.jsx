import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { chatAPI, userAPI } from './apiService';
import { getAuthData, clearAuthData } from './utils/formatUtils';

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

  const resetAuthState = useCallback(() => {
    setUser(null);
    setChatHistory([]);
    setActiveChatMessages([]);
    setCurrentChatId(null);
    setIsLoading(false);
    setError(null);
  }, []);

  const fetchUserInfo = useCallback(async (userId) => {
    if (!userId) return null;
    try {
      setIsLoading(true);
      const userInfo = await userAPI.getInfo(userId);
      setUser({
        id: userId,
        name: userInfo.fullName || userInfo.username,
        email: userInfo.email,
        username: userInfo.username,
        phoneNumber: userInfo.phoneNumber,
        role: userInfo.role || 'user',
        avatarUrl: userInfo.avatar_url,
        personalInfo: userInfo.personal_info
      });
      return userInfo;
    } catch (error) {
      console.error('Error fetching user info:', error);
      setError('Không thể tải thông tin người dùng');
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
        title: chat.title,
        date: new Date(chat.created_at).toLocaleDateString('vi-VN'),
        updated_at: chat.updated_at,
        status: 'active'
      }));
      setChatHistory(formattedChats);
      return formattedChats;
    } catch (error) {
      console.error('Error fetching chat history:', error);
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
      console.error('Error creating chat:', error);
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
      console.error('Error switching chat:', error);
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

  // Check auth state changes
  useEffect(() => {
    const checkAuthState = () => {
      const { userId, token } = getAuthData();
      if ((!userId || !token) && user) {
        resetAuthState();
      }
    };

    const interval = setInterval(checkAuthState, 2000);
    return () => clearInterval(interval);
  }, [user, resetAuthState]);

  // Initialize on mount
  useEffect(() => {
    const { userId, token } = getAuthData();
    if (userId && token) {
      Promise.allSettled([fetchUserInfo(userId), fetchChatHistory()]);
    }
  }, [fetchUserInfo, fetchChatHistory]);

  const value = {
    user, chatHistory, activeChatMessages, currentChatId, isLoading, error,
    setUser, setChatHistory, setActiveChatMessages, setCurrentChatId, setIsLoading, setError,
    createNewChat, switchChat, addExchange, fetchChatHistory, fetchUserInfo, resetAuthState
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};