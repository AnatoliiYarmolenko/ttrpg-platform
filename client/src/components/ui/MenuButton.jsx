import React from 'react';

/**
 * Універсальна кнопка меню з іконкою та описом
 * @param {Object} props
 * @param {string} [props.icon] - Emoji або іконка (опціонально)
 * @param {string} props.label - Основний текст кнопки
 * @param {string} [props.description] - Додатковий опис під лейблом
 * @param {boolean} [props.isActive=false] - Чи активна кнопка
 * @param {function} props.onClick - Обробник кліку
 * @param {string} [props.className] - Додаткові класи
 */
export default function MenuButton({ 
  icon, 
  label, 
  description, 
  isActive = false, 
  onClick, 
  className = '' 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-xl transition-all duration-200 border-[3px]
        flex items-center gap-3
        ${isActive 
          ? 'bg-brand-dark text-white border-brand-accent shadow-lg' 
          : 'bg-white text-brand-dark border-brand-light/30 hover:border-brand-light hover:shadow-md'}
        ${className}
      `}
    >
      {icon && <span className="text-2xl">{icon}</span>}
      <div>
        <div className="font-bold">{label}</div>
          {description && (
            <div className={`text-xs ${isActive ? 'text-white/70' : 'text-brand-medium'}`}>
            {description}
          </div>
        )}
      </div>
    </button>
  );
}
