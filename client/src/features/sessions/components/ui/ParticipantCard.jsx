import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserAvatar, RoleBadge } from '@/components/shared';
import Star from '@/components/ui/icons/Star';

/**
 * Картка учасника сесії.
 * Вся картка є кліком — відкриває профіль (або переходить на публічну сторінку).
 * Кнопка видалення (✕) не тригерить перехід (stopPropagation).
 *
 * @param {Object}   participant   — об'єкт учасника (з user, role, characterName, status)
 * @param {boolean}  canManage     — чи може поточний юзер видаляти учасника
 * @param {boolean}  isOwner       — чи є цей учасник власником сесії
 * @param {number}   currentUserId — ID поточного юзера
 * @param {Function} onRemove      — колбек видалення (participantId)
 * @param {Function} [onViewProfile] — якщо передано, показує вбудований прев'ю замість переходу
 */
export default function ParticipantCard({
  participant,
  canManage = false,
  isOwner = false,
  currentUserId,
  onRemove,
  onViewProfile,
  gmModeration,
  playerModeration,
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

  const gmModerationConfig = gmModeration?.enabled
    ? {
      ...gmModeration,
      approveLabel: 'Схвалити',
      rejectLabel: 'Відхилити',
      approveTitle: 'Схвалити заявку GM',
      rejectTitle: 'Відхилити заявку GM',
    }
    : null;

  const playerModerationConfig = playerModeration?.enabled && !gmModerationConfig
    ? {
      ...playerModeration,
      approveLabel: 'Прийняти',
      rejectLabel: 'Відхилити',
      approveTitle: 'Схвалити заявку гравця',
      rejectTitle: 'Відхилити заявку гравця',
    }
    : null;

  const activeModeration = gmModerationConfig || playerModerationConfig;

  const handleApproveClick = (e) => {
    e.stopPropagation();
    activeModeration?.onApprove?.(participant.id);
  };

  const handleRejectClick = (e) => {
    e.stopPropagation();
    activeModeration?.onReject?.(participant.id);
  };

  return (
    <button
      type="button"
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      className="flex items-center justify-between p-3 border-2 border-brand-light/30 rounded-xl hover:border-brand-light/60 hover:bg-brand-light/5 transition-colors cursor-pointer w-full text-left"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <UserAvatar src={user.avatarUrl} name={displayName} size="sm" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-brand-dark truncate">
              {displayName}
            </span>
            {isOwner && (
              <span className="inline-flex items-center text-brand-accent" title="Власник" aria-label="Власник">
                <Star className="w-4 h-4" />
              </span>
            )}
            <RoleBadge role={participant.role} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {user.username && (
              <span className="text-xs text-brand-medium">@{user.username}</span>
            )}
            {participant.characterName && (
              <span className="text-xs text-brand-medium">{participant.characterName}</span>
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

        {activeModeration && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleApproveClick}
              className="px-2 py-1 text-xs rounded bg-brand-light/30 text-brand-dark hover:bg-brand-light/50 transition-colors"
              title={activeModeration.approveTitle}
            >
              {activeModeration.approveLabel}
            </button>
            <button
              onClick={handleRejectClick}
              className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              title={activeModeration.rejectTitle}
            >
              {activeModeration.rejectLabel}
            </button>
          </div>
        )}

        {canManage
          && participant.status !== 'PENDING'
          && !isOwner
          && participant.userId !== currentUserId
          && onRemove && (
          <button
            onClick={handleRemoveClick}
            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"
            title="Видалити учасника"
          >
            ✕
          </button>
        )}
      </div>
    </button>
  );
}
