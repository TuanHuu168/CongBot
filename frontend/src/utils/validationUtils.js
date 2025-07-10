// Hàm validate email với regex pattern chuẩn
export const validateEmail = (email) => {
  if (!email) return 'Vui lòng nhập email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ';
  return '';
};

// Hàm validate mật khẩu với độ dài tối thiểu
export const validatePassword = (password) => {
  if (!password) return 'Vui lòng nhập mật khẩu';
  if (password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
  return '';
};

// Hàm validate tên đăng nhập với độ dài tối thiểu
export const validateUsername = (username) => {
  if (!username) return 'Vui lòng nhập tên đăng nhập';
  if (username.length < 3) return 'Tên đăng nhập phải có ít nhất 3 ký tự';
  return '';
};

// Hàm validate họ và tên - chỉ kiểm tra bắt buộc
export const validateFullName = (fullName) => {
  if (!fullName) return 'Vui lòng nhập họ và tên';
  return '';
};

// Hàm validate số điện thoại - chỉ kiểm tra bắt buộc
export const validatePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return 'Vui lòng nhập số điện thoại';
  return '';
};

// Hàm validate xác nhận mật khẩu - kiểm tra khớp với mật khẩu gốc
export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) return 'Vui lòng xác nhận mật khẩu';
  if (password !== confirmPassword) return 'Mật khẩu không khớp';
  return '';
};

// Custom hook để validate form với các quy tắc validation tùy chỉnh
export const useFormValidation = (validationRules) => {
  // Hàm validate một field cụ thể với giá trị và toàn bộ form data
  const validateField = (field, value, allValues = {}) => {
    const validator = validationRules[field];
    if (typeof validator === 'function') {
      return validator(value, allValues);
    }
    return '';
  };

  // Hàm validate toàn bộ form và trả về object chứa các lỗi
  const validateForm = (formData) => {
    const errors = {};
    Object.keys(validationRules).forEach(field => {
      const error = validateField(field, formData[field], formData);
      if (error) errors[field] = error;
    });
    return errors;
  };

  return { validateField, validateForm };
};