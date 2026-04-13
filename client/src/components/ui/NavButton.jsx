import React from 'react';

/**
 * Компактна кнопка навігації для хедера
 * @param {Object} props
 * @param {string} props.label - Текст кнопки
 * @param {boolean} [props.isActive=false] - Чи активна кнопка
 * @param {function} props.onClick - Обробник кліку
 * @param {string} [props.className] - Додаткові класи
 */
export default function NavButton({ 
  label, 
  isActive = false, 
  onClick, 
  className = '' 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 lg:px-6 py-2 rounded-xl transition-all duration-200 border-[3px]
        ${isActive 
          ? 'bg-brand-dark text-white border-brand-accent shadow-lg scale-105' 
          : 'bg-white text-brand-dark border-brand-light/30 hover:border-brand-light hover:shadow-md'}
        ${className}
      `}
    >
      <span className="font-bold">{label}</span>
    </button>
  );
}
