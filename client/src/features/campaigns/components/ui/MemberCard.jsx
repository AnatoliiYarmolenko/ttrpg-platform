import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserAvatar, RoleBadge } from '@/components/shared';

/**
 * MemberCard — картка учасника кампанії.
 * Вся картка є кліком — відкриває профіль або переходить на публічну сторінку.
 * Контроли (select ролі, кнопка ✕) не тригерять перехід (stopPropagation).
 *
 * @param {Object}   member        — об'єкт учасника (з user, role, joinedAt)
 * @param {boolean}  isOwner       — чи є поточний юзер власником кампанії
 * @param {number}   currentUserId — ID поточного юзера
 * @param {Function} onRemove      — колбек видалення (memberId)
 * @param {Function} onChangeRole  — колбек зміни ролі (memberId, newRole)
 * @param {Function} [onViewProfile] — якщо передано, показує вбудований прев'ю замість переходу
 */
export default function MemberCard({
  member,
  isOwner = false,
  currentUserId,
  onRemove,
  onChangeRole,
  onViewProfile,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = member.user || {};
  const displayName = user.displayName || user.username || 'Невідомий';
  const isSelf = member.userId === currentUserId;
  const isMemberOwner = member.role === 'OWNER';

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
      className="flex items-center justify-between p-3 border-2 border-[#9DC88D]/30 rounded-xl hover:border-[#9DC88D]/60 hover:bg-[#9DC88D]/5 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <UserAvatar src={user.avatarUrl} name={displayName} size="sm" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[#164A41] truncate">
              {displayName}
            </span>
            <RoleBadge role={member.role} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {user.username && (
              <span className="text-xs text-[#4D774E]">@{user.username}</span>
            )}
          </div>
        </div>
      </div>

      <div role="presentation" className="flex items-center gap-2 flex-shrink-0" onClick={stopProp} onKeyDown={stopProp}>
        {isOwner && !isSelf && !isMemberOwner && onChangeRole && (
          <select
            value={member.role}
            onChange={(e) => onChangeRole(member.userId, e.target.value)}
            className="text-xs px-2 py-1 border border-[#9DC88D]/50 rounded-lg bg-white text-[#164A41] outline-none focus:border-[#164A41]"
          >
            <option value="PLAYER">Гравець</option>
            <option value="GM">GM</option>
          </select>
        )}

        {isOwner && !isSelf && !isMemberOwner && onRemove && (
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
