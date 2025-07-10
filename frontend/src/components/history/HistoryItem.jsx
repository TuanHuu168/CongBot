import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Trash2, Clock, ArrowRight } from 'lucide-react';
import { formatDate } from '../../utils/formatUtils';

// Component hiển thị từng item trong lịch sử trò chuyện
const HistoryItem = ({
    chat,
    viewMode = 'list', // 'list' hoặc 'grid'
    onDelete,
    onClick,
    chatDetails,
    selectedChats,
    toggleSelectChat
}) => {
    // Định dạng tiêu đề cuộc trò chuyện
    const getChatTitle = (chat) => {
        if (!chat.title || chat.title === "") {
            return "Cuộc trò chuyện mới";
        }

        const isMongoId = /^[0-9a-fA-F]{24}$/.test(chat.title);
        if (isMongoId) {
            return "Cuộc trò chuyện mới";
        }

        return chat.title;
    };

    // Lấy số lượng tin nhắn cho cuộc trò chuyện
    const getMessageCount = (chatId) => {
        if (chatDetails[chatId] && chatDetails[chatId].messageCount !== undefined) {
            return chatDetails[chatId].messageCount;
        }
        return 0;
    };

    // Lấy đoạn trích nội dung cuộc trò chuyện
    const getSnippet = (chatId) => {
        if (chatDetails[chatId] && chatDetails[chatId].snippet) {
            return chatDetails[chatId].snippet;
        }
        return "Nhấn vào đây để xem chi tiết cuộc trò chuyện";
    };

    // Hiển thị dạng danh sách
    if (viewMode === 'list') {
        return (
            <motion.div
                className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md 
          ${selectedChats.includes(chat.id)
                        ? 'border-l-4 border-l-green-500 pl-1'
                        : 'border border-gray-100'}`}
            >
                <div className="px-5 py-4 flex">
                    {/* Checkbox chọn cuộc trò chuyện */}
                    <div className="mr-3 flex items-start pt-1">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={selectedChats.includes(chat.id)}
                                onChange={() => toggleSelectChat(chat.id)}
                                className="opacity-0 absolute h-5 w-5 cursor-pointer"
                            />
                            <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors duration-200
                ${selectedChats.includes(chat.id)
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300'}`}
                            >
                                {selectedChats.includes(chat.id) && (
                                    <div className="w-2 h-3.5 border-r-2 border-b-2 border-white transform rotate-45 translate-y-[-1px]"></div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Nội dung chính của cuộc trò chuyện */}
                    <div
                        className="flex-1 cursor-pointer"
                        onClick={onClick}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-base font-medium text-gray-900 truncate max-w-[250px] sm:max-w-md">
                                {getChatTitle(chat)}
                            </h3>
                            <div className="ml-2 flex-shrink-0">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {formatDate(chat.updated_at || chat.date)}
                                </span>
                            </div>
                        </div>
                        <p className="text-gray-600 mb-2 text-sm line-clamp-2 leading-relaxed">
                            {getSnippet(chat.id)}
                        </p>
                        <div className="flex items-center text-xs text-gray-500">
                            <div className="flex items-center">
                                <Clock size={14} className="mr-1" />
                                <span>{chat.time}</span>
                            </div>
                            <span className="mx-2">•</span>
                            <div className="flex items-center">
                                <MessageSquare size={14} className="mr-1" />
                                <span>{getMessageCount(chat.id)} tin nhắn</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Nút xóa */}
                    <div className="ml-3 flex items-start">
                        <button
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(chat.id, getChatTitle(chat));
                            }}
                            title="Xóa cuộc trò chuyện"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }
    else {
        // Hiển thị dạng lưới
        return (
            <motion.div
                className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md border 
          ${selectedChats.includes(chat.id)
                        ? 'border-green-500'
                        : 'border-gray-100'}`}
            >
                <div className="p-4">
                    {/* Header với checkbox và nút xóa */}
                    <div className="flex justify-between items-start mb-3">
                        <div className="relative mb-2 mr-2">
                            <input
                                type="checkbox"
                                checked={selectedChats.includes(chat.id)}
                                onChange={() => toggleSelectChat(chat.id)}
                                className="opacity-0 absolute h-5 w-5 cursor-pointer"
                            />
                            <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors duration-200
                ${selectedChats.includes(chat.id)
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300'}`}
                            >
                                {selectedChats.includes(chat.id) && (
                                    <div className="w-2 h-3.5 border-r-2 border-b-2 border-white transform rotate-45 translate-y-[-1px]"></div>
                                )}
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {formatDate(chat.updated_at || chat.date)}
                                </span>
                                <button
                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(chat.id, getChatTitle(chat));
                                    }}
                                    title="Xóa cuộc trò chuyện"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Nội dung cuộc trò chuyện */}
                    <div
                        className="cursor-pointer"
                        onClick={onClick}
                    >
                        <h3 className="text-base font-medium text-gray-900 truncate mb-2">
                            {getChatTitle(chat)}
                        </h3>
                        <p className="text-gray-600 mb-3 text-sm line-clamp-3 leading-relaxed h-16">
                            {getSnippet(chat.id)}
                        </p>
                        <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-100">
                            <div className="flex items-center">
                                <Clock size={12} className="mr-1" />
                                <span>{chat.time}</span>
                            </div>
                            <div className="flex items-center">
                                <MessageSquare size={12} className="mr-1" />
                                <span>{getMessageCount(chat.id)} tin nhắn</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }
};

export default HistoryItem;