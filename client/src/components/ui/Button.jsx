export default function Button({ 
  children, 
  isLoading, 
  loadingText = "Зачекайте...", 
  type = "button", 
  disabled,
  onClick,
  variant = "primary",
  fullWidth = true,
  className = ""
}) {
  const baseStyles = "font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand-accent hover:bg-brand-medium text-brand-dark hover:text-white",
    secondary: "bg-brand-dark hover:bg-brand-medium text-white",
    outline: "bg-transparent border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white",
    danger: "bg-transparent border-2 border-red-400 text-red-500 hover:bg-red-500 hover:text-white"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${widthClass} ${className}`}
    >
      {isLoading ? loadingText : children}
    </button>
  );
}
