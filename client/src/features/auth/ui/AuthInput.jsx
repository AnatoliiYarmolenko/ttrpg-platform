import React from 'react';

export default function AuthInput({ 
  type = "text", 
  placeholder, 
  register, 
  name, 
  rules, 
  error, 
  disabled,
  className,
  ...rest 
}) {
  const baseClasses = "w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed";
  
  const borderClass = error 
    ? "border-red-500 focus:border-red-700 focus:ring-red-200" 
    : "border-brand-light focus:border-brand-medium focus:ring-brand-light text-brand-dark";

  // Безпечно отримуємо пропси реєстрації
  const registerProps = (register && name) ? register(name, rules) : {};

  return (
    <div className={`w-full ${className || ''}`}>
      <input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className={`${baseClasses} ${borderClass}`}
        {...registerProps} 
        {...rest} // Тепер тут чисто, children сюди не потраплять
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error.message}</p>
      )}
    </div>
  );
}