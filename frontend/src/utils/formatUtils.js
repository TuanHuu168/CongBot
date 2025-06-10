// Date formatting utilities
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  const now = new Date();
  
  // Helper to check if dates are same day
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
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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
  
  // Check if title is MongoDB ObjectId
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(chat.title);
  return isMongoId ? "Cuộc trò chuyện mới" : chat.title;
};

// Text utilities
export const truncateText = (text, maxLength = 150) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Validation utilities
export const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

// Animation variants for reuse across components
export const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

export const slideUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
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

// Common constants
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