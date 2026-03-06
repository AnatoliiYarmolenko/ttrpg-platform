import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserAvatar, RoleBadge } from '@/components/shared';

/**
 * Картка учасника сесії.
 * Вся картка є кліком — відкриває профіль (або переходить на публічну сторінку).
 * Кнопка видалення (✕) не тригерить перехід (stopPropagation).
 *
 * @param {Object}   participant   — об'єкт учасника (з user, role, characterName, status)
 * @param {boolean}  canManage     — чи може поточний юзер видаляти учасника
 * @param {number}   currentUserId — ID поточного юзера
 * @param {Function} onRemove      — колбек видалення (participantId)
 * @param {Function} [onViewProfile] — якщо передано, показує вбудований прев'ю замість переходу
 */
export default function ParticipantCard({
  participant,
  canManage = false,
  currentUserId,
  onRemove,
  onViewProfile,
  gmModeration,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = participant.user || {};
  const displayName = user.displayName || user.username || 'Невідомий';

  const PARTICIPANT_STATUS = {
    PENDING: { label: 'Очікує', class: 'bg-yellow-100 text-yellow-800' },
    CONFIRMED: { label: 'Підтверджено', class: 'bg-green-100 text-green-800' },
    DECLINED: { label: 'Відхилено', class: 'bg-red-100 text-red-800' },
  };

  const statusInfo = PARTICIPANT_STATUS[participant.status];

  const handleCardClick = () => {
    if (onViewProfile) {
      onViewProfile(user.id);
    } else if (user.username) {
      navigate(`/user/${user.username}`, { state: { fromPath: location.pathname } });
    }
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    onRemove?.(participant.id);
  };

  const handleApproveClick = (e) => {
    e.stopPropagation();
    gmModeration?.onApprove?.(participant.id);
  };

  const handleRejectClick = (e) => {
    e.stopPropagation();
    gmModeration?.onReject?.(participant.id);
  };

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
            <RoleBadge role={participant.role} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {user.username && (
              <span className="text-xs text-[#4D774E]">@{user.username}</span>
            )}
            {participant.characterName && (
              <span className="text-xs text-[#4D774E]">{participant.characterName}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {statusInfo && participant.status !== 'CONFIRMED' && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.class}`}>
            {statusInfo.label}
          </span>
        )}

        {gmModeration?.enabled && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleApproveClick}
              className="px-2 py-1 text-xs rounded bg-[#9DC88D]/30 text-[#164A41] hover:bg-[#9DC88D]/50 transition-colors"
              title="Схвалити заявку GM"
            >
              Схвалити
            </button>
            <button
              onClick={handleRejectClick}
              className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              title="Відхилити заявку GM"
            >
              Відхилити
            </button>
          </div>
        )}

        {canManage && participant.userId !== currentUserId && onRemove && (
          <button
            onClick={handleRemoveClick}
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
