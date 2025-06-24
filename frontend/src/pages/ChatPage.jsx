import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageSquare } from 'lucide-react';
import { useChatLogic } from '../hooks/useChatLogic';
import { getDisplayTitle, pageVariants } from '../utils/formatUtils';
import TopNavBar from '../components/common/TopNavBar';
import ChatSidebar from '../components/chat/ChatSidebar';
import MessageItem from '../components/chat/MessageItem';
import ErrorMessage from '../components/common/ErrorMessage';

const ChatPage = () => {
  const {
    input, isSidebarOpen, setIsSidebarOpen, searchQuery, setSearchQuery,
    isMobile, localError, setLocalError, textareaHeight, formKey,
    messagesEndRef, textareaRef, chatContainerRef,
    user, chatHistory, activeChatMessages, currentChatId, isLoading,
    handleSend, handleKeyDown, handleNewChat, switchChat, getCurrentChatTitle,
    fetchChatHistory, handleInputChange
  } = useChatLogic();

  return (
    <motion.div
      className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <style jsx>{`
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        *::-webkit-scrollbar {
          display: none;
        }
        
        .markdown-content p { margin-bottom: 0.75rem; }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 { font-weight: bold; margin: 0.75rem 0; }
        .markdown-content h1 { font-size: 1.25rem; }
        .markdown-content h2 { font-size: 1.125rem; }
        .markdown-content h3 { font-size: 1rem; }
        .markdown-content ul, .markdown-content ol { padding-left: 1.5rem; margin: 0.75rem 0; }
        .markdown-content ul { list-style-type: disc; }
        .markdown-content ol { list-style-type: decimal; }
        .markdown-content table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
        .markdown-content th, .markdown-content td { border: 1px solid #e2e8f0; padding: 0.25rem 0.5rem; text-align: left; }
        .markdown-content a { color: #0ea5e9; text-decoration: underline; }
        .markdown-content strong { font-weight: bold; }
        .markdown-content em { font-style: italic; }
        .markdown-content code { background-color: #f1f5f9; padding: 0.1rem 0.2rem; border-radius: 0.2rem; font-size: 0.875em; }
        .markdown-content pre { background-color: #f1f5f9; padding: 0.5rem; border-radius: 0.375rem; overflow-x: auto; margin: 0.75rem 0; }
        .markdown-content blockquote { border-left: 3px solid #10b981; padding-left: 0.75rem; margin: 0.75rem 0; color: #4b5563; background-color: #f0fdf4; border-radius: 0.25rem; }
      `}</style>

      <AnimatePresence mode="sync">
        {localError && <ErrorMessage message={localError} onClose={() => setLocalError(null)} />}
      </AnimatePresence>

      <div className="flex flex-col w-full h-full">
        <div className="flex-shrink-0">
          <TopNavBar
            title={getCurrentChatTitle()}
            user={user}
            onMenuClick={() => setIsSidebarOpen(true)}
            variant="chat"
          />
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          <ChatSidebar
            isMobile={isMobile}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            chatHistory={chatHistory}
            currentChatId={currentChatId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            switchChat={switchChat}
            handleNewChat={handleNewChat}
            getDisplayTitle={getDisplayTitle}
            fetchChatHistory={fetchChatHistory}
          />

          {isSidebarOpen && isMobile && (
            <div
              className="fixed inset-0 bg-white/10 backdrop-blur-md z-45 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div
              className="flex-1 overflow-y-auto p-4 pb-32 bg-transparent"
              ref={chatContainerRef}
              style={{ paddingTop: '1rem' }}
            >
              <div className="max-w-3xl mx-auto">
                {activeChatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[calc(100vh-280px)] text-center text-gray-600">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg">
                      <MessageSquare size={28} className="text-white" />
                    </div>
                    <h3 className="text-xl font-medium mb-3">Bắt đầu cuộc trò chuyện mới</h3>
                    <p className="text-sm max-w-md opacity-80">
                      Hãy nhập câu hỏi của bạn về chính sách người có công vào ô bên dưới để bắt đầu trò chuyện với CongBot.
                    </p>
                  </div>
                ) : (
                  <div>
                    {activeChatMessages.map((message, index) => (
                      <MessageItem 
                        key={message.id || `msg_${index}`} 
                        message={message} 
                      />
                    ))}
                  </div>
                )}

                {isLoading && activeChatMessages.length > 0 && (
                  <div className="flex justify-start mb-4">
                    <div className="w-10 h-10 rounded-full flex-shrink-0 mr-2 overflow-hidden shadow-md">
                      <img
                        src="/src/assets/images/chatbot-icon.png"
                        alt="Bot"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2310b981' viewBox='0 0 24 24'%3E%3Cpath d='M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z'/%3E%3C/svg%3E";
                        }}
                      />
                    </div>
                    <div className="bg-white text-gray-800 rounded-2xl px-4 py-3.5 border border-gray-100 shadow-md">
                      <div className="flex space-x-2">
                        <div className="w-2.5 h-2.5 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 md:left-72 z-40">
              <div className="max-w-3xl mx-auto px-4 py-4 bg-gradient-to-t from-green-50 via-teal-50 to-transparent">
                <div className="bg-white rounded-[20px] shadow-xl border border-gray-100 p-1.5 overflow-hidden">
                  <form key={formKey} onSubmit={handleSend} className="flex items-center">
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập câu hỏi của bạn về chính sách người có công..."
                        className="w-full border border-gray-200 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none text-sm rounded-[20px] my-1 py-3.5 px-3 resize-none transition-all duration-200"
                        style={{
                          height: `${textareaHeight}px`,
                          minHeight: '50px',
                          maxHeight: '200px'
                        }}
                      ></textarea>
                    </div>

                    <div className="flex items-center ml-2">
                      <button
                        type="submit"
                        disabled={input.trim() === '' || isLoading}
                        className={`p-2.5 h-[46px] min-w-[46px] flex items-center justify-center rounded-full transition-all duration-200 ${input.trim() === '' || isLoading
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:shadow-md'
                          }`}
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatPage;