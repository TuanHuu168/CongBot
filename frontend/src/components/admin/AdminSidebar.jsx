import React from 'react';
import {
    LayoutDashboard, Users, FileText, Database,
    BarChart2, LogOut, User, ChevronLeft
} from 'lucide-react';
import { motion } from 'framer-motion';

const AdminSidebar = ({ activeTab, setActiveTab, handleLogout, navigate }) => {
    const sidebarVariants = {
        hidden: { x: -280 },
        visible: { x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }
    };

    return (
        <motion.div
            className="w-64 bg-white border-r border-gray-200 shadow-sm h-screen overflow-y-auto fixed left-0 top-0 z-10"
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="flex flex-col h-full">
                {/* Logo and Header */}
                <div className="px-6 py-6 bg-gradient-to-r from-green-600 to-teal-600 text-white flex items-center space-x-2">
                    <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center">
                        <LayoutDashboard size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">Admin Panel</h1>
                        <p className="text-xs text-white/80">Quản trị hệ thống</p>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 p-4">
                    <div className="space-y-1">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'dashboard'
                                ? 'bg-green-50 text-green-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <LayoutDashboard size={18} className="mr-3" />
                            Dashboard
                        </button>

                        <button
                            onClick={() => setActiveTab('users')}
                            className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'users'
                                ? 'bg-green-50 text-green-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <Users size={18} className="mr-3" />
                            Quản lý người dùng
                        </button>

                        <button
                            onClick={() => setActiveTab('documents')}
                            className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'documents'
                                ? 'bg-green-50 text-green-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <FileText size={18} className="mr-3" />
                            Quản lý văn bản
                        </button>

                        <button
                            onClick={() => setActiveTab('cache')}
                            className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'cache'
                                ? 'bg-green-50 text-green-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <Database size={18} className="mr-3" />
                            Quản lý cache
                        </button>

                        <button
                            onClick={() => setActiveTab('benchmark')}
                            className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'benchmark'
                                ? 'bg-green-50 text-green-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <BarChart2 size={18} className="mr-3" />
                            Benchmark
                        </button>
                    </div>
                </nav>

                {/* Admin Info & Logout */}
                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center mb-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <User size={20} className="text-green-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-700">Admin</p>
                            <p className="text-xs text-gray-500">admin@example.com</p>
                        </div>
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={() => navigate('/')}
                            className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                        >
                            <ChevronLeft size={16} className="mr-1" />
                            <span>Trang chủ</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200 transition-colors"
                        >
                            <LogOut size={16} className="mr-1" />
                            <span>Đăng xuất</span>
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default AdminSidebar;