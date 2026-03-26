const LOCALE = 'uk-UA';

const FORMAT_OPTIONS = {
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  dayMonth: { weekday: 'long', day: 'numeric', month: 'long' },
  monthYear: { month: 'long', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
};

function formatRelative(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Сьогодні';
  if (diffDays === 1) return 'Завтра';
  if (diffDays === -1) return 'Вчора';
  if (diffDays > 1 && diffDays <= 7) return `Через ${diffDays} дн.`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} дн. тому`;

  return date.toLocaleDateString(LOCALE, FORMAT_OPTIONS.long);
}

export function getLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getMillisecondsUntilNextLocalDay(now = new Date()) {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    1,
    0
  );

  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}

export function formatDate(value, format = 'long') {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);

  if (format === 'relative') return formatRelative(date);

  if (format === 'dateTime') {
    const datePart = date.toLocaleDateString(LOCALE, FORMAT_OPTIONS.long);
    const timePart = date.toLocaleTimeString(LOCALE, FORMAT_OPTIONS.time);
    return `${datePart}, ${timePart}`;
  }

  if (format === 'time') {
    return date.toLocaleTimeString(LOCALE, FORMAT_OPTIONS.time);
  }

  const options = FORMAT_OPTIONS[format] || FORMAT_OPTIONS.long;
  return date.toLocaleDateString(LOCALE, options);
}
