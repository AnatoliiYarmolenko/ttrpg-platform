import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';

/**
 * Компактна кнопка навігації для хедера
 * @param {Object} props
 * @param {string} props.label - Текст кнопки
 * @param {boolean} [props.isActive=false] - Чи активна кнопка
 * @param {function} props.onClick - Обробник кліку
 * @param {string} [props.to] - URL для навігації (підтримує middle-click/new-tab)
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
  const navigate = useNavigate();

  const openInNewTab = () => {
    if (!to) return;
    globalThis.open(to, '_blank', 'noopener,noreferrer');
  };

  const handleClick = (event) => {
    const shouldOpenInNewTab = Boolean(to) && (event.metaKey || event.ctrlKey || event.shiftKey);
    if (shouldOpenInNewTab) {
      event.preventDefault();
      openInNewTab();
      return;
    }

    onClick?.(event);

    if (to && !event.defaultPrevented) {
      navigate(to);
    }
  };

  const handleAuxClick = (event) => {
    if (event.button === 1 && to) {
      event.preventDefault();
      openInNewTab();
    }
  };

  return (
    <Button
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      variant={isActive ? 'tabActive' : 'tabInactive'}
      size={size}
      fullWidth={false}
      className={`justify-center lg:px-6 ${className}`}
    >
      <span className="font-bold">{label}</span>
    </Button>
  );
}
