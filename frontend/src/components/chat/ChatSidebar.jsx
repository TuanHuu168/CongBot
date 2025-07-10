import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, History, MessageSquare, Edit2, Trash2, MoreVertical, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { updateChatTitle, deleteChat } from '../../apiService';
import { formatDate, getDateLabel } from '../../utils/formatUtils';
import Swal from 'sweetalert2';

const ChatSidebar = ({
    isMobile,
    isSidebarOpen,
    setIsSidebarOpen,
    chatHistory,
    currentChatId,
    searchQuery,
    setSearchQuery,
    switchChat,
    handleNewChat,
    getDisplayTitle,
    fetchChatHistory
}) => {
    const navigate = useNavigate();
    const [editingChatId, setEditingChatId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null);

    // Nhóm chat theo thời gian
    const groupChatsByTime = React.useMemo(() => {
        if (!chatHistory) return {};

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        const groups = {
            'Hôm nay': [],
            'Hôm qua': [],
            'Tuần này': [],
            'Tháng này': [],
            'Cũ hơn': []
        };

        const filteredChats = chatHistory.filter(chat =>
            (chat.title?.toLowerCase().includes(searchQuery.toLowerCase()) || '') &&
            chat.status === 'active'
        );

        filteredChats.forEach(chat => {
            const chatDate = new Date(chat.updated_at || chat.created_at);
            const chatDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());

            if (chatDay.getTime() === today.getTime()) {
                groups['Hôm nay'].push(chat);
            } else if (chatDay.getTime() === yesterday.getTime()) {
                groups['Hôm qua'].push(chat);
            } else if (chatDate >= weekAgo) {
                groups['Tuần này'].push(chat);
            } else if (chatDate >= monthAgo) {
                groups['Tháng này'].push(chat);
            } else {
                groups['Cũ hơn'].push(chat);
            }
        });

        return groups;
    }, [chatHistory, searchQuery]);

    const handleEditChat = (chatId, currentTitle) => {
        setEditingChatId(chatId);
        setEditTitle(getDisplayTitle({ id: chatId, title: currentTitle }));
        setOpenMenuId(null);
    };

    const handleSaveEdit = async (chatId) => {
        if (!editTitle.trim()) return;

        try {
            await updateChatTitle(chatId, editTitle.trim());
            await fetchChatHistory();
            setEditingChatId(null);
            setEditTitle('');
        } catch (error) {
            console.error('Error updating chat title:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Không thể cập nhật tên cuộc trò chuyện',
                confirmButtonColor: '#10b981'
            });
        }
    };

    const handleDeleteChat = (chatId, title) => {
        Swal.fire({
            title: 'Xác nhận xóa',
            text: `Bạn có chắc chắn muốn xóa cuộc trò chuyện "${title}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteChat(chatId);
                    await fetchChatHistory();
                    setOpenMenuId(null);

                    Swal.fire({
                        icon: 'success',
                        title: 'Đã xóa',
                        text: 'Cuộc trò chuyện đã được xóa',
                        confirmButtonColor: '#10b981',
                        timer: 1500
                    });
                } catch (error) {
                    console.error('Error deleting chat:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Lỗi',
                        text: 'Không thể xóa cuộc trò chuyện',
                        confirmButtonColor: '#10b981'
                    });
                }
            }
        });
    };

    const ChatItem = ({ chat }) => {
        const isActive = currentChatId === chat.id;
        const isEditing = editingChatId === chat.id;
        const isMenuOpen = openMenuId === chat.id;

        return (
            <div className={`group relative rounded-lg transition-all duration-200 ${isActive ? 'bg-green-50 text-green-700 border-l-4 border-green-600' : 'hover:bg-gray-50'
                }`}>
                {isEditing ? (
                    <div className="p-2">
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(chat.id);
                                if (e.key === 'Escape') {
                                    setEditingChatId(null);
                                    setEditTitle('');
                                }
                            }}
                            className="w-full px-2 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                            autoFocus
                            onBlur={() => handleSaveEdit(chat.id)}
                        />
                    </div>
                ) : (
                    <div className="flex items-center">
                        <button
                            className="flex-1 text-left p-2"
                            onClick={() => {
                                switchChat(chat.id);
                                if (isMobile) setIsSidebarOpen(false);
                            }}
                        >
                            <p className="truncate text-sm font-medium">{getDisplayTitle(chat)}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {formatDate(chat.updated_at || chat.created_at)}
                            </p>
                        </button>

                        <div className="relative">
                            <button
                                className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isMenuOpen ? 'opacity-100' : ''
                                    }`}
                                onClick={() => setOpenMenuId(isMenuOpen ? null : chat.id)}
                            >
                                <MoreVertical size={14} className="text-gray-400 hover:text-gray-600" />
                            </button>

                            <AnimatePresence>
                                {isMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border py-1 z-50 min-w-[120px]"
                                    >
                                        <button
                                            className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                            onClick={() => handleEditChat(chat.id, chat.title)}
                                        >
                                            <Edit2 size={14} className="mr-2" />
                                            Đổi tên
                                        </button>
                                        <button
                                            className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                            onClick={() => handleDeleteChat(chat.id, getDisplayTitle(chat))}
                                        >
                                            <Trash2 size={14} className="mr-2" />
                                            Xóa
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:z-10 md:h-[calc(100vh-70px)]`}
        >
            <div className="flex flex-col h-full">
                {/* Mobile - Header */}
                <div className="md:hidden bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 px-4">
                    <div className="flex items-center justify-between">
                        <button onClick={() => navigate('/')} className="flex items-center">
                            <div className="h-10 w-10 bg-white/5 rounded-lg flex items-center justify-center mr-2 backdrop-blur-sm">
                                <MessageSquare size={20} className="text-white" />
                            </div>
                            <h1 className="text-lg font-bold text-white">CongBot</h1>
                        </button>

                        <button
                            className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* New chat button and search */}
                <div className="p-4">
                    <button
                        onClick={handleNewChat}
                        className="flex items-center justify-center w-full py-2.5 px-3.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg mb-4 transition-colors duration-200 shadow-sm hover:opacity-90"
                    >
                        <Plus size={18} className="mr-2" />
                        <span className="font-medium">Cuộc trò chuyện mới</span>
                    </button>

                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder="Tìm kiếm cuộc trò chuyện..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-2.5 pl-9 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                        />
                        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                {/* Lịch sử chat */}
                <div className="px-4 flex-1 overflow-y-auto">
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                                <History size={16} className="mr-2 text-green-600" />
                                <h2 className="text-sm font-semibold text-gray-800">Lịch sử trò chuyện</h2>
                            </div>
                            <button
                                className="text-xs text-green-600 hover:text-green-700 font-medium"
                                onClick={() => navigate('/history')}
                            >
                                Xem tất cả
                            </button>
                        </div>

                        {Object.entries(groupChatsByTime).map(([timeGroup, chats]) => (
                            chats.length > 0 && (
                                <div key={timeGroup} className="mb-4">
                                    <h3 className="text-xs font-medium text-gray-500 mb-2 px-2">{timeGroup}</h3>
                                    <div className="space-y-1">
                                        {chats.map((chat) => (
                                            <ChatItem key={chat.id} chat={chat} />
                                        ))}
                                    </div>
                                </div>
                            )
                        ))}

                        {Object.values(groupChatsByTime).every(group => group.length === 0) && (
                            <div className="text-center py-10 text-gray-500 text-sm bg-gray-50 rounded-xl">
                                {searchQuery
                                    ? "Không tìm thấy cuộc trò chuyện nào"
                                    : "Chưa có lịch sử trò chuyện"}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bấm ra ngoài để đóng menu */}
            {openMenuId && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOpenMenuId(null)}
                />
            )}
        </div>
    );
};

export default ChatSidebar;