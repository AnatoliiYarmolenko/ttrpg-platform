import React from 'react';

/**
 * Рядок пошуку для адмін-таблиць
 */
export default function AdminSearchBar({ value, onChange, onSearch, placeholder = 'Пошук...' }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSearch?.();
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 px-4 py-2 rounded-xl border-2 border-brand-light/30 focus:border-brand-dark focus:outline-none text-brand-dark placeholder-gray-400 transition-colors"
      />
      <button
        onClick={onSearch}
        className="px-4 py-2 rounded-xl bg-brand-dark text-white font-medium hover:bg-brand-medium transition-colors"
      >
        Знайти
      </button>
    </div>
  );
}
