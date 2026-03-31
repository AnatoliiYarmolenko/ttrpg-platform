function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeDateTimeLocalValue(value) {
  return typeof value === 'string' ? value.trim().slice(0, 16) : '';
}

export function parseDateTimeLocalValue(value) {
  const normalizedValue = normalizeDateTimeLocalValue(value);
  if (!normalizedValue) return null;

  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTimeLocalValue(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isExistingDateTimeLocalValue(value) {
  const normalizedValue = normalizeDateTimeLocalValue(value);
  const parsedDate = parseDateTimeLocalValue(normalizedValue);

  if (!parsedDate) return false;

  return formatDateTimeLocalValue(parsedDate) === normalizedValue;
}

export function isAmbiguousDateTimeLocalValue(value) {
  const normalizedValue = normalizeDateTimeLocalValue(value);
  const parsedDate = parseDateTimeLocalValue(normalizedValue);

  if (!parsedDate || !isExistingDateTimeLocalValue(normalizedValue)) {
    return false;
  }

  const oneHourLater = new Date(parsedDate.getTime() + 60 * 60 * 1000);
  return formatDateTimeLocalValue(oneHourLater) === normalizedValue;
}

export function getDateTimeLocalIssue(value, now = new Date()) {
  const normalizedValue = normalizeDateTimeLocalValue(value);

  if (!normalizedValue) return 'empty';

  const parsedDate = parseDateTimeLocalValue(normalizedValue);
  if (!parsedDate) return 'invalid';

  if (!isExistingDateTimeLocalValue(normalizedValue)) {
    return 'nonexistent';
  }

  if (isAmbiguousDateTimeLocalValue(normalizedValue)) {
    return 'ambiguous';
  }

  if (parsedDate < now) {
    return 'past';
  }

  return null;
}

export function toIsoDateTimeLocalValue(value) {
  const normalizedValue = normalizeDateTimeLocalValue(value);
  const parsedDate = parseDateTimeLocalValue(normalizedValue);

  if (!parsedDate || !isExistingDateTimeLocalValue(normalizedValue)) {
    return null;
  }

  return parsedDate.toISOString();
}
