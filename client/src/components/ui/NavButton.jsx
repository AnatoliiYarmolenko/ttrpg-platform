import React from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';

/**
 * Компактна кнопка навігації для хедера
 * @param {Object} props
 * @param {string} props.label - Текст кнопки
 * @param {boolean} [props.isActive=false] - Чи активна кнопка
 * @param {function} props.onClick - Обробник кліку
 * @param {string} [props.to] - URL для навігації
 * @param {string} [props.className] - Додаткові класи
 */
export default function NavButton({ 
  label, 
  isActive = false, 
  onClick, 
  to,
  size = 'md',
  className = '' 
}) {
  const Component = to ? Link : 'button';

  return (
    <Button
      as={Component}
      to={to}
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
