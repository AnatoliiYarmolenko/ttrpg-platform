const VISIBILITY_CONFIG = {
  PUBLIC:    { text: 'За заявкою',     abbrev: 'ЗАЯ', class: 'bg-green-100 text-green-800' },
  PRIVATE:   { text: 'Приватна',       abbrev: 'ПРИ', class: 'bg-gray-100 text-gray-800' },
  LINK_ONLY: { text: 'За посиланням',  abbrev: 'ПОС', class: 'bg-blue-100 text-blue-800' },
};

/**
 * Бейдж видимості кампанії/сесії (PUBLIC, PRIVATE, LINK_ONLY)
 *
 * @param {'PUBLIC'|'PRIVATE'|'LINK_ONLY'} visibility
 * @param {'sm'|'md'} size
 * @param {boolean} iconOnly — компактний варіант (абревіатура без повного тексту)
 */
export default function VisibilityBadge({ visibility, size = 'md', iconOnly = false }) {
  const badge = VISIBILITY_CONFIG[visibility] || VISIBILITY_CONFIG.PRIVATE;

  if (iconOnly) {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ${badge.class}`}
        title={badge.text}
      >
        {badge.abbrev}
      </span>
    );
  }

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
