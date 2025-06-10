import React, { memo } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { itemVariants } from '../../utils/formatUtils';

const BotAvatar = memo(() => (
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
));

const UserAvatar = memo(() => (
  <div className="w-10 h-10 rounded-full flex-shrink-0 ml-2 overflow-hidden shadow-md">
    <img
      src="/src/assets/images/user-icon.png"
      alt="User"
      className="w-full h-full object-cover"
    />
  </div>
));

const MessageContent = memo(({ message }) => {
  const isUser = message.sender === 'user';
  
  return (
    <div className={`rounded-2xl px-4 py-3 max-w-[80%] ${
      isUser
        ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-md'
        : 'bg-white text-gray-800 border border-gray-100 shadow-md'
    }`}>
      {isUser ? (
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
  );
});

const MessageItem = memo(({ message }) => {
  const isUser = message.sender === 'user';
  
  return (
    <motion.div
      className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}
      variants={itemVariants}
      initial="initial"
      animate="animate"
    >
      {!isUser && <BotAvatar />}
      <MessageContent message={message} />
      {isUser && <UserAvatar />}
    </motion.div>
  );
});

MessageItem.displayName = 'MessageItem';
BotAvatar.displayName = 'BotAvatar';
UserAvatar.displayName = 'UserAvatar';
MessageContent.displayName = 'MessageContent';

export default MessageItem;