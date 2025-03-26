import React, { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, Menu, MessageSquare, History, Info, LogOut, User, X, FileText } from 'lucide-react';

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Xin chào! Tôi là chatbot hỗ trợ chính sách người có công với cách mạng. Bạn có thể hỏi tôi bất kỳ thông tin nào về chính sách ưu đãi, trợ cấp, hoặc thủ tục hành chính liên quan đến người có công.' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeChat, setActiveChat] = useState('current');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (input.trim() === '') return;

    const userMessage = {
      id: messages.length + 1,
      sender: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate API call delay
    setTimeout(() => {
      const botResponse = {
        id: messages.length + 2,
        sender: 'bot',
        text: 'Đây là phản hồi mẫu. Trong ứng dụng thực tế, chatbot sẽ phản hồi dựa trên việc truy vấn cơ sở dữ liệu thông qua mô hình RAG và xử lý bằng Gemini hoặc model đã fine-tune.'
      };
      setMessages(prev => [...prev, botResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const historyChats = [
    { id: 'chat1', title: 'Hỏi về trợ cấp thương binh', date: '12/03/2024' },
    { id: 'chat2', title: 'Thủ tục xác nhận liệt sĩ', date: '10/03/2024' },
    { id: 'chat3', title: 'Chế độ ưu đãi giáo dục', date: '05/03/2024' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-green-800 text-white transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:z-0`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-green-700">
            <h1 className="text-xl font-bold">Chatbot Người Có Công</h1>
          </div>
          
          <div className="flex items-center p-4 border-b border-green-700">
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center mr-3">
              <User size={20} />
            </div>
            <div>
              <p className="font-medium">Nguyễn Văn A</p>
              <p className="text-sm text-green-200">nguyenvana@gmail.com</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <button 
                className="flex items-center w-full py-3 px-4 bg-green-700 hover:bg-green-600 rounded-lg mb-3 transition-colors"
                onClick={() => {
                  setMessages([
                    { id: 1, sender: 'bot', text: 'Xin chào! Tôi là chatbot hỗ trợ chính sách người có công với cách mạng. Bạn có thể hỏi tôi bất kỳ thông tin nào về chính sách ưu đãi, trợ cấp, hoặc thủ tục hành chính liên quan đến người có công.' },
                  ]);
                  setActiveChat('current');
                }}
              >
                <MessageSquare size={18} className="mr-2" />
                <span>Cuộc trò chuyện mới</span>
              </button>
              
              <div className="mb-3">
                <div className="flex items-center mb-2">
                  <History size={18} className="mr-2" />
                  <h2 className="text-lg font-medium">Lịch sử trò chuyện</h2>
                </div>
                
                <div className="space-y-2">
                  {historyChats.map((chat) => (
                    <button
                      key={chat.id}
                      className={`flex items-center w-full py-2 px-3 rounded-lg transition-colors ${
                        activeChat === chat.id ? 'bg-green-600' : 'hover:bg-green-700'
                      }`}
                      onClick={() => setActiveChat(chat.id)}
                    >
                      <div className="flex-1 text-left">
                        <p className="truncate">{chat.title}</p>
                        <p className="text-xs text-green-300">{chat.date}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-green-700">
            <button className="flex items-center w-full py-2 px-3 hover:bg-green-700 rounded-lg transition-colors">
              <Info size={18} className="mr-2" />
              <span>Hướng dẫn sử dụng</span>
            </button>
            
            <button className="flex items-center w-full py-2 px-3 hover:bg-green-700 rounded-lg transition-colors text-red-300 mt-2">
              <LogOut size={18} className="mr-2" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
        
        {/* Mobile close button */}
        <button
          className="absolute top-4 right-4 p-1 rounded-full bg-green-700 text-white md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-full">
        {/* Navbar */}
        <div className="bg-white border-b border-gray-200 flex items-center justify-between p-4">
          <button 
            className="md:hidden text-gray-600 hover:text-green-600"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          
          <div className="hidden md:block"></div> {/* Spacer for desktop */}
          
          <div className="ml-auto flex items-center space-x-4">
            <button className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg flex items-center transition-colors">
              <FileText size={18} className="mr-2" />
              <span>Tài liệu hướng dẫn</span>
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-lg px-4 py-3 max-w-[80%] ${
                    message.sender === 'user'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-white text-gray-800 rounded-lg px-4 py-3 max-w-[80%] border border-gray-200 shadow-sm">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSend} className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Nhập câu hỏi của bạn về chính sách người có công..."
                  className="w-full border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  rows={1}
                  style={{ 
                    minHeight: '56px',
                    maxHeight: '200px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                ></textarea>
              </div>
              
              <button
                type="submit"
                className={`p-3 rounded-full ${
                  input.trim() === ''
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                } transition-colors`}
                disabled={input.trim() === '' || isLoading}
              >
                <Send size={20} />
              </button>
            </form>
            
            <div className="text-xs text-gray-500 mt-2 text-center">
              Chatbot sử dụng kỹ thuật RAG để truy xuất thông tin từ cơ sở dữ liệu pháp luật về người có công.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;