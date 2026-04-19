const STATUS_CONFIG = {
  PLANNED:   { text: 'Заплановано', class: 'bg-blue-100 text-blue-700' },
  ACTIVE:    { text: 'В процесі',  class: 'bg-green-100 text-green-700' },
  FINISHED:  { text: 'Завершено',  class: 'bg-gray-100 text-gray-700' },
  CANCELED:  { text: 'Скасовано',  class: 'bg-red-100 text-red-700' },
};

/**
 * Бейдж статусу сесії/кампанії (PLANNED, ACTIVE, FINISHED, CANCELED)
 *
 * @param {'PLANNED'|'ACTIVE'|'FINISHED'|'CANCELED'} status
 * @param {'sm'|'md'} size — sm: compact (text-xs), md: standard (text-sm)
 */
export default function StatusBadge({ status, size = 'md' }) {
  const badge = STATUS_CONFIG[status] || STATUS_CONFIG.PLANNED;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm font-medium',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${sizeClasses[size]} ${badge.class}`}>
      {badge.text}
    </span>
  );
}
