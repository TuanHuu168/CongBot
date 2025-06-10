import axios from 'axios';
import Swal from 'sweetalert2';

const API_BASE_URL = 'http://localhost:8001';

// Centralized error messages
const ERROR_MESSAGES = {
  NETWORK: 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet.',
  TIMEOUT: 'Yêu cầu quá thời gian. Vui lòng thử lại.',
  SERVER: 'Lỗi máy chủ. Vui lòng thử lại sau.',
  AUTH: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  NOT_FOUND: 'Không tìm thấy dữ liệu.',
  DEFAULT: 'Có lỗi xảy ra. Vui lòng thử lại.'
};

// Create axios instance with common config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Auth helpers
const getAuthToken = () => localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
const getUserId = () => localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

// Request interceptor
apiClient.interceptors.request.use(config => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor with centralized error handling
apiClient.interceptors.response.use(
  response => response,
  error => {
    const errorMessage = error.code === 'ECONNABORTED' || !error.response
      ? ERROR_MESSAGES.NETWORK
      : error.response?.status === 401
        ? ERROR_MESSAGES.AUTH
        : error.response?.status === 404
          ? ERROR_MESSAGES.NOT_FOUND
          : error.response?.data?.detail || ERROR_MESSAGES.DEFAULT;

    return Promise.reject({ detail: errorMessage, status: error.response?.status });
  }
);

// Generic API methods
const apiMethods = {
  get: (url, config = {}) => apiClient.get(url, config).then(res => res.data),
  post: (url, data, config = {}) => apiClient.post(url, data, config).then(res => res.data),
  put: (url, data, config = {}) => apiClient.put(url, data, config).then(res => res.data),
  delete: (url, config = {}) => apiClient.delete(url, config).then(res => res.data)
};

// User API
export const userAPI = {
  getInfo: (userId) => apiMethods.get(`/users/${userId}`),
  register: (userData) => apiMethods.post('/users/register', userData),
  login: (credentials) => apiMethods.post('/users/login', credentials),
  update: (userId, data) => apiMethods.put(`/users/${userId}`, data),
  changePassword: (userId, passwords) => apiMethods.put(`/users/${userId}/password`, passwords)
};

// Chat API
export const chatAPI = {
  ask: (query, sessionId = null) => apiMethods.post('/ask', {
    query,
    user_id: getUserId(),
    session_id: sessionId,
    client_info: {
      platform: 'web',
      deviceType: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
    }
  }),
  
  create: (title = 'Cuộc trò chuyện mới') => apiMethods.post('/chats/create', {
    user_id: getUserId(),
    title
  }),
  
  getAll: () => apiMethods.get(`/chats/${getUserId()}`),
  getMessages: (chatId) => apiMethods.get(`/chats/${chatId}/messages`),
  updateTitle: (chatId, title) => apiMethods.put(`/chats/${chatId}/title`, { title }),
  delete: (chatId) => apiMethods.delete(`/chats/${chatId}`, { data: { user_id: getUserId() } }),
  deleteBatch: (chatIds) => apiMethods.post('/chats/delete-batch', {
    user_id: getUserId(),
    chat_ids: chatIds
  })
};

// Admin API
export const adminAPI = {
  getStatus: () => apiMethods.get('/status'),
  getStatistics: () => apiMethods.get('/statistics'),
  clearCache: () => apiMethods.post('/clear-cache'),
  invalidateCache: (docId) => apiMethods.post(`/invalidate-cache/${docId}`),
  runBenchmark: (config) => apiMethods.post('/run-benchmark', config),
  getBenchmarkResults: () => apiMethods.get('/benchmark-results'),
  getDocuments: () => apiMethods.get('/documents'),
  deleteDocument: (docId) => apiMethods.delete(`/documents/${docId}?confirm=true`)
};

// Feedback API
export const feedbackAPI = {
  submit: (data) => apiMethods.post('/feedback', data)
};

// Show error with SweetAlert2
export const showError = (message, title = 'Lỗi') => {
  Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonColor: '#10b981'
  });
};

// Show success message
export const showSuccess = (message, title = 'Thành công') => {
  Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonColor: '#10b981',
    timer: 2000
  });
};

// Legacy exports for backward compatibility
export const askQuestion = chatAPI.ask;
export const createNewChat = chatAPI.create;
export const getUserChats = chatAPI.getAll;
export const getChatMessages = chatAPI.getMessages;
export const updateChatTitle = chatAPI.updateTitle;
export const deleteChat = chatAPI.delete;
export const deleteChatsBatch = chatAPI.deleteBatch;
export const getUserInfo = userAPI.getInfo;
export const submitFeedback = feedbackAPI.submit;