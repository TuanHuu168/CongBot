import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Search, Calendar, Trash2, MessageSquare, Filter, Check, X, AlertCircle, Download, Clock, Info, ArrowUpDown, SlidersHorizontal, BookOpen, RefreshCw, Grid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../ChatContext';
import { getUserChats, getChatMessages, deleteChat, deleteChatsBatch } from '../apiService';
import Swal from 'sweetalert2';

const ChatHistoryPage = () => {
  const navigate = useNavigate();
  const { 
    chatHistory, 
    setChatHistory,
    switchChat,
    isLoading: contextLoading, 
    setIsLoading: setContextLoading 
  } = useChat();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedChats, setSelectedChats] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [localError, setLocalError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatDetails, setChatDetails] = useState({});
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [sortBy, setSortBy] = useState('date'); // 'date', 'title', 'messages'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [refreshing, setRefreshing] = useState(false);
  const itemsPerPage = 8;

  // Fetch chat history when component mounts
  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    setIsLoading(true);
    setContextLoading(true);
    try {
      const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      if (!userId) {
        throw new Error('Bạn cần đăng nhập để xem lịch sử trò chuyện');
      }
      
      const chatsData = await getUserChats(userId);
      
      // Format dữ liệu cho UI
      const formattedChats = chatsData.map(chat => ({
        id: chat.id,
        title: chat.title || "Cuộc trò chuyện mới",
        date: new Date(chat.created_at).toLocaleDateString('vi-VN'),
        updated_at: chat.updated_at || chat.created_at,
        time: new Date(chat.updated_at || chat.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        status: chat.status || 'active'
      }));
      
      setChatHistory(formattedChats);

      // Load message counts for each chat
      const loadMessageCounts = async () => {
        const details = {};
        for (const chat of formattedChats.slice(0, 12)) { // Giới hạn 12 chat đầu tiên để tránh quá nhiều request
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
            console.error(`Error fetching details for chat ${chat.id}:`, error);
            details[chat.id] = { messageCount: 0, snippet: "" };
          }
        }
        setChatDetails(details);
      };
      
      loadMessageCounts();
    } catch (error) {
      console.error('Error fetching chat history:', error);
      setLocalError('Không thể tải lịch sử trò chuyện. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
      setContextLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadChatHistory();
    setRefreshing(false);
  };

  // Filter chat history based on search term and time period
  const filteredChats = useMemo(() => {
    return (chatHistory || []).filter(chat => {
      // Filter by search term
      const title = chat.title || "";
      const matchSearch = searchTerm ? title.toLowerCase().includes(searchTerm.toLowerCase()) : true;
      
      // Filter by time period
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

  // Sort chats
  const sortedFilteredChats = useMemo(() => {
    return [...filteredChats].sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.updated_at || a.date);
        const dateB = new Date(b.updated_at || b.date);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else if (sortBy === 'title') {
        const titleA = a.title || "";
        const titleB = b.title || "";
        return sortOrder === 'desc' 
          ? titleB.localeCompare(titleA)
          : titleA.localeCompare(titleB);
      }
      return 0;
    });
  }, [filteredChats, sortBy, sortOrder, chatDetails]);

  // Pagination
  const totalPages = Math.ceil(sortedFilteredChats.length / itemsPerPage);
  const currentChats = sortedFilteredChats.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  const toggleSelectChat = (chatId) => {
    if (selectedChats.includes(chatId)) {
      setSelectedChats(selectedChats.filter(id => id !== chatId));
    } else {
      setSelectedChats([...selectedChats, chatId]);
    }
  };

  const selectAllChats = () => {
    if (selectedChats.length === currentChats.length) {
      setSelectedChats([]);
    } else {
      setSelectedChats(currentChats.map(chat => chat.id));
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'list' ? 'grid' : 'list');
  };

  const handleDeleteSelected = () => {
    Swal.fire({
      title: 'Xác nhận xóa',
      text: `Bạn có chắc chắn muốn xóa ${selectedChats.length} cuộc trò chuyện đã chọn?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
      background: '#fff',
      customClass: {
        popup: 'rounded-xl shadow-xl'
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          // Gọi API xóa hàng loạt
          await deleteChatsBatch(selectedChats);
          
          // Cập nhật state chatHistory
          setChatHistory(prevHistory => 
            prevHistory.filter(chat => !selectedChats.includes(chat.id))
          );
          
          Swal.fire({
            title: 'Đã xóa!',
            text: `Đã xóa ${selectedChats.length} cuộc trò chuyện`,
            icon: 'success',
            confirmButtonColor: '#10b981',
            timer: 1500,
            background: '#fff',
            customClass: {
              popup: 'rounded-xl shadow-xl'
            }
          });
          
          // Reset selection
          setSelectedChats([]);
        } catch (error) {
          console.error('Error deleting chats:', error);
          Swal.fire({
            title: 'Lỗi!',
            text: error.detail || 'Không thể xóa cuộc trò chuyện. Vui lòng thử lại sau.',
            icon: 'error',
            confirmButtonColor: '#10b981',
            background: '#fff',
            customClass: {
              popup: 'rounded-xl shadow-xl'
            }
          });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleExportSelected = () => {
    Swal.fire({
      title: 'Đang xuất dữ liệu',
      text: 'Đang chuẩn bị dữ liệu để tải xuống...',
      timer: 1500,
      timerProgressBar: true,
      didOpen: () => {
        Swal.showLoading();
      },
      background: '#fff',
      customClass: {
        popup: 'rounded-xl shadow-xl'
      }
    }).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Xuất thành công',
        text: `Đã xuất ${selectedChats.length} cuộc trò chuyện`,
        confirmButtonColor: '#10b981',
        background: '#fff',
        customClass: {
          popup: 'rounded-xl shadow-xl'
        }
      });
    });
  };

  const navigateToChat = (chatId = null) => {
    if (chatId) {
      // Navigate to specific chat
      switchChat(chatId).then(() => {
        navigate('/chat');
      }).catch(error => {
        console.error('Error switching chat:', error);
        Swal.fire({
          icon: 'error',
          title: 'Lỗi',
          text: 'Không thể tải nội dung cuộc trò chuyện này. Vui lòng thử lại sau.',
          confirmButtonColor: '#10b981'
        });
      });
    } else {
      // Navigate to main chat page
      navigate('/chat');
    }
  };

  const handleDeleteChat = (chatId, title) => {
    Swal.fire({
      title: 'Xác nhận xóa',
      text: `Bạn có chắc chắn muốn xóa cuộc trò chuyện "${title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
      background: '#fff',
      customClass: {
        popup: 'rounded-xl shadow-xl'
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsLoading(true);
          // Gọi API xóa cuộc trò chuyện
          await deleteChat(chatId);
          
          // Cập nhật state chatHistory
          setChatHistory(prevHistory => 
            prevHistory.filter(chat => chat.id !== chatId)
          );
          
          Swal.fire({
            title: 'Đã xóa!',
            text: 'Cuộc trò chuyện đã được xóa',
            icon: 'success',
            confirmButtonColor: '#10b981',
            timer: 1500,
            background: '#fff',
            customClass: {
              popup: 'rounded-xl shadow-xl'
            }
          });
          
          // Remove from selected if it was selected
          if (selectedChats.includes(chatId)) {
            setSelectedChats(selectedChats.filter(id => id !== chatId));
          }
        } catch (error) {
          console.error('Error deleting chat:', error);
          Swal.fire({
            title: 'Lỗi!',
            text: error.detail || 'Không thể xóa cuộc trò chuyện. Vui lòng thử lại sau.',
            icon: 'error',
            confirmButtonColor: '#10b981',
            background: '#fff',
            customClass: {
              popup: 'rounded-xl shadow-xl'
            }
          });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Format date display
  const getDateLabel = (dateString) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const chatDate = new Date(dateString);
    
    if (chatDate.toDateString() === today.toDateString()) {
      return 'Hôm nay';
    } else if (chatDate.toDateString() === yesterday.toDateString()) {
      return 'Hôm qua';
    } else {
      // Format: "DD/MM/YYYY"
      return chatDate.toLocaleDateString('vi-VN');
    }
  };

  // Format chat title
  const getChatTitle = (chat) => {
    if (!chat.title || chat.title === "") {
      return "Cuộc trò chuyện mới";
    }
    
    // Check if title is just a MongoDB ID
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(chat.title);
    if (isMongoId) {
      return "Cuộc trò chuyện mới";
    }
    
    return chat.title;
  };

  // Get message count for a chat
  const getMessageCount = (chatId) => {
    if (chatDetails[chatId] && chatDetails[chatId].messageCount !== undefined) {
      return chatDetails[chatId].messageCount;
    }
    return 0;
  };

  // Get snippet for a chat
  const getSnippet = (chatId) => {
    if (chatDetails[chatId] && chatDetails[chatId].snippet) {
      return chatDetails[chatId].snippet;
    }
    return "Nhấn vào đây để xem chi tiết cuộc trò chuyện";
  };

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.3 } }
  };

  const itemVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 10, transition: { duration: 0.2 } }
  };

  const filterVariants = {
    open: { height: 'auto', opacity: 1 },
    closed: { height: 0, opacity: 0 }
  };

  return (
    <motion.div 
      className="min-h-screen bg-gray-50 flex flex-col"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Error notification */}
      <AnimatePresence>
        {localError && (
          <motion.div
            className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AlertCircle size={16} className="mr-2" />
            <span>{localError}</span>
            <button
              className="ml-3 text-red-500 hover:text-red-700"
              onClick={() => setLocalError(null)}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between relative">
            <button 
              onClick={() => navigateToChat()}
              className="flex items-center text-white hover:text-green-100 transition-colors"
            >
              <ChevronLeft size={20} />
              <span className="text-sm font-medium ml-1">Quay lại chat</span>
            </button>
            <h1 className="text-lg font-bold">Lịch sử trò chuyện</h1>
            <button
              onClick={handleRefresh}
              className={`p-2 rounded-full hover:bg-white/10 transition-colors ${refreshing ? 'animate-spin' : ''}`}
              disabled={refreshing}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 w-full">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left sidebar - Search and filters */}
          <motion.div 
            className="md:w-72 lg:w-80 flex-shrink-0 space-y-5"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Search box */}
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

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Filter size={14} className="mr-2 text-green-600" />
                Bộ lọc
              </h2>
              
              <div className="space-y-4">
                {/* Time filter */}
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

                {/* Sort by */}
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
                      onClick={toggleSortOrder}
                      className="flex-shrink-0 px-3 py-2 bg-gray-100 border border-gray-200 rounded-r-lg hover:bg-gray-200 transition-colors duration-200"
                    >
                      <ArrowUpDown size={16} className={`transform transition-transform ${sortOrder === 'asc' ? 'rotate-0' : 'rotate-180'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Info size={14} className="mr-2 text-green-600" />
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

            {/* Action buttons */}
            {selectedChats.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Thao tác</h2>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={handleExportSelected}
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

          {/* Right side - Chat history list */}
          <div className="flex-1">
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-sm">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
                <p className="text-gray-600">Đang tải lịch sử trò chuyện...</p>
              </div>
            )}

            {/* Chat history list or grid */}
            {!isLoading && (
              <>
                {/* Select all checkbox */}
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
                            <Check size={14} className="text-white" />
                          )}
                        </div>
                      </div>
                      <span className="ml-2 text-gray-700 text-sm">
                        Chọn tất cả ({currentChats.length})
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <button onClick={toggleViewMode} className="flex items-center hover:text-green-600 transition-colors">
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

                {/* No results message */}
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
                      <ChevronLeft size={16} className="mr-1.5" />
                      <span>Trở về trang chat</span>
                    </button>
                  </motion.div>
                )}

                {/* List View */}
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
                        className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md 
                          ${selectedChats.includes(chat.id) 
                            ? 'border-l-4 border-l-green-500 pl-1' 
                            : 'border border-gray-100'}`}
                      >
                        <div className="px-5 py-4 flex">
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
                                  <Check size={14} className="text-white" />
                                )}
                              </div>
                            </div>
                          </div>
                          <div 
                            className="flex-1 cursor-pointer" 
                            onClick={() => navigateToChat(chat.id)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-base font-medium text-gray-900 truncate max-w-[250px] sm:max-w-md">
                                {getChatTitle(chat)}
                              </h3>
                              <div className="ml-2 flex-shrink-0">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {getDateLabel(chat.updated_at || chat.date)}
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
                          <div className="ml-3 flex items-start">
                            <button 
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteChat(chat.id, getChatTitle(chat));
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Grid View */}
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
                        className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md border 
                          ${selectedChats.includes(chat.id) 
                            ? 'border-green-500' 
                            : 'border-gray-100'}`}
                      >
                        <div className="p-4">
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
                                  <Check size={14} className="text-white" />
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {getDateLabel(chat.updated_at || chat.date)}
                                </span>
                                <button 
                                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteChat(chat.id, getChatTitle(chat));
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div
                            className="cursor-pointer" 
                            onClick={() => navigateToChat(chat.id)}
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
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center">
                    <nav className="flex items-center space-x-1.5">
                      <button 
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === 1 
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
                          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                            currentPage === page
                              ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-sm'
                              : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                      
                      <button 
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === totalPages 
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