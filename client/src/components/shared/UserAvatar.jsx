import { getInitials, resolveAvatarUrl } from '@/utils/userAvatar';

/**
 * Аватарка юзера з fallback на ініціали.
 *
 * Розміри:
 *  - xs:  w-8  h-8   text-xs
 *  - sm:  w-10 h-10  text-sm
 *  - md:  w-16 h-16  text-xl
 *  - lg:  w-24 h-24  text-2xl  (з бордером)
 *
 * @param {string} [src] — URL або відносний шлях аватарки
 * @param {string} name — ім'я для ініціалів (fallback)
 * @param {'xs'|'sm'|'md'|'lg'} [size]
 * @param {boolean} [bordered] — бордер (за замовчуванням для lg)
 */
export default function UserAvatar({
  src,
  name,
  size = 'sm',
  bordered,
  className = '',
}) {
  const resolvedUrl = resolveAvatarUrl(src);
  const initials = getInitials(name);
  const showBorder = bordered ?? size === 'lg';

  const sizeClasses = {
    xs: 'w-8 h-8 text-xs',
    sm: 'w-10 h-10 text-sm',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-2xl',
  };

  const borderClass = showBorder ? 'border-4 border-brand-light shadow-lg' : '';
  const base = `${sizeClasses[size] || sizeClasses.sm} rounded-full ${borderClass} ${className}`;

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={name || 'Avatar'}
        className={`${base} object-cover`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className={`${base} bg-brand-dark flex items-center justify-center text-white font-bold`}
    >
      {initials}
    </div>
  );
}
