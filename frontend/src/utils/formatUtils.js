import Swal from 'sweetalert2';

// Date formatting utilities
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  
  const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString();
  
  if (isSameDay(date, now)) {
    return `Hôm nay, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (isSameDay(date, yesterday)) {
    return `Hôm qua, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const getDateLabel = (dateString) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const chatDate = new Date(dateString);
  
  if (chatDate.toDateString() === today.toDateString()) return 'Hôm nay';
  if (chatDate.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return chatDate.toLocaleDateString('vi-VN');
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

// Validation utilities
export const validateEmail = (email) => {
  if (!email) return 'Vui lòng nhập email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ';
  return '';
};

export const validatePassword = (password) => {
  if (!password) return 'Vui lòng nhập mật khẩu';
  if (password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
  return '';
};

export const validateUsername = (username) => {
  if (!username) return 'Vui lòng nhập tên đăng nhập';
  if (username.length < 3) return 'Tên đăng nhập phải có ít nhất 3 ký tự';
  return '';
};

export const validateFullName = (fullName) => {
  if (!fullName) return 'Vui lòng nhập họ và tên';
  return '';
};

export const validatePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return 'Vui lòng nhập số điện thoại';
  return '';
};

export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) return 'Vui lòng xác nhận mật khẩu';
  if (password !== confirmPassword) return 'Mật khẩu không khớp';
  return '';
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