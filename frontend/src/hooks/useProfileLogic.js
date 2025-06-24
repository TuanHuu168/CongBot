import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../ChatContext';
import { userAPI } from '../apiService';
import { validatePassword, validateConfirmPassword } from '../utils/validationUtils';
import { showError, showSuccess } from '../utils/formatUtils';

export const useProfileLogic = () => {
  const navigate = useNavigate();
  const { user, fetchUserInfo, chatHistory, switchChat, fetchChatHistory } = useChat();

  const [formData, setFormData] = useState({
    fullName: '', email: '', phoneNumber: '', personalInfo: '', avatarUrl: '',
    currentPassword: '', newPassword: '', confirmPassword: ''
  });

  const [stats, setStats] = useState({
    chatCount: 0, messageCount: 0, documentsAccessed: 0, savedItems: 0
  });

  const [recentChats, setRecentChats] = useState([]);
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false, new: false, confirm: false
  });
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load user data
  useEffect(() => {
    if (!dataLoaded) {
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      if (userId) {
        Promise.all([fetchUserInfo(userId), fetchChatHistory()]).then(() => {
          setDataLoaded(true);
        }).catch(error => {
          console.error("Lỗi khi tải dữ liệu:", error);
          setDataLoaded(true);
        });
      } else {
        navigate('/login');
      }
    }
  }, [fetchUserInfo, fetchChatHistory, navigate, dataLoaded]);

  // Process chat history
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      const chatCount = chatHistory.length;
      const sortedChats = [...chatHistory].sort((a, b) => {
        return new Date(b.updated_at || b.date) - new Date(a.updated_at || a.date);
      });
      const latest = sortedChats.slice(0, 3);
      setRecentChats(latest);
      setStats({ chatCount, messageCount: 0, documentsAccessed: 0, savedItems: 0 });
    }
  }, [chatHistory]);

  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData(prevState => ({
        ...prevState,
        fullName: user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        personalInfo: user.personalInfo || '',
        avatarUrl: user.avatarUrl || ''
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

      if (!userId || !token) {
        throw new Error('Không tìm thấy thông tin đăng nhập');
      }

      await userAPI.update(userId, {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        personalInfo: formData.personalInfo,
        avatarUrl: formData.avatarUrl
      });

      await fetchUserInfo(userId);
      showSuccess('Thông tin cá nhân đã được cập nhật', 'Thành công!');
      setEditMode(false);
    } catch (error) {
      console.error('Lỗi khi cập nhật thông tin:', error);
      showError(error.detail || 'Không thể cập nhật thông tin. Vui lòng thử lại sau.', 'Lỗi!');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);

    const passwordError = validatePassword(formData.newPassword);
    const confirmError = validateConfirmPassword(formData.newPassword, formData.confirmPassword);

    if (passwordError || confirmError) {
      showError(passwordError || confirmError, 'Lỗi!');
      setPasswordLoading(false);
      return;
    }

    try {
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

      await userAPI.changePassword(userId, {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });

      showSuccess('Mật khẩu đã được thay đổi', 'Thành công!');
      setFormData({
        ...formData,
        currentPassword: '', newPassword: '', confirmPassword: ''
      });
    } catch (error) {
      console.error('Lỗi khi thay đổi mật khẩu:', error);
      let errorMessage = 'Không thể thay đổi mật khẩu. Vui lòng thử lại sau.';
      if (error.response?.status === 401) {
        errorMessage = 'Mật khẩu hiện tại không đúng';
      } else if (error.detail) {
        errorMessage = error.detail;
      }
      showError(errorMessage, 'Lỗi!');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarChange = () => {
    showSuccess('Tính năng này sẽ được cập nhật trong phiên bản tới', 'Thay đổi ảnh đại diện');
  };

  const handleChatClick = (chatId) => {
    switchChat(chatId).then(() => {
      navigate('/chat');
    });
  };

  const formatChatTitle = (title) => {
    if (!title || title.trim() === '') return "Cuộc trò chuyện mới";
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(title);
    return isMongoId ? "Cuộc trò chuyện mới" : title;
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return {
    // State
    formData, stats, recentChats, passwordVisibility, editMode, isLoading, passwordLoading,
    
    // Data
    user,
    
    // Functions
    handleChange, handleSubmit, handlePasswordChange, handleAvatarChange, 
    handleChatClick, formatChatTitle, togglePasswordVisibility,
    setEditMode
  };
};