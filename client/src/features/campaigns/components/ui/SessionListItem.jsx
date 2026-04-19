import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, DateTimeDisplay } from '@/components/shared';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';
import GroupPeople from '@/components/ui/icons/GroupPeople';

/**
 * SessionListItem — елемент списку сесій кампанії.
 *
 * Показує:
 * - Назву сесії, статус
 * - Дату, час, тривалість
 * - Кількість гравців / макс
 *
 * @param {Object} session — дані сесії
 * @param {number} index — порядковий номер (для відображення)
 */
export default function SessionListItem({
  session,
  index,
  campaignShareToken = null,
  onCancelAction,
  onDeleteAction,
}) {
  const navigate = useNavigate();

  const resolveParticipantCount = (sessionData) => {
    const numericCount = Number(
      sessionData?.participantsSummaryCount
      ?? sessionData?._count?.participants
      ?? sessionData?.participantsCount
      ?? sessionData?.currentPlayers
    );

    if (Number.isFinite(numericCount)) {
      return numericCount;
    }

    if (Array.isArray(sessionData?.participants)) {
      return sessionData.participants.length;
    }

    return 0;
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} хв`;
    if (mins === 0) return `${hours} год`;
    return `${hours} год ${mins} хв`;
  };

  const participantCount = resolveParticipantCount(session);

  const canCancelSession = Boolean(session?.actions?.canCancel);
  const canDeleteSession = Boolean(session?.actions?.canDelete);
  const hasModerationActions = Boolean(canCancelSession || canDeleteSession);
  const sessionTarget = campaignShareToken
    ? `/session/${session.id}?campaignShareToken=${encodeURIComponent(campaignShareToken)}`
    : `/session/${session.id}`;

  const handleOpenSession = () => {
    navigate(sessionTarget);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenSession();
    }
  };

  return (
    <div
      onClick={handleOpenSession}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Відкрити сесію ${session.title}`}
      className="w-full text-left p-4 border-2 border-brand-light/30 rounded-xl hover:border-brand-dark/30 hover:bg-brand-light/5 transition-all group block cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h4 className="font-bold text-brand-dark truncate group-hover:text-brand-medium">
            {typeof index === 'number' ? `Сесія #${index + 1} — ` : ''}
            {session.title}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {hasModerationActions && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCancelAction?.();
                }}
                disabled={!canCancelSession}
                className="px-2 py-1 text-xs rounded border border-brand-accent/60 text-brand-dark hover:bg-brand-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Скасувати сесію"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteAction?.();
                }}
                disabled={!canDeleteSession}
                className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Видалити сесію"
              >
                Видалити
              </button>
            </>
          )}
          <StatusBadge status={session.status} size="sm" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-brand-medium flex-wrap">
        <div className="flex items-center gap-1">
          <Data className="w-4 h-4" />
          <DateTimeDisplay value={session.date} format="long" />
        </div>
        <div className="flex items-center gap-1">
          <Timer className="w-4 h-4" />
          <DateTimeDisplay value={session.date} format="time" />
        </div>
        {session.duration && (
          <div className="flex items-center gap-1">
            <Timer className="w-4 h-4" />
            <span>{formatDuration(session.duration)}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <GroupPeople className="w-4 h-4" />
          <span>
            {participantCount}
            {session.maxPlayers ? `/${session.maxPlayers}` : ''} гравців
          </span>
        </div>
      </div>

      {session.description && (
        <p className="text-xs text-brand-medium/70 mt-2 line-clamp-2">
          {session.description}
        </p>
      )}
    </div>
  );
}
