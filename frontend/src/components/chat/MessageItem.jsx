import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

const MessageItem = ({ message, messageVariants }) => {
    return (
        <motion.div
            className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            variants={messageVariants}
            initial="initial"
            animate="animate"
        >
            {message.sender === 'bot' && (
                <div className="w-10 h-10 rounded-full flex-shrink-0 mr-2 overflow-hidden shadow-md">
                    <img
                        src="/src/assets/images/chatbot-icon.png"
                        alt="Bot"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2310b981' viewBox='0 0 24 24'%3E%3Cpath d='M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zM6.023 15.416C7.491 17.606 9.695 19 12.16 19c2.464 0 4.669-1.393 6.136-3.584A8.968 8.968 0 0120 12.16c0-2.465-1.393-4.669-3.584-6.136A8.968 8.968 0 0112.16 4c-2.465 0-4.67 1.393-6.137 3.584A8.968 8.968 0 014 12.16c0 1.403.453 2.75 1.254 3.876l-.001.001c.244.349.477.685.77 1.379zM8 13a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2zm-4-3a1 1 0 110-2 1 1 0 010 2zm0 6a1 1 0 110-2 1 1 0 010 2z'/%3E%3C/svg%3E";
                        }}
                    />
                </div>
            )}
            <div
                className={`rounded-2xl px-4 py-3 max-w-[80%] ${message.sender === 'user'
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-md'
                    : 'bg-white text-gray-800 border border-gray-100 shadow-md'
                    }`}
            >
                {message.sender === 'user' ? (
                    <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                ) : (
                    <div className="text-sm markdown-content">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeSanitize, rehypeRaw]}
                        >
                            {message.text}
                        </ReactMarkdown>

                        {message.processingTime > 0 && (
                            <div className="text-xs text-gray-400 mt-2 text-right">
                                Thời gian xử lý: {message.processingTime.toFixed(2)}s
                            </div>
                        )}
                    </div>
                )}
            </div>
            {message.sender === 'user' && (
                <div className="w-10 h-10 rounded-full flex-shrink-0 ml-2 overflow-hidden shadow-md">
                    <img
                        src="/src/assets/images/user-icon.png"
                        alt="User"
                        className="w-full h-full object-cover"
                    />
                </div>
            )}
        </motion.div>
    );
};

export default MessageItem;