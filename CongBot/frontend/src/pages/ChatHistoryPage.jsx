import React, { useState } from 'react';
import { ChevronLeft, Search, Calendar, Trash2, Download, MessageSquare, Filter, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const ChatHistoryPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedChats, setSelectedChats] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // Mock data for chat history
  const mockChatHistory = [
    {
      id: 'chat1',
      title: 'Hỏi về trợ cấp thương binh',
      snippet: 'Tôi muốn hỏi về mức trợ cấp hàng tháng cho thương binh hạng 1/4 theo quy định mới nhất. Mức trợ cấp này được quy định ở đâu và thay đổi như thế nào qua các năm?',
      date: '12/03/2024',
      time: '14:30',
      messageCount: 8
    },
    {
      id: 'chat2',
      title: 'Thủ tục xác nhận liệt sĩ',
      snippet: 'Làm thế nào để xác nhận một người là liệt sĩ? Các giấy tờ cần thiết và quy trình thực hiện có những bước nào? Thời gian giải quyết thường mất bao lâu?',
      date: '10/03/2024',
      time: '09:15',
      messageCount: 12
    },
    {
      id: 'chat3',
      title: 'Chế độ ưu đãi giáo dục',
      snippet: 'Con của người có công với cách mạng được hưởng những ưu đãi gì về giáo dục? Mức hỗ trợ học phí cụ thể và điều kiện để được hưởng chính sách này là gì?',
      date: '05/03/2024',
      time: '16:45',
      messageCount: 6
    },
    {
      id: 'chat4',
      title: 'Miễn giảm tiền sử dụng đất',
      snippet: 'Người có công được miễn giảm tiền sử dụng đất như thế nào? Tỷ lệ miễn giảm cho từng đối tượng và diện tích được miễn giảm tối đa là bao nhiêu?',
      date: '28/02/2024',
      time: '10:20',
      messageCount: 15
    },
    {
      id: 'chat5',
      title: 'Chế độ điều dưỡng phục hồi sức khỏe',
      snippet: 'Đối tượng nào được hưởng chế độ điều dưỡng phục hồi sức khỏe? Mức hỗ trợ và thời gian điều dưỡng được quy định như thế nào? Địa điểm điều dưỡng ở đâu?',
      date: '20/02/2024',
      time: '13:45',
      messageCount: 10
    },
    {
      id: 'chat6',
      title: 'Hỗ trợ người có công về nhà ở',
      snippet: 'Người có công với cách mạng có chính sách hỗ trợ về nhà ở không? Mức hỗ trợ như thế nào? Quy trình đăng ký và thời gian thực hiện ra sao?',
      date: '15/02/2024',
      time: '11:30',
      messageCount: 7
    }
  ];

  const filteredChats = mockChatHistory.filter(chat => {
    // Filter by search term
    const matchSearch = chat.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        chat.snippet.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by time period
    const chatDate = new Date(chat.date.split('/').reverse().join('/'));
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

  // Pagination
  const totalPages = Math.ceil(filteredChats.length / itemsPerPage);
  const currentChats = filteredChats.slice(
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
    }).then((result) => {
      if (result.isConfirmed) {
        // In a real app, this would make an API call to delete the selected chats
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
        setSelectedChats([]);
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

  const navigateToChat = () => {
    navigate('/chat');
  };

  const openChatDetail = (chatId) => {
    navigate(`/chat?id=${chatId}`);
  };

  // Chỉ giữ lại hiệu ứng chuyển trang
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const getDateLabel = (dateString) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const chatDate = new Date(dateString.split('/').reverse().join('/'));
    
    if (chatDate.toDateString() === today.toDateString()) {
      return 'Hôm nay';
    } else if (chatDate.toDateString() === yesterday.toDateString()) {
      return 'Hôm qua';
    } else {
      return dateString;
    }
  };

  return (
    <motion.div 
      className="min-h-screen bg-gray-50 flex flex-col"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Header */}
      <header className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 shadow-lg">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center relative">
            <button 
              onClick={navigateToChat}
              className="flex items-center text-white hover:text-green-100 transition-colors absolute left-0"
            >
              <ChevronLeft size={20} />
              <span className="text-sm font-medium">Quay lại chat</span>
            </button>
            <h1 className="text-lg font-bold">Lịch sử trò chuyện</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto py-4 px-4 sm:px-6 overflow-hidden">
        {/* Search and filter bar */}
        <div className="bg-white rounded-xl shadow-sm p-3 mb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm cuộc trò chuyện..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="relative">
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="block pl-9 pr-10 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 appearance-none bg-white"
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
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <Filter size={12} className="text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        {selectedChats.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between bg-green-50 p-2.5 rounded-xl mb-4 border border-green-100 shadow-sm"
          >
            <div className="flex items-center">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={selectedChats.length === currentChats.length && currentChats.length > 0}
                  onChange={selectAllChats}
                  className="opacity-0 absolute h-4 w-4 cursor-pointer"
                />
                <div className={`w-4 h-4 border rounded flex items-center justify-center 
                  ${selectedChats.length === currentChats.length && currentChats.length > 0 
                    ? 'bg-green-500 border-green-500' 
                    : 'border-gray-300'}`}
                >
                  {selectedChats.length === currentChats.length && currentChats.length > 0 && (
                    <Check size={12} className="text-white" />
                  )}
                </div>
              </div>
              <span className="ml-2 text-gray-700 text-xs">
                Đã chọn {selectedChats.length} cuộc trò chuyện
              </span>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={handleExportSelected}
                className="flex items-center px-2.5 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
              >
                <Download size={14} className="mr-1" />
                <span>Xuất</span>
              </button>
              <button 
                onClick={handleDeleteSelected}
                className="flex items-center px-2.5 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-xs font-medium"
              >
                <Trash2 size={14} className="mr-1" />
                <span>Xóa</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Chat history list */}
        <div className="space-y-3">
          {currentChats.length > 0 ? (
            currentChats.map(chat => (
              <div
                key={chat.id}
                className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-300 
                  ${selectedChats.includes(chat.id) 
                    ? 'border-2 border-green-500 shadow-md' 
                    : 'border border-gray-100 hover:border-green-100 hover:shadow'}`}
              >
                <div className="px-4 py-3 flex">
                  <div className="mr-2 flex items-start pt-1">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={selectedChats.includes(chat.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectChat(chat.id);
                        }}
                        className="opacity-0 absolute h-4 w-4 cursor-pointer"
                      />
                      <div className={`w-4 h-4 border rounded flex items-center justify-center 
                        ${selectedChats.includes(chat.id) 
                          ? 'bg-green-500 border-green-500' 
                          : 'border-gray-300'}`}
                      >
                        {selectedChats.includes(chat.id) && (
                          <Check size={12} className="text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div 
                    className="flex-1 cursor-pointer" 
                    onClick={() => openChatDetail(chat.id)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-sm font-medium text-gray-900">{chat.title}</h3>
                      <div className="ml-2 flex-shrink-0">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {getDateLabel(chat.date)}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 mb-1.5 text-xs line-clamp-2 leading-relaxed">{chat.snippet}</p>
                    <div className="flex items-center text-xs text-gray-500">
                      <span className="mr-3">{chat.time}</span>
                      <div className="flex items-center">
                        <MessageSquare size={12} className="mr-1" />
                        <span>{chat.messageCount} tin nhắn</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-2 flex items-start">
                    <button 
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        Swal.fire({
                          title: 'Xác nhận xóa',
                          text: `Bạn có chắc chắn muốn xóa cuộc trò chuyện "${chat.title}"?`,
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
                        }).then((result) => {
                          if (result.isConfirmed) {
                            toggleSelectChat(chat.id);
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
                          }
                        });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-white rounded-xl shadow-sm">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                <MessageSquare size={20} />
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1">Không tìm thấy cuộc trò chuyện nào</h3>
              <p className="text-gray-500 text-sm">
                {searchTerm 
                  ? `Không có kết quả nào phù hợp với "${searchTerm}"`
                  : "Không có cuộc trò chuyện nào trong khoảng thời gian đã chọn"}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-5 flex justify-center">
            <nav className="flex items-center space-x-1">
              <button 
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
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
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
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
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
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
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center text-xs text-gray-500">
            <p>© 2024 Chatbot Hỗ Trợ Chính Sách Người Có Công. Bản quyền thuộc về đồ án tốt nghiệp CNTT.</p>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};

export default ChatHistoryPage;