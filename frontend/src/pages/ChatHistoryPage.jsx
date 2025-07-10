import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../ChatContext';
import { getUserChats, getChatMessages, deleteChat, deleteChatsBatch } from '../apiService';
import {
  Search, Calendar, Trash2, Filter, Download, Clock, ArrowUpDown, RefreshCw, Grid, BookOpen, MessageSquare
} from 'lucide-react';

import TopNavBar from '../components/common/TopNavBar';
import ErrorMessage from '../components/common/ErrorMessage';
import HistoryItem from '../components/history/HistoryItem';
import { formatDate, getDateLabel, pageVariants, itemVariants, showConfirm, showSuccess, showError } from '../utils/formatUtils';

const ChatHistoryPage = () => {
  const navigate = useNavigate();
  const { user, chatHistory, setChatHistory, switchChat, isLoading: contextLoading, setIsLoading: setContextLoading } = useChat();

  // State quản lý tìm kiếm và lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedChats, setSelectedChats] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [localError, setLocalError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatDetails, setChatDetails] = useState({});
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [refreshing, setRefreshing] = useState(false);
  const itemsPerPage = 8;

  // Tải lịch sử chat khi component mount
  useEffect(() => {
    loadChatHistory();
  }, []);

  // Tải danh sách chat và chi tiết
  const loadChatHistory = async () => {
    setIsLoading(true);
    setContextLoading(true);
    try {
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      if (!userId) {
        throw new Error('Bạn cần đăng nhập để xem lịch sử trò chuyện');
      }

      const chatsData = await getUserChats(userId);
      const formattedChats = chatsData.map(chat => ({
        id: chat.id,
        title: chat.title || "Cuộc trò chuyện mới",
        date: new Date(chat.created_at).toLocaleDateString('vi-VN'),
        updated_at: chat.updated_at || chat.created_at,
        time: new Date(chat.updated_at || chat.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        status: chat.status || 'active'
      }));

      setChatHistory(formattedChats);

      // Tải chi tiết cho 12 chat đầu tiên
      const details = {};
      for (const chat of formattedChats.slice(0, 12)) {
        try {
          const chatData = await getChatMessages(chat.id);
          if (chatData && chatData.messages) {
            details[chat.id] = {
              messageCount: chatData.messages.length,
              snippet: chatData.messages.length > 0 ? (
                chatData.messages[0].text.substring(0, 150) + (chatData.messages[0].text.length > 150 ? '...' : '')
              ) : "",
              lastMessageDate: chatData.messages.length > 0 ? chatData.messages[chatData.messages.length - 1].timestamp : null
            };
          }
        } catch (error) {
          console.error(`Lỗi khi tải chi tiết chat ${chat.id}:`, error);
          details[chat.id] = { messageCount: 0, snippet: "" };
        }
      }
      setChatDetails(details);
    } catch (error) {
      console.error('Lỗi khi tải lịch sử chat:', error);
      setLocalError('Không thể tải lịch sử trò chuyện. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
      setContextLoading(false);
    }
  };

  // Làm mới danh sách chat
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadChatHistory();
    setRefreshing(false);
  };

  // Lọc chat theo từ khóa và thời gian
  const filteredChats = useMemo(() => {
    return (chatHistory || []).filter(chat => {
      const title = chat.title || "";
      const matchSearch = searchTerm ? title.toLowerCase().includes(searchTerm.toLowerCase()) : true;

      const chatDate = new Date(chat.updated_at || chat.date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      let matchPeriod = true;
      if (selectedPeriod === 'today') {
        matchPeriod = chatDate.toDateString() === today.toDateString();
      } else if (selectedPeriod === 'yesterday') {
        matchPeriod = chatDate.toDateString() === yesterday.toDateString();
      } else if (selectedPeriod === 'week') {
        matchPeriod = chatDate >= lastWeek;
      } else if (selectedPeriod === 'month') {
        matchPeriod = chatDate >= lastMonth;
      }

      return matchSearch && matchPeriod;
    });
  }, [chatHistory, searchTerm, selectedPeriod]);

  // Sắp xếp danh sách chat đã lọc
  const sortedFilteredChats = useMemo(() => {
    return [...filteredChats].sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.updated_at || a.date);
        const dateB = new Date(b.updated_at || b.date);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else if (sortBy === 'title') {
        const titleA = a.title || "";
        const titleB = b.title || "";
        return sortOrder === 'desc' ? titleB.localeCompare(titleA) : titleA.localeCompare(titleB);
      }
      return 0;
    });
  }, [filteredChats, sortBy, sortOrder]);

  // Phân trang
  const totalPages = Math.ceil(sortedFilteredChats.length / itemsPerPage);
  const currentChats = sortedFilteredChats.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Chọn/bỏ chọn chat
  const toggleSelectChat = (chatId) => {
    setSelectedChats(prev => prev.includes(chatId) 
      ? prev.filter(id => id !== chatId) 
      : [...prev, chatId]
    );
  };

  // Chọn tất cả chat hiện tại
  const selectAllChats = () => {
    setSelectedChats(selectedChats.length === currentChats.length ? [] : currentChats.map(chat => chat.id));
  };

  // Xóa các chat đã chọn
  const handleDeleteSelected = () => {
    showConfirm(`Bạn có chắc chắn muốn xóa ${selectedChats.length} cuộc trò chuyện đã chọn?`, 'Xác nhận xóa').then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          await deleteChatsBatch(selectedChats);
          setChatHistory(prevHistory => prevHistory.filter(chat => !selectedChats.includes(chat.id)));
          showSuccess(`Đã xóa ${selectedChats.length} cuộc trò chuyện`);
          setSelectedChats([]);
        } catch (error) {
          console.error('Lỗi khi xóa chat:', error);
          showError(error.detail || 'Không thể xóa cuộc trò chuyện. Vui lòng thử lại sau.');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Điều hướng đến trang chat
  const navigateToChat = (chatId = null) => {
    if (chatId) {
      switchChat(chatId).then(() => {
        navigate('/chat', { state: { chatId: chatId, fromHistory: true } });
      }).catch(error => {
        console.error('Lỗi khi chuyển chat:', error);
        showError('Không thể tải nội dung cuộc trò chuyện này. Vui lòng thử lại sau.');
      });
    } else {
      navigate('/chat');
    }
  };

  // Xóa một chat cụ thể
  const handleDeleteChat = (chatId, title) => {
    showConfirm(`Bạn có chắc chắn muốn xóa cuộc trò chuyện "${title}"?`, 'Xác nhận xóa').then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          await deleteChat(chatId);
          setChatHistory(prevHistory => prevHistory.filter(chat => chat.id !== chatId));
          showSuccess('Cuộc trò chuyện đã được xóa');
          if (selectedChats.includes(chatId)) {
            setSelectedChats(selectedChats.filter(id => id !== chatId));
          }
        } catch (error) {
          console.error('Lỗi khi xóa chat:', error);
          showError(error.detail || 'Không thể xóa cuộc trò chuyện. Vui lòng thử lại sau.');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-50 flex flex-col"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <AnimatePresence>
        {localError && <ErrorMessage message={localError} onClose={() => setLocalError(null)} />}
      </AnimatePresence>

      <TopNavBar
        title="Lịch sử trò chuyện"
        showBackButton={true}
        backButtonDestination="/chat"
        backButtonText="Quay lại chat"
        user={user}
      />

      <main className="flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 w-full">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar bộ lọc */}
          <motion.div
            className="md:w-72 lg:w-80 flex-shrink-0 space-y-5"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Tìm kiếm */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Search size={14} className="mr-2 text-green-600" />
                Tìm kiếm
              </h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm kiếm cuộc trò chuyện..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full py-2.5 pl-10 pr-3 text-sm border border-gray-200 rounded-xl shadow-sm focus:ring-green-500 focus:border-green-500 focus:outline-none"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
              </div>
            </div>

            {/* Bộ lọc */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Filter size={14} className="mr-2 text-green-600" />
                Bộ lọc
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Thời gian</label>
                  <div className="relative">
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="block w-full appearance-none pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 focus:outline-none bg-white"
                    >
                      <option value="all">Tất cả thời gian</option>
                      <option value="today">Hôm nay</option>
                      <option value="yesterday">Hôm qua</option>
                      <option value="week">Tuần này</option>
                      <option value="month">Tháng này</option>
                    </select>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar size={14} className="text-gray-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Sắp xếp theo</label>
                  <div className="flex">
                    <div className="relative flex-grow">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="block w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-l-lg shadow-sm focus:ring-green-500 focus:border-green-500 focus:outline-none bg-white"
                      >
                        <option value="date">Thời gian</option>
                        <option value="title">A-Z</option>
                      </select>
                    </div>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="flex-shrink-0 px-3 py-2 bg-gray-100 border border-gray-200 rounded-r-lg hover:bg-gray-200 transition-colors duration-200"
                    >
                      <ArrowUpDown size={16} className={`transform transition-transform ${sortOrder === 'asc' ? 'rotate-0' : 'rotate-180'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Thống kê */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Clock size={14} className="mr-2 text-green-600" />
                Thống kê
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Tổng số cuộc trò chuyện:</span>
                  <span className="text-sm font-medium text-gray-700">{chatHistory.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Hiển thị:</span>
                  <span className="text-sm font-medium text-gray-700">{filteredChats.length} cuộc trò chuyện</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Đã chọn:</span>
                  <span className="text-sm font-medium text-gray-700">{selectedChats.length} cuộc trò chuyện</span>
                </div>
              </div>
            </div>

            {/* Thao tác hàng loạt */}
            {selectedChats.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Thao tác</h2>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => showSuccess('Tính năng xuất dữ liệu sẽ được cập nhật trong phiên bản tới')}
                    className="flex items-center justify-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                  >
                    <Download size={14} className="mr-1.5" />
                    <span>Xuất ({selectedChats.length})</span>
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    <span>Xóa ({selectedChats.length})</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Nội dung chính */}
          <div className="flex-1">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-sm">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
                <p className="text-gray-600">Đang tải lịch sử trò chuyện...</p>
              </div>
            )}

            {!isLoading && (
              <>
                {/* Header với checkbox chọn tất cả */}
                {currentChats.length > 0 && (
                  <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-xl shadow-sm">
                    <div className="flex items-center">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={selectedChats.length === currentChats.length && currentChats.length > 0}
                          onChange={selectAllChats}
                          className="opacity-0 absolute h-5 w-5 cursor-pointer"
                        />
                        <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors duration-200 
                          ${selectedChats.length === currentChats.length && currentChats.length > 0
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300'}`}
                        >
                          {selectedChats.length === currentChats.length && currentChats.length > 0 && (
                            <div className="w-2 h-3.5 border-r-2 border-b-2 border-white transform rotate-45 translate-y-[-1px]"></div>
                          )}
                        </div>
                      </div>
                      <span className="ml-2 text-gray-700 text-sm">
                        Chọn tất cả ({currentChats.length})
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <button onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} className="flex items-center hover:text-green-600 transition-colors">
                        {viewMode === 'list' ? (
                          <>
                            <Grid size={16} className="mr-1" />
                            <span>Chuyển dạng lưới</span>
                          </>
                        ) : (
                          <>
                            <BookOpen size={16} className="mr-1" />
                            <span>Chuyển dạng danh sách</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Trạng thái trống */}
                {currentChats.length === 0 && (
                  <motion.div
                    variants={itemVariants}
                    initial="initial"
                    animate="animate"
                    className="text-center py-16 bg-white rounded-xl shadow-sm"
                  >
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-green-500 mb-4">
                      <MessageSquare size={28} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Không tìm thấy cuộc trò chuyện nào</h3>
                    <p className="text-gray-500 text-base max-w-md mx-auto">
                      {searchTerm
                        ? `Không có kết quả nào phù hợp với "${searchTerm}"`
                        : selectedPeriod !== 'all'
                          ? "Không có cuộc trò chuyện nào trong khoảng thời gian đã chọn"
                          : "Bạn chưa có cuộc trò chuyện nào. Hãy bắt đầu một cuộc trò chuyện mới."}
                    </p>
                    <button
                      onClick={() => navigateToChat()}
                      className="mt-6 px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity inline-flex items-center"
                    >
                      <span>Trở về trang chat</span>
                    </button>
                  </motion.div>
                )}

                {/* Hiển thị dạng danh sách */}
                {viewMode === 'list' && currentChats.length > 0 && (
                  <div className="space-y-3">
                    {currentChats.map((chat, index) => (
                      <motion.div
                        key={chat.id}
                        variants={itemVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ delay: index * 0.05 }}
                      >
                        <HistoryItem
                          chat={chat}
                          viewMode="list"
                          onDelete={handleDeleteChat}
                          onClick={() => navigateToChat(chat.id)}
                          chatDetails={chatDetails}
                          selectedChats={selectedChats}
                          toggleSelectChat={toggleSelectChat}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Hiển thị dạng lưới */}
                {viewMode === 'grid' && currentChats.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentChats.map((chat, index) => (
                      <motion.div
                        key={chat.id}
                        variants={itemVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ delay: index * 0.05 }}
                      >
                        <HistoryItem
                          chat={chat}
                          viewMode="grid"
                          onDelete={handleDeleteChat}
                          onClick={() => navigateToChat(chat.id)}
                          chatDetails={chatDetails}
                          selectedChats={selectedChats}
                          toggleSelectChat={toggleSelectChat}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Phân trang */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center">
                    <nav className="flex items-center space-x-1.5">
                      <button
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentPage === 1
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        Trước
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${currentPage === page
                            ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-sm'
                            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentPage === totalPages
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        Sau
                      </button>
                    </nav>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </motion.div>
  );
};

export default ChatHistoryPage;