// apiService.js
const API_URL = 'http://localhost:8001';

/**
 * Gửi câu hỏi đến API backend để nhận câu trả lời
 * @param {string} query - Câu hỏi của người dùng
 * @returns {Promise<Object>} - Kết quả từ API
 */
export const askQuestion = async (query) => {
  try {
    const response = await fetch(`${API_URL}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling API:', error);
    throw error;
  }
};

/**
 * Mock API để lấy lịch sử chat của người dùng
 * @param {string} userId - ID của người dùng
 * @returns {Promise<Array>} - Danh sách lịch sử chat
 */
export const getChatHistory = async (userId) => {
  // Mock data - Sẽ thay thế bằng API thực tế kết nối MongoDB sau này
  const mockHistory = [
    { id: 'chat1', title: 'Hỏi về trợ cấp thương binh', date: '12/03/2024' },
    { id: 'chat2', title: 'Thủ tục xác nhận liệt sĩ', date: '10/03/2024' },
    { id: 'chat3', title: 'Chế độ ưu đãi giáo dục', date: '05/03/2024' },
    { id: 'chat4', title: 'Hướng dẫn làm hồ sơ', date: '01/03/2024' },
    { id: 'chat5', title: 'Tìm hiểu trợ cấp nuôi dưỡng', date: '28/02/2024' },
  ];
  
  // Giả lập delay từ server
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockHistory);
    }, 300);
  });
};

/**
 * Mock API để lấy thông tin người dùng
 * @param {string} userId - ID của người dùng
 * @returns {Promise<Object>} - Thông tin người dùng
 */
export const getUserInfo = async (userId) => {
  // Mock data - Sẽ thay thế bằng API thực tế kết nối MongoDB sau này
  const mockUser = {
    id: 'user123',
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@gmail.com',
    avatar: null // URL hình đại diện (nếu có)
  };
  
  // Giả lập delay từ server
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockUser);
    }, 200);
  });
};