const ROLE_CONFIG = {
  OWNER:  { text: 'Власник', class: 'bg-brand-accent text-brand-dark' },
  GM:     { text: 'Майстер', class: 'bg-brand-dark text-white' },
  PLAYER: { text: 'Гравець', class: 'bg-brand-light text-brand-dark' },
};

/**
 * Бейдж ролі користувача (OWNER, MASTER, PLAYER)
 *
 * @param {'OWNER'|'GM'|'PLAYER'} role
 * @param {'sm'|'md'} size — sm: compact, md: standard
 */
export default function RoleBadge({ role, size = 'sm' }) {
  const badge = ROLE_CONFIG[role];
  if (!badge) return null;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span className={`inline-flex items-center rounded-full font-bold ${sizeClasses[size]} ${badge.class}`}>
      {badge.text}
    </span>
  );
}
