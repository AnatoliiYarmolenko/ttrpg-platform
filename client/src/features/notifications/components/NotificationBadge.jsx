import React from 'react';
import PropTypes from 'prop-types';

/**
 * Бейдж з кількістю непрочитаних сповіщень
 *
 * @param {number} count - кількість непрочитаних
 * @param {'sm'|'md'|'lg'} size - розмір бейджа
 * @param {boolean} pulse - чи додавати анімацію пульсації
 */
export default function NotificationBadge({ count, size = 'md', pulse = false }) {
  if (!count || count <= 0) return null;

  const sizeClasses = {
    sm: 'min-w-[18px] h-[18px] text-[10px] px-1',
    md: 'min-w-[22px] h-[22px] text-xs px-1.5',
    lg: 'min-w-[26px] h-[26px] text-sm px-2',
  };

  const displayCount = count > 99 ? '99+' : count;

  return (
    <span
      className={`
        inline-flex items-center justify-center
        rounded-full bg-brand-accent text-brand-dark font-bold
        ${sizeClasses[size]}
        ${pulse ? 'animate-pulse' : ''}
      `}
    >
      {displayCount}
    </span>
  );
}

NotificationBadge.propTypes = {
  count: PropTypes.number.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  pulse: PropTypes.bool,
};
