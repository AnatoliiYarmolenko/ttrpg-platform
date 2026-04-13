import React from 'react';
import Button from '@/components/ui/Button';

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
  size = 'md',
  className = '' 
}) {
  return (
    <Button
      onClick={onClick}
      variant={isActive ? 'tabActive' : 'tabInactive'}
      size={size}
      fullWidth={false}
      className={`justify-center lg:px-6 ${className}`}
    >
      <span className="font-bold">{label}</span>
    </Button>
  );
}
