import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Arrow from '@/components/ui/icons/Arrow';

/**
 * Кнопка "Назад" — уніфікований стиль для всього додатку.
 *
 * Варіанти:
 *  - light  — білий текст на темному фоні (для topBar / session pages)
 *  - dark   — темний текст на світлому фоні (для панелей Dashboard)
 *
 * @param {string}            [to]         — шлях навігації (якщо не вказано — navigate(-1))
 * @param {string}            [fallbackTo] — якщо вказано, при прямому відкритті (немає
 *                                           попередньої сторінки на цьому сайті) перейде
 *                                           сюди замість navigate(-1)
 * @param {string}            [label]      — текст кнопки (за замовчуванням "Назад")
 * @param {'light'|'dark'}    [variant]
 * @param {Function}          [onClick]    — кастомний обробник (замість navigate)
 */
export default function BackButton({
  to,
  fallbackTo,
  label = 'Назад',
  variant = 'dark',
  onClick,
  className = '',
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) return onClick();
    if (to) return navigate(to);

    if (fallbackTo) {
      const fromSameSite =
        document.referrer &&
        new URL(document.referrer).origin === globalThis.location.origin;
      return fromSameSite ? navigate(-1) : navigate(fallbackTo);
    }

    navigate(-1);
  };

  const variants = {
    light:
      'text-white hover:text-brand-accent bg-transparent hover:bg-transparent border-0 shadow-none hover:shadow-none px-0 py-0',
    dark:
      'text-brand-dark border-2 border-brand-light/30 hover:bg-brand-light/20 rounded-lg shadow-none hover:shadow-none',
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant="light"
      fullWidth={false}
      className={`text-sm transition-colors ${variant === 'dark' ? 'px-3 py-1' : 'px-0 py-0'} ${variants[variant] || variants.dark} ${className}`}
    >
      <Arrow className="w-4 h-4" direction="left" />
      {label}
    </Button>
  );
}

BackButton.propTypes = {
  to: PropTypes.string,
  fallbackTo: PropTypes.string,
  label: PropTypes.string,
  variant: PropTypes.oneOf(['light', 'dark']),
  onClick: PropTypes.func,
  className: PropTypes.string,
};
