import React from 'react';

/**
 * Уніфікована кнопка табів для верхніх панелей (Campaign / Session).
 * Стилі синхронізовані з кнопками навігації Dashboard.
 */
export default function TopBarTabButton({
  label,
  isActive = false,
  onClick,
  className = '',
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 lg:px-6 py-2 rounded-xl transition-all duration-200 border-2
        ${isActive
          ? 'bg-brand-dark text-white border-brand-accent shadow-lg scale-105'
          : 'bg-white text-brand-dark border-brand-light/30 hover:border-brand-light hover:shadow-md'}
        ${className}
      `}
    >
      <span className="font-bold text-base">{label}</span>
    </button>
  );
}
