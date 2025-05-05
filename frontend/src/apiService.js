import axios from 'axios';

const API_BASE_URL = 'http://localhost:8001';

// Tạo instance axios với cấu hình chung và TIMEOUT dài hơn
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Tăng timeout lên 30 giây
});

// Thêm interceptor để tự động gắn token vào mỗi request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Thêm interceptor xử lý lỗi response
apiClient.interceptors.response.use(
  response => response,
  error => {
    // Kiểm tra xem có phải là lỗi timeout hoặc kết nối không
    if (error.code === 'ECONNABORTED' || !error.response) {
      return Promise.reject({ 
        detail: "Lỗi kết nối máy chủ. Vui lòng kiểm tra kết nối internet hoặc thử lại sau." 
      });
    }
    
    // Xử lý các lỗi khác
    return Promise.reject(error.response?.data || { detail: 'Có lỗi xảy ra, vui lòng thử lại' });
  }
);

export const getUserInfo = async (userId) => {
  try {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user info:', error);
    throw error;
  }
};

// Gửi câu hỏi đến API và nhận phản hồi
export const askQuestion = async (query, sessionId = null) => {
  try {
    const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

    const clientInfo = {
      platform: 'web',
      deviceType: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
    };

    const requestData = {
      query,
      user_id: userId,
      session_id: sessionId,
      client_info: clientInfo
    };

    const response = await apiClient.post('/ask', requestData);
    return response.data;
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
};

// Tạo cuộc trò chuyện mới
export const createNewChat = async (title = 'Cuộc trò chuyện mới') => {
  try {
    const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

    const response = await apiClient.post('/chats/create', {
      user_id: userId,
      title
    });

    return response.data;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
};

// Lấy danh sách cuộc trò chuyện của người dùng
export const getUserChats = async () => {
  try {
    const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    if (!userId) {
      throw new Error('Không tìm thấy ID người dùng');
    }

    const response = await apiClient.get(`/chats/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching chats:', error);
    throw error;
  }
};

// Lấy tin nhắn của một cuộc trò chuyện
export const getChatMessages = async (chatId) => {
  try {
    const response = await apiClient.get(`/chats/${chatId}/messages`);
    return response.data;
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    throw error;
  }
};

// Cập nhật tiêu đề cuộc trò chuyện
export const updateChatTitle = async (chatId, title) => {
  try {
    const response = await apiClient.put(`/chats/${chatId}/title`, { title });
    return response.data;
  } catch (error) {
    console.error('Error updating chat title:', error);
    throw error;
  }
};

// Thêm tin nhắn vào cuộc trò chuyện
export const addMessageToChat = async (chatId, message) => {
  try {
    const response = await apiClient.post(`/chats/${chatId}/messages`, message);
    return response.data;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
};

// Xóa một cuộc trò chuyện
export const deleteChat = async (chatId) => {
  try {
    const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    
    const response = await apiClient.delete(`/chats/${chatId}`, {
      data: { user_id: userId }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error deleting chat:', error);
    throw error;
  }
};

// Xóa nhiều cuộc trò chuyện cùng lúc
export const deleteChatsBatch = async (chatIds) => {
  try {
    const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    
    const response = await apiClient.post('/chats/delete-batch', {
      user_id: userId,
      chat_ids: chatIds
    });
    
    return response.data;
  } catch (error) {
    console.error('Error deleting multiple chats:', error);
    throw error;
  }
};

// Gửi phản hồi về chất lượng câu trả lời
export const submitFeedback = async (chatId, rating, comment = '', isAccurate = null, isHelpful = null) => {
  try {
    const response = await apiClient.post('/feedback', {
      chat_id: chatId,
      rating,
      comment,
      is_accurate: isAccurate,
      is_helpful: isHelpful
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
};

// Cập nhật thông tin người dùng
export const updateUserInfo = async (userId, userData) => {
  try {
    const response = await apiClient.put(`/users/${userId}`, userData);
    return response.data;
  } catch (error) {
    console.error('Error updating user info:', error);
    throw error;
  }
};

// Thay đổi mật khẩu
export const changePassword = async (userId, passwordData) => {
  try {
    const response = await apiClient.put(`/users/${userId}/password`, passwordData);
    return response.data;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

export default {
  askQuestion,
  createNewChat,
  getUserChats,
  getChatMessages,
  updateChatTitle,
  addMessageToChat,
  deleteChat,
  deleteChatsBatch,
  submitFeedback,
  updateUserInfo,
  changePassword
};