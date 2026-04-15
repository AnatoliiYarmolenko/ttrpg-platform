import React from 'react';
import Button from '@/components/ui/Button';

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
    <Button
      onClick={onClick}
      variant={isActive ? 'tabActive' : 'tabInactive'}
      size="md"
      fullWidth={false}
      className={`justify-center ${className}`}
    >
      <span className="font-bold text-base">{label}</span>
    </Button>
  );
}
