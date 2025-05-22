import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, LogOut, History, ChevronDown, Menu, MessageSquare, ChevronLeft
} from 'lucide-react';
import Swal from 'sweetalert2';

const TopNavBar = ({
    title,
    showBackButton = false,
    backButtonDestination = '/',
    backButtonText = 'Quay lại',
    user = null,
    onMenuClick = null,
    customRight = null,
    type = 'default' // 'default', 'chat', 'admin'
}) => {
    const navigate = useNavigate();
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const userDropdownRef = useRef(null);

    // Xử lý click bên ngoài dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
                setShowUserDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleUserDropdown = () => {
        setShowUserDropdown(!showUserDropdown);
    };

    const handleLogout = () => {
        Swal.fire({
            title: 'Đăng xuất',
            text: 'Bạn có chắc chắn muốn đăng xuất?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Đăng xuất',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#9ca3af'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_id');
                sessionStorage.removeItem('auth_token');
                sessionStorage.removeItem('user_id');
                navigate('/login');
            }
        });
    };

    return (
        <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 shadow-md sticky top-0 z-50">
            <div className="px-4">
                <div className="flex items-center justify-between">
                    {/* Left Section */}
                    <div className="flex items-center">
                        {/* Mobile menu button */}
                        {onMenuClick && (
                            <button
                                className="md:hidden mr-3 text-white"
                                onClick={onMenuClick}
                            >
                                <Menu size={24} />
                            </button>
                        )}

                        {/* Back button or Logo */}
                        {showBackButton ? (
                            <button
                                onClick={() => navigate(backButtonDestination)}
                                className="flex items-center text-white hover:text-green-100 transition-colors"
                            >
                                <ChevronLeft size={20} />
                                <span className="ml-1 font-medium">{backButtonText}</span>
                            </button>
                        ) : (
                            <button onClick={() => navigate('/')} className="flex items-center">
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
                    {customRight ? (
                        customRight
                    ) : (
                        <div className="relative" ref={userDropdownRef}>
                            <button
                                onClick={toggleUserDropdown}
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
                                <ChevronDown size={16} className={`text-white/80 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown menu */}
                            <AnimatePresence mode="sync">
                                {showUserDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 z-50"
                                    >
                                        <button
                                            className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                            onClick={() => {
                                                setShowUserDropdown(false);
                                                navigate('/profile');
                                            }}
                                        >
                                            <User size={16} className="mr-2 text-gray-500" />
                                            <span>Hồ sơ cá nhân</span>
                                        </button>
                                        <button
                                            className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                            onClick={() => {
                                                setShowUserDropdown(false);
                                                navigate('/history');
                                            }}
                                        >
                                            <History size={16} className="mr-2 text-gray-500" />
                                            <span>Lịch sử trò chuyện</span>
                                        </button>
                                        <button
                                            className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                            onClick={() => {
                                                setShowUserDropdown(false);
                                                navigate('/admin');
                                            }}
                                        >
                                            <span>Trang quản trị</span>
                                        </button>
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