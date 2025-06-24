export const validateEmail = (email) => {
  if (!email) return 'Vui lòng nhập email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ';
  return '';
};

export const validatePassword = (password) => {
  if (!password) return 'Vui lòng nhập mật khẩu';
  if (password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
  return '';
};

export const validateUsername = (username) => {
  if (!username) return 'Vui lòng nhập tên đăng nhập';
  if (username.length < 3) return 'Tên đăng nhập phải có ít nhất 3 ký tự';
  return '';
};

export const validateFullName = (fullName) => {
  if (!fullName) return 'Vui lòng nhập họ và tên';
  return '';
};

export const validatePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return 'Vui lòng nhập số điện thoại';
  return '';
};

export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) return 'Vui lòng xác nhận mật khẩu';
  if (password !== confirmPassword) return 'Mật khẩu không khớp';
  return '';
};

// Hook để validate form
export const useFormValidation = (validationRules) => {
  const validateField = (field, value, allValues = {}) => {
    const validator = validationRules[field];
    if (typeof validator === 'function') {
      return validator(value, allValues);
    }
    return '';
  };

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