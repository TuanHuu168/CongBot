import React from 'react';
import { motion } from 'framer-motion';

// Component thẻ hiển thị thống kê
const StatCard = ({ title, value, icon, color, isLoading = false, subtitle = null }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-start justify-between">
                {/* Phần nội dung chính */}
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    {isLoading ? (
                        // Hiệu ứng loading
                        <div className="h-8 w-16 bg-gray-200 animate-pulse rounded"></div>
                    ) : (
                        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
                    )}
                </div>
                
                {/* Icon với màu nền */}
                <div className={`p-2 rounded-lg bg-${color}-50`}>
                    {icon}
                </div>
            </div>
            
            {/* Thông tin phụ (nếu có) */}
            {subtitle && (
                <div className="mt-4 flex items-center text-xs text-gray-500">
                    {subtitle}
                </div>
            )}
        </div>
    );
};

export default StatCard;