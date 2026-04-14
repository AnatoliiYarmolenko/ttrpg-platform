import { formatDate } from '@/utils/dateTime';

export default function DateTimeDisplay({
  value,
  format = 'long',
  fallback = '',
  className = '',
  as = 'span',
}) {
  const Component = as;

  if (!value) {
    return fallback ? <Component className={className}>{fallback}</Component> : null;
  }

  const date = value instanceof Date ? value : new Date(value);
  const text = formatDate(date, format);

  return (
    <Component className={className} title={date.toISOString()}>
      {text}
    </Component>
  );
}
