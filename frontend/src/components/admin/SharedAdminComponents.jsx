import React from 'react';
import { motion } from 'framer-motion';

// Shared animation variants cho tất cả admin tabs
export const fadeInVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

// Loading spinner component
export const AdminLoadingSpinner = ({ size = 8 }) => (
  <div className="py-4 flex justify-center">
    <div className={`animate-spin rounded-full h-${size} w-${size} border-t-2 border-green-500`}></div>
  </div>
);

// Empty state component
export const AdminEmptyState = ({ icon: Icon, title, description, actionButton = null }) => (
  <div className="py-10 text-center">
    <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-3">
      <Icon size={24} className="text-gray-400" />
    </div>
    <p className="text-gray-500 text-sm font-medium">{title}</p>
    {description && <p className="text-gray-400 text-xs mt-1">{description}</p>}
    {actionButton && <div className="mt-4">{actionButton}</div>}
  </div>
);

// Section header với icon và title
export const AdminSectionHeader = ({ icon: Icon, title, subtitle, rightContent = null }) => (
  <div className="p-5 border-b border-gray-100 flex justify-between items-center">
    <div className="flex items-center">
      <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-green-600" />
      </div>
      <div className="ml-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
    {rightContent}
  </div>
);

// Stats card component
export const AdminStatsCard = ({ title, value, icon, color = "green", subtitle = null, loading = false }) => (
  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        {loading ? (
          <div className="h-8 w-16 bg-gray-200 animate-pulse rounded"></div>
        ) : (
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        )}
      </div>
      <div className={`p-2 rounded-lg bg-${color}-50`}>
        {icon}
      </div>
    </div>
    {subtitle && (
      <div className="mt-4 flex items-center text-xs text-gray-500">
        {subtitle}
      </div>
    )}
  </div>
);

// Action button với loading state
export const AdminActionButton = ({ 
  onClick, 
  loading = false, 
  disabled = false, 
  variant = "primary", 
  size = "md",
  icon: Icon,
  children,
  className = ""
}) => {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200";
  
  const variants = {
    primary: "bg-gradient-to-r from-green-600 to-teal-600 text-white hover:opacity-90",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-green-600 text-white hover:bg-green-700"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };
  
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className} ${
        (loading || disabled) ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-current mr-2"></div>
          <span>Đang xử lý...</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={16} className="mr-2" />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

// Search input component
export const AdminSearchInput = ({ placeholder, value, onChange, className = "" }) => (
  <div className={`relative ${className}`}>
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full py-2 pl-8 pr-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
    />
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  </div>
);

// Modal wrapper
export const AdminModal = ({ isOpen, onClose, title, children, size = "md" }) => {
  if (!isOpen) return null;
  
  const sizes = {
    sm: "max-w-md",
    md: "max-w-2xl", 
    lg: "max-w-4xl",
    xl: "max-w-6xl"
  };
  
  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`bg-white rounded-xl shadow-xl ${sizes[size]} w-full overflow-hidden`}
      >
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 p-1"
          >
            <span className="sr-only">Đóng</span>
            <span className="text-xl">&times;</span>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  );
};