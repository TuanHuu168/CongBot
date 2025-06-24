import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

const FormField = memo(({ 
  name, 
  type = 'text', 
  placeholder, 
  icon: Icon, 
  showToggle = false, 
  toggleState, 
  onToggle, 
  value, 
  onChange, 
  onBlur, 
  error,
  disabled = false 
}) => (
  <motion.div 
    className="space-y-1" 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
    exit={{ opacity: 0, y: 10, transition: { duration: 0.2 } }}
  >
    <div className="relative">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
        <Icon size={18} />
      </div>
      <input
        type={showToggle ? (toggleState ? 'text' : type) : type}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-10 py-3 border ${error ? 'border-red-500' : 'border-gray-200'} 
          rounded-xl focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-green-500'} 
          shadow-sm transition-all duration-300 bg-gray-50 focus:bg-white disabled:opacity-50`}
      />
      {showToggle && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors duration-300"
        >
          {toggleState ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
    {error && <p className="text-red-500 text-sm ml-1">{error}</p>}
  </motion.div>
));

FormField.displayName = 'FormField';

export default FormField;