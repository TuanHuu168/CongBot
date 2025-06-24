import Swal from 'sweetalert2';

// Timezone utilities - convert UTC từ backend sang VN time
const VN_TIMEZONE_OFFSET = 7 * 60; // GMT+7 in minutes

const convertToVNTime = (utcDateString) => {
  if (!utcDateString) return null;
  const utcDate = new Date(utcDateString);
  // Thêm 7 giờ cho múi giờ Việt Nam
  return new Date(utcDate.getTime() + VN_TIMEZONE_OFFSET * 60 * 1000);
};

// Date formatting utilities với VN timezone
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  // Convert từ UTC sang VN time
  const vnDate = convertToVNTime(dateString);
  if (!vnDate) return 'N/A';
  
  const now = convertToVNTime(new Date().toISOString());
  
  const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString();
  
  if (isSameDay(vnDate, now)) {
    return `Hôm nay, ${vnDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (isSameDay(vnDate, yesterday)) {
    return `Hôm qua, ${vnDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return vnDate.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const formatDateOnly = (dateString) => {
  if (!dateString) return 'N/A';
  
  const vnDate = convertToVNTime(dateString);
  if (!vnDate) return 'N/A';
  
  return vnDate.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

export const formatTimeOnly = (dateString) => {
  if (!dateString) return 'N/A';
  
  const vnDate = convertToVNTime(dateString);
  if (!vnDate) return 'N/A';
  
  return vnDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export const getDateLabel = (dateString) => {
  const today = convertToVNTime(new Date().toISOString());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const chatDate = convertToVNTime(dateString);
  
  if (!chatDate) return 'Không xác định';
  
  if (chatDate.toDateString() === today.toDateString()) return 'Hôm nay';
  if (chatDate.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return chatDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

// Chat title utilities
export const getDisplayTitle = (chat) => {
  if (!chat?.title || chat.title.trim() === '') return "Cuộc trò chuyện mới";
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(chat.title);
  return isMongoId ? "Cuộc trò chuyện mới" : chat.title;
};

export const truncateText = (text, maxLength = 150) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Animation variants
export const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

export const slideUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, y: 0, 
    transition: { type: "spring", stiffness: 260, damping: 20 }
  }
};

export const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.2 } }
};

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

// Alert utilities
export const showError = (message, title = 'Lỗi') => {
  return Swal.fire({
    icon: 'error', title, text: message,
    confirmButtonColor: '#10b981',
    customClass: { popup: 'rounded-xl shadow-xl' }
  });
};

export const showSuccess = (message, title = 'Thành công') => {
  return Swal.fire({
    icon: 'success', title, text: message,
    confirmButtonColor: '#10b981', timer: 2000,
    customClass: { popup: 'rounded-xl shadow-xl' }
  });
};

export const showConfirm = (message, title = 'Xác nhận') => {
  return Swal.fire({
    title, text: message, icon: 'question',
    showCancelButton: true, confirmButtonText: 'Xác nhận', cancelButtonText: 'Hủy',
    confirmButtonColor: '#10b981', cancelButtonColor: '#64748b',
    customClass: { popup: 'rounded-xl shadow-xl' }
  });
};

// Auth utilities
export const getAuthData = () => {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
  return { token, userId, isValid: !!(token && userId) };
};

export const clearAuthData = () => {
  ['auth_token', 'user_id'].forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

// Constants
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register', 
  CHAT: '/chat',
  HISTORY: '/history',
  PROFILE: '/profile',
  ADMIN: '/admin'
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_ID: 'user_id'
};

// Utility để lấy thời gian hiện tại VN
export const getCurrentVNTime = () => {
  return convertToVNTime(new Date().toISOString());
};

export { convertToVNTime };