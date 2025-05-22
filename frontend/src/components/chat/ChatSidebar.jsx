import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, History, MessageSquare } from 'lucide-react';

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
    getDisplayTitle
}) => {
    const navigate = useNavigate();

    // Lọc và sắp xếp lịch sử chat
    const sortedFilteredChats = React.useMemo(() => {
        if (!chatHistory) return [];

        return [...chatHistory]
            .filter(chat =>
                (chat.title?.toLowerCase().includes(searchQuery.toLowerCase()) || '') &&
                chat.status === 'active'
            )
            .sort((a, b) =>
                new Date(b.updated_at || b.date) - new Date(a.updated_at || a.date)
            )
            .slice(0, 5);
    }, [chatHistory, searchQuery]);

    return (
        <div
            className={`fixed inset-y-0 left-0 z-30 w-72 bg-white shadow-xl transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:z-10 md:mt-[73px] md:h-[calc(100vh-73px)]`}
        >
            <div className="flex flex-col h-full">
                {/* Mobile - Header */}
                <div className="md:hidden bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 px-4">
                    <div className="flex items-center justify-between">
                        <button onClick={() => navigate('/')} className="flex items-center">
                            <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center mr-2 backdrop-blur-sm">
                                <MessageSquare size={20} className="text-white" />
                            </div>
                            <h1 className="text-lg font-bold text-white">CongBot</h1>
                        </button>

                        {/* Close button */}
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

                {/* Chat history */}
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

                        {sortedFilteredChats.length > 0 ? (
                            <div className="space-y-2">
                                {sortedFilteredChats.map((chat) => (
                                    <button
                                        key={chat.id}
                                        className={`flex items-center w-full py-2.5 px-3.5 rounded-lg transition-all duration-200 ${currentChatId === chat.id
                                            ? 'bg-green-50 text-green-700 border-l-4 border-green-600 shadow-sm'
                                            : 'hover:bg-gray-50 text-gray-700'
                                            }`}
                                        onClick={() => {
                                            switchChat(chat.id);
                                            if (isMobile) {
                                                setIsSidebarOpen(false);
                                            }
                                        }}
                                    >
                                        <div className="flex-1 text-left overflow-hidden">
                                            <p className="truncate text-sm font-medium">{getDisplayTitle(chat)}</p>
                                            <p className="text-xs text-gray-500 mt-1">{chat.date}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-500 text-sm bg-gray-50 rounded-xl">
                                {searchQuery
                                    ? "Không tìm thấy cuộc trò chuyện nào"
                                    : "Chưa có lịch sử trò chuyện"}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatSidebar;