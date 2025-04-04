// ChatContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { getUserInfo, getChatHistory } from './apiService';

// Tạo context
export const ChatContext = createContext();

// Custom hook để sử dụng ChatContext
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Provider component
export const ChatProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState('current');
  const [activeChatMessages, setActiveChatMessages] = useState([
    { id: 1, sender: 'bot', text: 'Xin chào! Tôi là chatbot hỗ trợ chính sách người có công. Bạn có thể hỏi tôi bất kỳ thông tin nào về chính sách ưu đãi, trợ cấp, hoặc thủ tục hành chính liên quan đến người có công.' },
  ]);

  // Lấy thông tin người dùng khi component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Trong thực tế, userId sẽ lấy từ authentication system
        const userId = 'user123'; 
        
        // Lấy thông tin người dùng
        const userInfo = await getUserInfo(userId);
        setUser(userInfo);
        
        // Lấy lịch sử chat
        const history = await getChatHistory(userId);
        setChatHistory(history);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    fetchInitialData();
  }, []);

  // Hàm tạo chat mới
  const createNewChat = () => {
    setActiveChatMessages([
      { id: 1, sender: 'bot', text: 'Xin chào! Tôi là chatbot hỗ trợ chính sách người có công. Bạn có thể hỏi tôi bất kỳ thông tin nào về chính sách ưu đãi, trợ cấp, hoặc thủ tục hành chính liên quan đến người có công.' },
    ]);
    setCurrentChatId('current');
    
    // Trong thực tế, tạo chat mới sẽ gọi API để lưu vào DB
    // Tạm thời mock dữ liệu
  };

  // Hàm chuyển đổi giữa các cuộc trò chuyện
  const switchChat = (chatId) => {
    setCurrentChatId(chatId);
    
    // Trong thực tế, sẽ gọi API để lấy tin nhắn của cuộc trò chuyện tương ứng
    // Tạm thời mock dữ liệu
    if (chatId === 'current') {
      setActiveChatMessages([
        { id: 1, sender: 'bot', text: 'Xin chào! Tôi là chatbot hỗ trợ chính sách người có công. Bạn có thể hỏi tôi bất kỳ thông tin nào về chính sách ưu đãi, trợ cấp, hoặc thủ tục hành chính liên quan đến người có công.' },
      ]);
    } else {
      // Mock messages based on chat ID
      const mockMessages = [
        { id: 1, sender: 'bot', text: 'Xin chào! Tôi là chatbot hỗ trợ chính sách người có công. Bạn có thể hỏi tôi bất kỳ thông tin nào về chính sách ưu đãi, trợ cấp, hoặc thủ tục hành chính liên quan đến người có công.' },
        { id: 2, sender: 'user', text: chatHistory.find(chat => chat.id === chatId)?.title || 'Câu hỏi mẫu' },
        { id: 3, sender: 'bot', text: 'Đây là tin nhắn mẫu cho cuộc trò chuyện đã lưu. Trong ứng dụng thực tế, tin nhắn này sẽ được lấy từ cơ sở dữ liệu.' },
      ];
      setActiveChatMessages(mockMessages);
    }
  };

  // Giá trị được chia sẻ qua context
  const contextValue = {
    user,
    chatHistory,
    isLoading,
    setIsLoading,
    activeChatMessages,
    setActiveChatMessages,
    currentChatId,
    createNewChat,
    switchChat,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};