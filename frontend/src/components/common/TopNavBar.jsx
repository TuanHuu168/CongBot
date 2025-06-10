import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, LogOut, History, ChevronDown, Menu, MessageSquare,
  ChevronLeft, Settings, Shield
} from 'lucide-react';
import { showError } from '../../apiService';
import { ROUTES, STORAGE_KEYS } from '../../utils/formatUtils';

const TopNavBar = ({
  title,
  showBackButton = false,
  backButtonDestination = ROUTES.HOME,
  backButtonText = 'Quay lại',
  user = null,
  onMenuClick = null,
  customRight = null,
  variant = 'default' // 'default', 'chat', 'admin'
}) => {
  const navigate = useNavigate();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle logout with confirmation
  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      // Clear all auth data
      [localStorage, sessionStorage].forEach(storage => {
        Object.values(STORAGE_KEYS).forEach(key => storage.removeItem(key));
      });
      navigate(ROUTES.LOGIN);
    }
  };

  // Navigation items based on variant
  const getNavigationItems = () => {
    const baseItems = [
      { icon: User, label: 'Hồ sơ cá nhân', onClick: () => navigate(ROUTES.PROFILE) },
      { icon: History, label: 'Lịch sử trò chuyện', onClick: () => navigate(ROUTES.HISTORY) },
      { icon: Settings, label: 'Cài đặt', onClick: () => navigate(ROUTES.SETTINGS) },
      { icon: Shield, label: 'Trang quản trị', onClick: () => navigate(ROUTES.ADMIN) }
    ];

    if (user?.role === 'admin') {
      baseItems.push({ icon: Shield, label: 'Trang quản trị', onClick: () => navigate(ROUTES.ADMIN) });
    }

    return baseItems;
  };

  return (
    <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 shadow-md sticky top-0 z-50">
      <div className="px-4">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center">
            {onMenuClick && (
              <button className="md:hidden mr-3 text-white" onClick={onMenuClick}>
                <Menu size={24} />
              </button>
            )}

            {showBackButton ? (
              <button
                onClick={() => navigate(backButtonDestination)}
                className="flex items-center text-white hover:text-green-100 transition-colors"
              >
                <ChevronLeft size={20} />
                <span className="ml-1 font-medium">{backButtonText}</span>
              </button>
            ) : (
              <button onClick={() => navigate(ROUTES.HOME)} className="flex items-center">
                <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center mr-2 backdrop-blur-sm">
                  <MessageSquare size={20} className="text-white" />
                </div>
                <h1 className="text-lg font-bold text-white">CongBot</h1>
              </button>
            )}
          </div>

          {/* Center - Title */}
          <div className="flex-1 text-center mx-4">
            <h1 className="text-lg font-semibold text-white truncate max-w-xs mx-auto">
              {title}
            </h1>
          </div>

          {/* Right - Custom content or User dropdown */}
          {customRight || (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg py-1.5 px-3 backdrop-blur-sm"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-white/20">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <User size={16} className="text-white" />
                  )}
                </div>
                <span className="text-sm font-medium text-white hidden sm:inline">
                  {user?.name || 'Người dùng'}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-white/80 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence mode="sync">
                {showUserDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 z-50"
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
                        <item.icon size={16} className="mr-2 text-gray-500" />
                        <span>{item.label}</span>
                      </button>
                    ))}

                    <button
                      className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100 mt-1"
                      onClick={() => {
                        setShowUserDropdown(false);
                        handleLogout();
                      }}
                    >
                      <LogOut size={16} className="mr-2" />
                      <span>Đăng xuất</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopNavBar;