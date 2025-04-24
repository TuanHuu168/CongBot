import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserChats, getChatMessages, createNewChat as apiCreateNewChat, getUserInfo } from './apiService';
import Swal from 'sweetalert2';

// Tạo context
const ChatContext = createContext();

// Custom hook để sử dụng context
export const useChat = () => useContext(ChatContext);

// Provider component
export const ChatProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeChatMessages, setActiveChatMessages] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lấy thông tin người dùng
  const fetchUserInfo = async (userId) => {
    try {
      setIsLoading(true);
      const userInfo = await getUserInfo(userId);
      setUser({
        id: userId,
        name: userInfo.fullName || userInfo.username,
        email: userInfo.email,
        username: userInfo.username,
        phoneNumber: userInfo.phoneNumber
      });
    } catch (error) {
      console.error('Error fetching user info:', error);
      setError('Không thể tải thông tin người dùng');
    } finally {
      setIsLoading(false);
    }
  };

  // Lấy lịch sử chat của người dùng
  const fetchChatHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      if (!userId) {
        throw new Error('Không tìm thấy ID người dùng');
      }

      const chats = await getUserChats(userId);

      // Format data cho UI
      const formattedChats = chats.map(chat => ({
        id: chat.id,
        title: chat.title,
        date: new Date(chat.created_at).toLocaleDateString('vi-VN'),
        updated_at: chat.updated_at,
        status: 'active' // Giả sử tất cả đều active
      }));

      setChatHistory(formattedChats);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      setError('Không thể tải lịch sử trò chuyện');

      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: 'Không thể tải lịch sử trò chuyện',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Lấy thông tin người dùng và lịch sử chat khi component mount
  useEffect(() => {
    const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

    if (userId && token) {
      fetchUserInfo(userId);
      fetchChatHistory();
    }
  }, []);

  // Tạo cuộc trò chuyện mới
  const createNewChat = async (initialTitle = 'Cuộc trò chuyện mới') => {
    try {
      setIsLoading(true);
      setError(null);

      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

      if (!userId) {
        throw new Error('Bạn cần đăng nhập để tạo cuộc trò chuyện mới');
      }

      const response = await apiCreateNewChat(userId, initialTitle);
      const newChatId = response.id;

      // Thêm chat mới vào danh sách
      const newChat = {
        id: newChatId,
        title: initialTitle,
        date: new Date().toLocaleDateString('vi-VN'),
        updated_at: new Date().toISOString(),
        status: 'active'
      };

      setChatHistory(prev => [newChat, ...prev]);
      setCurrentChatId(newChatId);
      setActiveChatMessages([]);

      return newChatId;
    } catch (error) {
      console.error('Error creating new chat:', error);
      setError('Không thể tạo cuộc trò chuyện mới');

      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: 'Không thể tạo cuộc trò chuyện mới',
        confirmButtonColor: '#10b981'
      });

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Chuyển đổi giữa các cuộc trò chuyện
  const switchChat = async (chatId) => {
    try {
      setIsLoading(true);
      setError(null);

      // Lấy tin nhắn của cuộc trò chuyện
      const chat = await getChatMessages(chatId);

      // Xử lý cấu trúc dữ liệu từ backend
      const formattedMessages = [];

      // Xử lý messages hoặc exchanges tùy theo cấu trúc backend trả về
      if (chat.messages && Array.isArray(chat.messages)) {
        // Tạo ID duy nhất cho từng tin nhắn
        chat.messages.forEach((msg, index) => {
          formattedMessages.push({
            id: `msg_${chatId}_${index}_${Date.now()}`, // Đảm bảo key duy nhất
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
    } catch (error) {
      console.error('Error switching chat:', error);
      setError('Không thể tải tin nhắn của cuộc trò chuyện');

      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: 'Không thể tải tin nhắn của cuộc trò chuyện',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Thêm cặp tin nhắn người dùng và bot vào chat hiện tại
  const addExchange = async (userMessage, botMessage) => {
    // Tạo đối tượng tin nhắn người dùng
    const formattedUserMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      sender: 'user',
      text: userMessage.text,
      timestamp: userMessage.timestamp
    };

    // Tạo đối tượng tin nhắn bot
    const formattedBotMessage = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      sender: 'bot',
      text: botMessage.text,
      timestamp: botMessage.timestamp,
      processingTime: botMessage.processingTime || 0,
      context: botMessage.context || []
    };

    // Cập nhật state
    setActiveChatMessages(prev => [...prev, formattedUserMessage, formattedBotMessage]);
  };

  // Export các state và function
  const value = {
    user,
    setUser,
    chatHistory,
    setChatHistory,
    activeChatMessages,
    setActiveChatMessages,
    currentChatId,
    setCurrentChatId,
    isLoading,
    setIsLoading,
    error,
    setError,
    createNewChat,
    switchChat,
    addExchange,
    fetchChatHistory,
    fetchUserInfo
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export default ChatContext;