import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Edit, Trash2, User, Key, Power, Eye, X, Save, AlertTriangle } from 'lucide-react';
import { formatDate } from '../../utils/formatUtils';
import { adminAPI } from '../../apiService';
import { showError, showSuccess, showConfirm } from '../../utils/formatUtils';

const UsersTab = ({ users, isLoading, refreshUsers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Hiệu ứng animation cho component
  const fadeInVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  // Hiệu ứng animation cho modal
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
  };

  // Lọc danh sách người dùng theo từ khóa tìm kiếm
  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mở modal chỉnh sửa thông tin người dùng
  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      role: user.role || 'user',
      status: user.status || 'active'
    });
    setShowEditModal(true);
  };

  // Xử lý cập nhật thông tin người dùng
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    setSaving(true);
    try {
      await adminAPI.updateUser(editingUser.id, formData);
      showSuccess('Cập nhật thông tin người dùng thành công');
      setShowEditModal(false);
      refreshUsers();
    } catch (error) {
      showError(error.detail || 'Không thể cập nhật thông tin người dùng');
    } finally {
      setSaving(false);
    }
  };

  // Xử lý xóa người dùng với xác nhận
  const handleDeleteUser = (user) => {
    showConfirm(
      `Bạn có chắc chắn muốn xóa người dùng "${user.username}"? Tất cả dữ liệu liên quan sẽ bị xóa vĩnh viễn.`,
      'Xác nhận xóa người dùng'
    ).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await adminAPI.deleteUser(user.id);
          showSuccess(`Đã xóa người dùng ${user.username} thành công`);
          refreshUsers();
        } catch (error) {
          showError(error.detail || 'Không thể xóa người dùng');
        }
      }
    });
  };

  // Xử lý thay đổi trạng thái hoạt động/vô hiệu hóa người dùng
  const handleToggleStatus = async (user) => {
    const action = user.status === 'active' ? 'vô hiệu hóa' : 'kích hoạt';
    
    showConfirm(
      `Bạn có chắc chắn muốn ${action} người dùng "${user.username}"?`,
      `Xác nhận ${action}`
    ).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await adminAPI.toggleUserStatus(user.id);
          showSuccess(`Đã ${action} người dùng ${user.username}`);
          refreshUsers();
        } catch (error) {
          showError(error.detail || `Không thể ${action} người dùng`);
        }
      }
    });
  };

  // Xử lý reset mật khẩu người dùng
  const handleResetPassword = async () => {
    if (!editingUser || !newPassword.trim()) {
      showError('Vui lòng nhập mật khẩu mới');
      return;
    }

    if (newPassword.length < 6) {
      showError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setSaving(true);
    try {
      await adminAPI.resetUserPassword(editingUser.id, newPassword);
      showSuccess(`Đã reset mật khẩu cho ${editingUser.username} thành công`);
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (error) {
      showError(error.detail || 'Không thể reset mật khẩu');
    } finally {
      setSaving(false);
    }
  };

  // Lấy màu sắc badge theo vai trò người dùng
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'moderator':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  // Lấy màu sắc badge theo trạng thái người dùng
  const getStatusBadgeColor = (status) => {
    return status === 'active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      {/* Khu vực chính hiển thị danh sách người dùng */}
      <motion.div
        className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
        variants={fadeInVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header với tiêu đề và tìm kiếm */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center">
            <User size={18} className="text-green-600 mr-2" />
            Quản lý người dùng ({filteredUsers.length})
          </h2>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm người dùng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="py-1.5 pl-8 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Nội dung bảng danh sách người dùng */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Người dùng
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vai trò
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Đăng nhập gần đây
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      {/* Thông tin cơ bản người dùng */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <User size={14} className="text-gray-500" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{user.username}</div>
                            <div className="text-xs text-gray-500">{user.fullName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(user.status)}`}>
                          {user.status === 'active' ? 'Kích hoạt' : 'Vô hiệu hóa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {user.lastLogin ? formatDate(user.lastLogin) : 'Chưa đăng nhập'}
                        </div>
                      </td>
                      {/* Các nút thao tác */}
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-gray-400 hover:text-blue-500 px-2 py-1 rounded transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setShowPasswordModal(true);
                            }}
                            className="text-gray-400 hover:text-amber-500 px-2 py-1 rounded transition-colors"
                            title="Reset mật khẩu"
                          >
                            <Key size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`px-2 py-1 rounded transition-colors ${
                              user.status === 'active' 
                                ? 'text-gray-400 hover:text-red-500' 
                                : 'text-gray-400 hover:text-green-500'
                            }`}
                            title={user.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Hiển thị khi không có dữ liệu */}
              {filteredUsers.length === 0 && (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-3">
                    <User size={24} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">
                    {searchTerm ? 'Không tìm thấy người dùng nào' : 'Chưa có người dùng nào'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Modal chỉnh sửa thông tin người dùng */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
            >
              {/* Header modal */}
              <div className="p-5 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Chỉnh sửa: {editingUser?.username}
                  </h3>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Form chỉnh sửa */}
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                  <input
                    type="text"
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                  <select
                    value={formData.role || 'user'}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Không hoạt động</option>
                  </select>
                </div>
              </div>

              {/* Footer modal với các nút hành động */}
              <div className="p-5 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={saving}
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateUser}
                  disabled={saving}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />
                      Lưu thay đổi
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal reset mật khẩu */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
            >
              {/* Header modal reset mật khẩu */}
              <div className="p-5 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Reset mật khẩu: {editingUser?.username}
                  </h3>
                  <button
                    onClick={() => {
                      setShowPasswordModal(false);
                      setNewPassword('');
                    }}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Nội dung modal reset mật khẩu */}
              <div className="p-5">
                {/* Cảnh báo về việc reset mật khẩu */}
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle size={16} className="text-amber-500 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-amber-700">
                      Người dùng sẽ phải đăng nhập lại với mật khẩu mới sau khi reset.
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mật khẩu mới (tối thiểu 6 ký tự)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Footer modal reset mật khẩu */}
              <div className="p-5 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setNewPassword('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={saving}
                >
                  Hủy
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={saving || !newPassword.trim()}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                      Đang reset...
                    </>
                  ) : (
                    <>
                      <Key size={16} className="mr-2" />
                      Reset mật khẩu
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UsersTab;