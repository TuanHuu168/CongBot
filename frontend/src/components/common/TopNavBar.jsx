import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, History, ChevronDown, Menu, ChevronLeft, Settings, Shield, Award } from 'lucide-react';
import { ROUTES, showConfirm, clearAuthData } from '../../utils/formatUtils';
import { useChat } from '../../ChatContext';

const TopNavBar = ({
  title, showBackButton = false, backButtonDestination = ROUTES.HOME,
  backButtonText = 'Quay lại', user = null, onMenuClick = null, customRight = null
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setCurrentChatId, setActiveChatMessages, setChatHistory } = useChat();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Bấm chỗ khác để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    showConfirm('Bạn có chắc chắn muốn đăng xuất?', 'Đăng xuất').then((result) => {
      if (result.isConfirmed) {
        clearAuthData();
        setShowUserDropdown(false);
        setUser(null);
        setCurrentChatId(null);
        setActiveChatMessages([]);
        setChatHistory([]);
        navigate(ROUTES.HOME);
      }
    });
  };

  const isAdmin = () => user?.role === 'admin';
  const getDisplayName = () => {
    // Ưu tiên fullName, sau đó username, cuối cùng mới là 'Người dùng'
    if (user?.fullName && user.fullName.trim() !== '') return user.fullName;
    if (user?.name && user.name.trim() !== '' && user.name !== 'Người dùng') return user.name;
    if (user?.username && user.username.trim() !== '') return user.username;
    return 'Người dùng';
  };
  const isLoggedIn = Boolean(user?.id);

  // Navigation items
  const getNavigationItems = () => {
    const currentPath = location.pathname;
    const allItems = [
      { icon: Settings, label: 'Cài đặt', onClick: () => navigate(ROUTES.PROFILE), path: ROUTES.PROFILE },
      { icon: History, label: 'Lịch sử trò chuyện', onClick: () => navigate(ROUTES.HISTORY), path: ROUTES.HISTORY }
    ];

    if (isAdmin()) {
      allItems.push({ icon: Shield, label: 'Quản trị hệ thống', onClick: () => navigate(ROUTES.ADMIN), path: ROUTES.ADMIN });
    }

    return allItems.filter(item => item.path !== currentPath);
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left Section */}
          <div className="flex items-center">
            {onMenuClick && (
              <button className="md:hidden mr-3 text-gray-600 hover:text-gray-900" onClick={onMenuClick}>
                <Menu size={24} />
              </button>
            )}

            {showBackButton ? (
              <button
                onClick={() => navigate(backButtonDestination)}
                className="flex items-center text-gray-600 hover:text-green-600 transition-colors"
              >
                <ChevronLeft size={20} />
                <span className="ml-1 font-medium">{backButtonText}</span>
              </button>
            ) : (
              <button onClick={() => navigate(ROUTES.HOME)} className="flex items-center">
                <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                  <div className="relative">
                    <Award size={20} className="text-white" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white"></div>
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">CongBot</h1>
                  <p className="text-xs text-gray-500 -mt-1">Hỗ trợ người có công</p>
                </div>
              </button>
            )}
          </div>

          {/* Tiêu đề */}
          <div className="flex-1 text-center mx-4">
            <h1 className="text-lg font-semibold text-gray-800 truncate max-w-xs mx-auto">{title}</h1>
          </div>

          {/* Section phải */}
          {customRight || (
            <>
              {isLoggedIn ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl py-2 px-3 border border-gray-200"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-green-500 to-teal-600">
                      <User size={16} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                      {getDisplayName()}
                    </span>
                    <ChevronDown size={16} className={`text-gray-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence mode="sync">
                    {showUserDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 z-50 border border-gray-200"
                      >
                        {getNavigationItems().map((item, index) => (
                          <button
                            key={index}
                            className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => {
                              setShowUserDropdown(false);
                              item.onClick();
                            }}
                          >
                            <item.icon size={16} className="mr-3 text-gray-500" />
                            <span>{item.label}</span>
                          </button>
                        ))}

                        <div className="border-t border-gray-100 mt-1">
                          <button
                            className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            onClick={() => {
                              setShowUserDropdown(false);
                              handleLogout();
                            }}
                          >
                            <LogOut size={16} className="mr-3" />
                            <span>Đăng xuất</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => navigate('/login')}
                    className="text-green-600 hover:text-green-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="bg-gradient-to-r from-green-500 to-teal-600 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all"
                  >
                    Đăng ký
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopNavBar;