import { forwardRef } from 'react';

const Button = forwardRef(function Button({ 
  children, 
  isLoading, 
  loadingText = "Зачекайте...", 
  type = "button", 
  disabled,
  onClick,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  ...rest
}, ref) {
  const baseStyles = "items-center justify-center gap-2 whitespace-nowrap font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand-accent hover:bg-brand-medium text-brand-dark hover:text-white",
    secondary: "bg-brand-dark hover:bg-brand-medium text-white",
    outline: "bg-transparent border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white",
    danger: "bg-transparent border-2 border-red-400 text-red-500 hover:bg-red-500 hover:text-white",
    topbar: "border-2 border-white/50 bg-brand-dark text-white hover:bg-brand-accent hover:text-brand-dark hover:border-brand-dark",
    topbarAccent: "border-2 border-brand-accent bg-brand-accent text-brand-dark hover:bg-brand-dark hover:text-brand-accent",
    light: "bg-white text-brand-dark hover:bg-gray-100",
    tabActive: "border-[3px] bg-brand-dark text-white border-brand-accent shadow-lg rounded-xl",
    tabInactive: "border-[3px] bg-white text-brand-dark border-brand-light/30 hover:border-brand-light hover:shadow-md rounded-xl",
  };

  const sizes = {
    sm: "py-1.5 px-3 text-sm",
    md: "py-2 px-4",
    lg: "py-3 px-6",
  };

  const widthClass = fullWidth ? "w-full" : "";
  const displayClass = fullWidth ? "flex" : "inline-flex";

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${displayClass} ${baseStyles} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${widthClass} ${className}`}
      {...rest}
    >
      {isLoading ? loadingText : children}
    </button>
  );
});

export default Button;
