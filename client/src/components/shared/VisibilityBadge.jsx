import PropTypes from 'prop-types';

const VISIBILITY_CONFIG = {
  campaign: {
    PUBLIC: { text: 'За заявкою', class: 'bg-green-100 text-green-800' },
    LINK_ONLY: { text: 'За посиланням', class: 'bg-blue-100 text-blue-800' },
  },
  campaignSession: {
    PRIVATE: { text: 'Звичайна', class: 'bg-gray-100 text-gray-800' },
    PUBLIC: { text: 'Гостьова', class: 'bg-green-100 text-green-800' },
  },
  oneShot: {
    PUBLIC: { text: 'Публічна', class: 'bg-green-100 text-green-800' },
    PRIVATE: { text: 'За підтвердженням', class: 'bg-gray-100 text-gray-800' },
    LINK_ONLY: { text: 'За посиланням', class: 'bg-blue-100 text-blue-800' },
  },
};

/**
 * Бейдж видимості кампанії/сесії (PUBLIC, PRIVATE, LINK_ONLY)
 *
 * @param {'PUBLIC'|'PRIVATE'|'LINK_ONLY'} visibility
 * @param {'campaign'|'campaignSession'|'oneShot'} entityType
 * @param {'sm'|'md'} size
 * @param {boolean} compact
 * @param {boolean} plainText - рендерити тільки текст без стилів
 */
export default function VisibilityBadge({ visibility, entityType = 'campaign', size = 'md', compact = false, plainText = false }) {
  const config = VISIBILITY_CONFIG[entityType];
  const badge = config[visibility] || Object.values(config)[0];

  if (plainText) {
    return <span>{badge.text}</span>;
  }

  if (compact) {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ${badge.class}`}
        title={badge.text}
      >
        {badge.text}
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

VisibilityBadge.propTypes = {
  visibility: PropTypes.oneOf(['PUBLIC', 'PRIVATE', 'LINK_ONLY']).isRequired,
  entityType: PropTypes.oneOf(['campaign', 'campaignSession', 'oneShot']),
  size: PropTypes.oneOf(['sm', 'md']),
  compact: PropTypes.bool,
  plainText: PropTypes.bool,
};