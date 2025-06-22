import axios from 'axios';
import { showError, showSuccess, getAuthData, clearAuthData } from './utils/formatUtils';

const API_BASE_URL = 'http://localhost:8001';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor
apiClient.interceptors.request.use(config => {
  const { token } = getAuthData();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor với error handling tự động
apiClient.interceptors.response.use(
  response => response,
  error => {
    const errorMessage = error.code === 'ECONNABORTED' || !error.response
      ? 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet.'
      : error.response?.status === 401
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : error.response?.data?.detail || 'Có lỗi xảy ra. Vui lòng thử lại.';

    if (error.response?.status === 401) {
      clearAuthData();
      window.location.href = '/login';
    }

    return Promise.reject({ detail: errorMessage, status: error.response?.status });
  }
);

// API methods với error handling tích hợp
const apiCall = async (method, url, data = null, config = {}) => {
  try {
    const response = await apiClient[method](url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// User API
export const userAPI = {
  getInfo: (userId) => apiCall('get', `/users/${userId}`),
  register: (userData) => apiCall('post', '/users/register', userData),
  login: (credentials) => apiCall('post', '/users/login', credentials),
  update: (userId, data) => apiCall('put', `/users/${userId}`, data),
  changePassword: (userId, passwords) => apiCall('put', `/users/${userId}/password`, passwords)
};

// Chat API
export const chatAPI = {
  ask: (query, sessionId = null) => {
    const { userId } = getAuthData();
    return apiCall('post', '/ask', {
      query, user_id: userId, session_id: sessionId,
      client_info: {
        platform: 'web',
        deviceType: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
      }
    });
  },
  create: (title = 'Cuộc trò chuyện mới') => {
    const { userId } = getAuthData();
    return apiCall('post', '/chats/create', { user_id: userId, title });
  },
  getAll: () => {
    const { userId } = getAuthData();
    return apiCall('get', `/chats/${userId}`);
  },
  getMessages: (chatId) => apiCall('get', `/chats/${chatId}/messages`),
  updateTitle: (chatId, title) => apiCall('put', `/chats/${chatId}/title`, { title }),
  delete: (chatId) => {
    const { userId } = getAuthData();
    return apiCall('delete', `/chats/${chatId}`, { user_id: userId });
  },
  deleteBatch: (chatIds) => {
    const { userId } = getAuthData();
    return apiCall('post', '/chats/delete-batch', { user_id: userId, chat_ids: chatIds });
  }
};

// Admin API
export const adminAPI = {
  getStatus: () => apiCall('get', '/status'),
  clearCache: () => apiCall('post', '/clear-cache'),
  runBenchmark: (config) => apiCall('post', '/run-benchmark', config),
  getDocuments: () => apiCall('get', '/documents'),
  deleteDocument: (docId) => apiCall('delete', `/documents/${docId}?confirm=true`)
};

// Legacy exports
export const askQuestion = chatAPI.ask;
export const createNewChat = chatAPI.create;
export const getUserChats = chatAPI.getAll;
export const getChatMessages = chatAPI.getMessages;
export const updateChatTitle = chatAPI.updateTitle;
export const deleteChat = chatAPI.delete;
export const deleteChatsBatch = chatAPI.deleteBatch;
export const getUserInfo = userAPI.getInfo;

// Export utilities
export { showError, showSuccess };