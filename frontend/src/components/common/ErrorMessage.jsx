import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const ErrorMessage = ({ message, onClose }) => {
    if (!message) return null;

    return (
        <motion.div
            className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
        >
            <span>{message}</span>
            {onClose && (
                <button
                    className="ml-3 text-red-500 hover:text-red-700"
                    onClick={onClose}
                >
                    <X size={14} />
                </button>
            )}
        </motion.div>
    );
};

export default ErrorMessage;