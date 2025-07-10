import Swal from 'sweetalert2';

// Múi giờ Việt Nam
const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

// Chuyển đổi thời gian về múi giờ Việt Nam
const toVNTime = (dateInput) => {
  if (!dateInput) return null;
  
  try {
    let date;
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return null;
    }
    
    // Kiểm tra date hợp lệ
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('Lỗi khi chuyển đổi thời gian VN:', error);
    return null;
  }
};

// Định dạng ngày tháng theo múi giờ Việt Nam
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  const date = toVNTime(dateString);
  if (!date) return 'N/A';
  
  const now = new Date();
  
  // Format ngày hiện tại theo múi giờ VN
  const todayVN = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  }).format(now);
  
  // Format ngày của input theo múi giờ VN
  const inputDateVN = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
  
  // Format thời gian theo múi giờ VN
  const timeVN = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
  
  if (inputDateVN === todayVN) {
    return `Hôm nay, ${timeVN}`;
  }

  // Tính ngày hôm qua
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayVN = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(yesterday);
  
  if (inputDateVN === yesterdayVN) {
    return `Hôm qua, ${timeVN}`;
  }

  // Format ngày đầy đủ theo múi giờ VN
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Chỉ hiển thị ngày
export const formatDateOnly = (dateString) => {
  if (!dateString) return 'N/A';
  const date = toVNTime(dateString);
  if (!date) return 'N/A';
  
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

// Chỉ hiển thị giờ
export const formatTimeOnly = (dateString) => {
  if (!dateString) return 'N/A';
  const date = toVNTime(dateString);
  if (!date) return 'N/A';
  
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Lấy nhãn ngày (hôm nay, hôm qua, ...)
export const getDateLabel = (dateString) => {
  const date = toVNTime(dateString);
  if (!date) return 'Không xác định';
  
  const now = new Date();
  
  const todayVN = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  
  const inputDateVN = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
  
  if (inputDateVN === todayVN) return 'Hôm nay';
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayVN = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(yesterday);
  
  if (inputDateVN === yesterdayVN) return 'Hôm qua';
  
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit'
  }).format(date);
};

// Tiện ích cho chat
export const getDisplayTitle = (chat) => {
  if (!chat?.title || chat.title.trim() === '') return "Cuộc trò chuyện mới";
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(chat.title);
  return isMongoId ? "Cuộc trò chuyện mới" : chat.title;
};

// Cắt ngắn văn bản
export const truncateText = (text, maxLength = 150) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Hiệu ứng animation
export const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

export const slideUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } }
};

export const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.2 } }
};

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
};

// Tiện ích thông báo
const alertConfig = { confirmButtonColor: '#10b981', customClass: { popup: 'rounded-xl shadow-xl' } };

export const showError = (message, title = 'Lỗi') => {
  return Swal.fire({ icon: 'error', title, text: message, ...alertConfig });
};

export const showSuccess = (message, title = 'Thành công') => {
  return Swal.fire({ icon: 'success', title, text: message, timer: 2000, ...alertConfig });
};

export const showConfirm = (message, title = 'Xác nhận') => {
  return Swal.fire({
    title, text: message, icon: 'question', showCancelButton: true, 
    confirmButtonText: 'Xác nhận', cancelButtonText: 'Hủy',
    confirmButtonColor: '#10b981', cancelButtonColor: '#64748b', ...alertConfig
  });
};

// Tiện ích xác thực
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

// Hằng số đường dẫn
export const ROUTES = {
  HOME: '/', LOGIN: '/login', REGISTER: '/register', CHAT: '/chat',
  HISTORY: '/history', PROFILE: '/profile', ADMIN: '/admin'
};

export const STORAGE_KEYS = { AUTH_TOKEN: 'auth_token', USER_ID: 'user_id' };

// Lấy thời gian hiện tại theo múi giờ Việt Nam
export const getCurrentVNTime = () => {
  return new Date().toLocaleString('sv-SE', { timeZone: VN_TIMEZONE });
};

// Xuất hằng số múi giờ
export { VN_TIMEZONE };