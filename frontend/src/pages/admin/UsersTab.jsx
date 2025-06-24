import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Edit, Trash2 } from 'lucide-react';
import { formatDate } from '../../utils/formatUtils';
import { 
  fadeInVariants, 
  AdminLoadingSpinner, 
  AdminEmptyState, 
  AdminSectionHeader,
  AdminSearchInput 
} from '../../components/admin/SharedAdminComponents';

const UsersTab = ({ users, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-800',
      moderator: 'bg-blue-100 text-blue-800',
      user: 'bg-green-100 text-green-800'
    };
    return styles[role] || styles.user;
  };

  const getStatusBadge = (status) => {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <motion.div
        className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
        variants={fadeInVariants}
        initial="hidden"
        animate="visible"
      >
        <AdminSectionHeader 
          icon={User}
          title="Danh sách người dùng"
          rightContent={
            <AdminSearchInput 
              placeholder="Tìm kiếm người dùng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          }
        />

        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Tên người dùng', 'Email', 'Vai trò', 'Trạng thái', 'Đăng nhập gần đây', 'Thao tác'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <AdminLoadingSpinner />
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <User size={14} className="text-gray-500" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(user.status)}`}>
                          {user.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(user.lastLogin)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-gray-400 hover:text-gray-500 px-2">
                          <Edit size={14} />
                        </button>
                        <button className="text-gray-400 hover:text-red-500 px-2">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
                      <AdminEmptyState 
                        icon={User}
                        title="Không tìm thấy người dùng nào"
                        description={searchTerm ? `Không có kết quả cho "${searchTerm}"` : "Chưa có người dùng trong hệ thống"}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UsersTab;