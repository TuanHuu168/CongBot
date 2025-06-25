import axios from 'axios';
import { showError, getAuthData, clearAuthData } from './utils/formatUtils';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use(config => {
  const { token } = getAuthData();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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

const apiCall = async (method, url, data = null, config = {}) => {
  try {
    const response = await apiClient[method](url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const userAPI = {
  getInfo: (userId) => apiCall('get', `/users/${userId}`),
  register: (userData) => apiCall('post', '/users/register', userData),
  login: (credentials) => apiCall('post', '/users/login', credentials),
  update: (userId, data) => apiCall('put', `/users/${userId}`, data),
  changePassword: (userId, passwords) => apiCall('put', `/users/${userId}/change-password`, passwords)
};

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

export const adminAPI = {
  getStatus: () => apiCall('get', '/status'),
  clearCache: () => apiCall('post', '/clear-cache'),
  runBenchmark: (config) => apiCall('post', '/run-benchmark', config),
  getDocuments: () => apiCall('get', '/documents'),
  deleteDocument: (docId) => apiCall('delete', `/documents/${docId}?confirm=true`),
  getBenchmarkResults: () => apiCall('get', '/benchmark-results'),
  getStatistics: () => apiCall('get', '/statistics'),
  getAllUsers: (limit = 100, skip = 0) => apiCall('get', `/users?limit=${limit}&skip=${skip}`),
  getUserDetail: (userId) => apiCall('get', `/users/${userId}`),
  updateUser: (userId, userData) => apiCall('put', `/users/${userId}`, userData),
  deleteUser: (userId) => apiCall('delete', `/users/${userId}?confirm=true`),
  resetUserPassword: (userId, newPassword) => apiCall('post', `/users/${userId}/reset-password`, { new_password: newPassword }),
  toggleUserStatus: (userId) => apiCall('post', `/users/${userId}/toggle-status`)
};

export const askQuestion = chatAPI.ask;
export const getUserChats = chatAPI.getAll;
export const getChatMessages = chatAPI.getMessages;
export const updateChatTitle = chatAPI.updateTitle;
export const deleteChat = chatAPI.delete;
export const deleteChatsBatch = chatAPI.deleteBatch;
export const getUserInfo = userAPI.getInfo;

export const getApiBaseUrl = () => API_BASE_URL;