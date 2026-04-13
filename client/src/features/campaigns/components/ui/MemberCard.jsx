import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserAvatar, RoleBadge } from '@/components/shared';
import Star from '@/components/ui/icons/Star';

/**
 * MemberCard — картка учасника кампанії.
 * Вся картка є кліком — відкриває профіль або переходить на публічну сторінку.
 * Контроли (select ролі, кнопка ✕) не тригерять перехід (stopPropagation).
 *
 * @param {Object}   member        — об'єкт учасника (з user, role, joinedAt)
 * @param {boolean}  canRemove      — чи може поточний юзер видалити цього учасника
 * @param {boolean}  canChangeRole  — чи може поточний юзер змінити роль цього учасника
 * @param {Function} onRemove      — колбек видалення (memberId)
 * @param {Function} onChangeRole  — колбек зміни ролі (memberId, newRole)
 * @param {Function} [onViewProfile] — якщо передано, показує вбудований прев'ю замість переходу
 */
export default function MemberCard({
  member,
  canRemove = false,
  canChangeRole = false,
  onRemove,
  onChangeRole,
  onViewProfile,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = member.user || {};
  const displayName = user.displayName || user.username || 'Невідомий';
  const isMemberOwner = member.role === 'OWNER';
  const displayRole = isMemberOwner ? 'GM' : member.role;

  const handleCardClick = () => {
    if (onViewProfile) {
      onViewProfile(user.id);
    } else if (user.username) {
      navigate(`/user/${user.username}`, { state: { fromPath: location.pathname } });
    }
  };

  const stopProp = (e) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      className="flex items-center justify-between p-3 border-2 border-brand-light/30 rounded-xl hover:border-brand-light/60 hover:bg-brand-light/5 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <UserAvatar src={user.avatarUrl} name={displayName} size="sm" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-brand-dark truncate">
              {displayName}
            </span>
            {isMemberOwner && (
              <span className="inline-flex items-center text-brand-accent" title="Власник" aria-label="Власник">
                <Star className="w-4 h-4" />
              </span>
            )}
            <RoleBadge role={displayRole} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {user.username && (
              <span className="text-xs text-brand-medium">@{user.username}</span>
            )}
          </div>
        </div>
      </div>

      <div role="presentation" className="flex items-center gap-2 flex-shrink-0" onClick={stopProp} onKeyDown={stopProp}>
        {canChangeRole && onChangeRole && (
          <select
            value={member.role}
            onChange={(e) => onChangeRole(member.userId, e.target.value)}
            className="text-xs px-2 py-1 border border-brand-light/50 rounded-lg bg-white text-brand-dark outline-none focus:border-brand-dark"
          >
            <option value="PLAYER">Гравець</option>
            <option value="GM">GM</option>
          </select>
        )}

        {canRemove && onRemove && (
          <button
            onClick={() => onRemove(member.userId)}
            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"
            title="Видалити учасника"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
