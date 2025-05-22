// Định dạng tiêu đề hiển thị cho chat
export const getDisplayTitle = (chat) => {
  if (!chat || !chat.title) return "Cuộc trò chuyện mới";
  const isIdTitle = chat.title.match(/^[0-9a-f]{24}$/i);
  return (isIdTitle || chat.title.trim() === "") ? "Cuộc trò chuyện mới" : chat.title;
};

// Định dạng hiển thị thời gian
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  const now = new Date();

  // Kiểm tra xem có phải là hôm nay không
  if (date.toDateString() === now.toDateString()) {
    return `Hôm nay, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Kiểm tra xem có phải là hôm qua không
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Hôm qua, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Trường hợp khác
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Định dạng một label cho ngày (ngắn gọn hơn)
export const getDateLabel = (dateString) => {
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