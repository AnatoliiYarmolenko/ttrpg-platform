import React, { useEffect, useMemo, useState } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import {
  DateTimeDisplay,
  RoleBadge,
  ConfirmModal,
} from '@/components/shared';
import useConfirmDialog from '@/hooks/useConfirmDialog';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import { getSessionStartState } from '../../utils/sessionStartRules';

const UI_LOCALE = 'uk-UA';

const CAMPAIGN_SESSION_VISIBILITY_LABELS = {
  PRIVATE: 'Звичайна сесія',
  PUBLIC: 'Гостьова сесія',
};

const ONE_SHOT_VISIBILITY_LABELS = {
  PUBLIC: 'Публічна сесія',
  PRIVATE: 'Сесія з підтвердженням',
  LINK_ONLY: 'Сесія за посиланням',
};

function selectRelativeUnit(diffMs) {
  const absMs = Math.abs(diffMs);

  if (absMs < 60 * 1000) {
    return { unit: 'second', value: Math.round(diffMs / 1000) };
  }

  if (absMs < 60 * 60 * 1000) {
    return { unit: 'minute', value: Math.round(diffMs / (60 * 1000)) };
  }

  if (absMs < 24 * 60 * 60 * 1000) {
    return { unit: 'hour', value: Math.round(diffMs / (60 * 60 * 1000)) };
  }

  return { unit: 'day', value: Math.round(diffMs / (24 * 60 * 60 * 1000)) };
}

function buildRelativeSessionTime(date, status, nowMs) {
  if (!date || status !== 'PLANNED') {
    return null;
  }

  const startDate = new Date(date);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const diffMs = startDate.getTime() - nowMs;
  if (diffMs <= 30 * 1000 && diffMs >= -30 * 1000) {
    return 'Почнеться зовсім скоро';
  }

  const relativeTime = new Intl.RelativeTimeFormat(UI_LOCALE, { numeric: 'auto' });
  const { unit, value } = selectRelativeUnit(diffMs);
  return `Почнеться ${relativeTime.format(value, unit)}`;
}

const getCardTitle = (session) => ('Деталі сесії');

