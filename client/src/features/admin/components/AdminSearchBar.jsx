import React from 'react';
import Button from '@/components/ui/Button';

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
        className="flex-1 px-4 py-2 rounded-xl border-2 border-brand-light/30 focus:border-brand-dark text-brand-dark placeholder-gray-400 transition-colors"
      />
      <Button
        onClick={onSearch}
        variant="secondary"
        size="md"
        fullWidth={false}
        className="shadow-none"
      >
        Знайти
      </Button>
    </div>
  );
}