const formatStartAt = (value) => {
  if (!value) {
    return 'Дата не вказана';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Дата не вказана';
  }

  return date.toLocaleString(UI_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatTimeOnly = (value) => {
  if (!value) {
    return '--:--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return date.toLocaleTimeString(UI_LOCALE, { hour: '2-digit', minute: '2-digit' });
};

export default function SessionInfoWidget({
  session,
  myRole,
  currentUserId,
  canManage = false,
  canStartSession = false,
  canFinishSession = false,
  canCancelSession = false,
  onLeave,
  onStatusChange,
  onMarkAsFinished,
  showCampaignInfo = true,
  isLoading = false,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { openConfirm, confirmModalProps } = useConfirmDialog();

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setNowMs(Date.now());
    }, 30 * 1000);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, []);

  const getPlayerCount = () => {
    // If participants array is available with actual data, use it
    if (Array.isArray(session?.participants) && session.participants.length > 0) {
      return session.participants.filter((participant) => participant.role === 'PLAYER').length;
    }

    // Fallback to summary count (server-provided participant count)
    if (Number.isFinite(Number(session?.participantsSummaryCount))) {
      return Number(session.participantsSummaryCount);
    }

    // Last resort: count from array even if empty
    if (Array.isArray(session?.participants)) {
      return session.participants.filter((participant) => participant.role === 'PLAYER').length;
    }

    return 0;
  };

  const displayMyRole = myRole;
  const isSessionOwner = Number(session?.ownerId) === Number(currentUserId);
  const organizerName = session?.owner?.displayName || session?.owner?.username || null;
  const playersCount = getPlayerCount();
  const playersCapacity = Number(session?.maxPlayers);
  const hasPlayersCapacity = Number.isFinite(playersCapacity) && playersCapacity > 0;
  const isCampaignSession = Boolean(session?.campaign?.id || session?.campaignId);
  const visibilityLabels = isCampaignSession
    ? CAMPAIGN_SESSION_VISIBILITY_LABELS
    : ONE_SHOT_VISIBILITY_LABELS;
  const availabilityLabel = visibilityLabels[session?.visibility]
    || (isCampaignSession
      ? CAMPAIGN_SESSION_VISIBILITY_LABELS.PRIVATE
      : ONE_SHOT_VISIBILITY_LABELS.PRIVATE);

  if (!session) return null;

  const startState = getSessionStartState(session?.date, session?.duration);

  const relativeSessionTime = useMemo(
    () => buildRelativeSessionTime(session?.date, session?.status, nowMs),
    [nowMs, session?.date, session?.status]
  );
  const cardTitle = getCardTitle(session);

  const handleLeave = () => {
    openConfirm({
      title: 'Покинути сесію?',
      message: 'Ви впевнені, що хочете покинути цю сесію?',
      variant: 'danger',
      confirmText: 'Вийти',
      onConfirm: onLeave,
    });
  };

  const handleStatusChange = (newStatus) => {
    const statusLabels = {
      ACTIVE: 'розпочати',
      FINISHED: 'завершити',
      CANCELED: 'скасувати',
    };

    const isStartAction = newStatus === 'ACTIVE';
    const message = isStartAction && startState.warningMessage
      ? `${startState.warningMessage} Підтвердити запуск сесії?`
      : `Ви впевнені, що хочете ${statusLabels[newStatus] || 'змінити статус'} сесії?`;

    openConfirm({
      title: 'Змінити статус?',
      message,
      variant: newStatus === 'CANCELED' ? 'danger' : 'primary',
      confirmText: statusLabels[newStatus]
        ? `${statusLabels[newStatus].charAt(0).toUpperCase()}${statusLabels[newStatus].slice(1)}`
        : 'Змінити',
      onConfirm: () => onStatusChange?.(newStatus),
    });
  };

  const handleMarkAsFinished = () => {
    openConfirm({
      title: 'Позначити як проведену?',
      message: 'Сесія буде позначена як проведена без запуску через кнопку "Розпочати". Продовжити?',
      variant: 'primary',
      confirmText: 'Позначити',
      onConfirm: () => {
        if (onMarkAsFinished) {
          onMarkAsFinished();
          return;
        }
        onStatusChange?.('FINISHED');
      },
    });
  };

  return (
    <DashboardCard title={cardTitle}>
      <div className="flex flex-col gap-4 h-full">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-bold text-brand-dark leading-tight truncate flex-1 min-w-0">
              {session.title}
            </h3>
            {relativeSessionTime && (
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-brand-light/20 text-brand-dark text-sm font-medium whitespace-nowrap shrink-0">
                <Timer className="w-4 h-4 shrink-0" />
                <span>{relativeSessionTime}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-brand-medium text-sm leading-tight truncate flex-1 min-w-0">
              {session.campaign?.title && showCampaignInfo ? (
                <>
                  <span className="font-medium">Кампанія:</span> {session.campaign.title}
                </>
              ) : (
                <>
                  <span className="font-medium">Формат:</span> One-shot
                </>
              )}
            </div>

            <div className="shrink-0 flex justify-end">
              {displayMyRole && <RoleBadge role={displayMyRole} size="md" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 p-4 bg-brand-light/10 rounded-xl">
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Data className="w-4 h-4 shrink-0" />
            <DateTimeDisplay value={session.date} format="long" fallback={formatStartAt(session.date)} />
          </div>
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Система:</span>
            <span>{session.system || 'Не вказана'}</span>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Timer className="w-4 h-4 shrink-0" />
            <time>{formatTimeOnly(session.date)}</time>
          </div>
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Доступність:</span>
            <span>{availabilityLabel}</span>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <GroupPeople className="w-4 h-4 shrink-0" />
            <span>
              {hasPlayersCapacity ? `${playersCount} / ${playersCapacity} гравців` : `${playersCount} гравців`}
            </span>
          </div>
          {organizerName ? (
            <div className="flex items-center gap-2 text-brand-medium text-sm">
              <span className="font-medium">Організатор:</span>
              <span>{organizerName}</span>
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        <div className="border-t border-brand-light/20 pt-3">
          <h4 className="text-sm font-bold text-brand-dark mb-3">Опис</h4>
          <p className="text-sm text-brand-medium whitespace-pre-wrap leading-relaxed">
            {session.description?.trim() || 'Опис відсутній'}
          </p>
        </div>

        <div className="border-t border-brand-light/20 pt-4 mt-auto">
          <div className="grid grid-flow-col auto-cols-fr gap-3 w-full">
            {session.status === 'PLANNED' && myRole && myRole !== 'OWNER' && !isSessionOwner && onLeave && (
              <Button
                onClick={handleLeave}
                variant="danger"
                isLoading={isLoading}
                loadingText="Вихід..."
                fullWidth={true}
                className="w-full"
              >
                Покинути сесію
              </Button>
            )}

            {canManage && canStartSession && session.status === 'PLANNED' && startState.canShowStartButton && (
              <Button
                onClick={() => handleStatusChange('ACTIVE')}
                variant="primary"
                fullWidth={true}
                className="w-full"
              >
                Розпочати
              </Button>
            )}

            {canManage && canFinishSession && session.status === 'ACTIVE' && (
              <Button
                onClick={() => handleStatusChange('FINISHED')}
                variant="secondary"
                fullWidth={true}
                className="w-full"
              >
                Завершити
              </Button>
            )}

            {canManage && canCancelSession && (session.status === 'PLANNED' || session.status === 'ACTIVE') && (
              <Button
                onClick={() => handleStatusChange('CANCELED')}
                variant="danger"
                fullWidth={true}
                className="w-full"
              >
                Скасувати
              </Button>
            )}

            {canManage && canFinishSession && session.status === 'PLANNED' && startState.canMarkAsFinished && (
              <Button
                onClick={handleMarkAsFinished}
                variant="secondary"
                fullWidth={true}
                className="w-full"
              >
                Позначити як проведену
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        {...confirmModalProps}
      />
    </DashboardCard>
  );
}
