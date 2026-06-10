import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import {
  DateTimeDisplay,
  RoleBadge,
  ConfirmModal,
  SessionTimeBadge,
  StatusBadge,
  VisibilityBadge,
} from '@/components/shared';
import useConfirmDialog from '@/hooks/useConfirmDialog';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import { getSessionStartState } from '../../utils/sessionStartRules';
import { HandCoins } from 'lucide-react';

const UI_LOCALE = 'uk-UA';





const getCardTitle = () => ('Деталі сесії');

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
  canLeave = false,
  onLeave,
  onStatusChange,
  onMarkAsFinished,
  showCampaignInfo = true,
  canNavigateToCampaignDirectly = false,
  campaignNavigationTarget = null,
  isLoading = false,
}) {
  const { openConfirm, confirmModalProps } = useConfirmDialog();

  const getPlayerCount = () => {
    if (Number.isFinite(Number(session?.participantsSummaryCount))) {
      return Number(session.participantsSummaryCount);
    }

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
  const entityType = isCampaignSession ? 'campaignSession' : 'oneShot';
  const canRenderCampaign = Boolean(showCampaignInfo && session?.campaign?.title);
  const campaignLink = campaignNavigationTarget || (session?.campaign?.id ? `/campaign/${session.campaign.id}` : null);
  const shouldRenderCampaignLink = Boolean(canRenderCampaign && campaignLink && canNavigateToCampaignDirectly);


  const cardTitle = getCardTitle();

  if (!session) return null;

  const startState = getSessionStartState(session?.startAt, session?.duration);

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
      : `Ви впевнені, що хочете ${statusLabels[newStatus] || 'змінити статус'} сесію?`;

    openConfirm({
      title: 'Змінити статус?',
      message,
      variant: newStatus === 'CANCELED' ? 'danger' : 'primary',
      confirmText: statusLabels[newStatus]
        ? `${statusLabels[newStatus].charAt(0).toUpperCase()}${statusLabels[newStatus].slice(1)}`
        : 'Змінити',
      cancelText: 'Відмінити',
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
            {['FINISHED', 'CANCELED'].includes(session.status)
              ? <StatusBadge status={session.status} />
              : <SessionTimeBadge session={session} />}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-brand-medium text-sm leading-tight truncate flex-1 min-w-0">
              {canRenderCampaign ? (
                <>
                  <span className="font-medium">Кампанія:</span>{' '}
                  {shouldRenderCampaignLink ? (
                    <Link to={campaignLink} className="underline hover:no-underline">
                      {session.campaign.title}
                    </Link>
                  ) : (
                    session.campaign.title
                  )}
                </>
              ) : null}
            </div>

            <div className="shrink-0 flex justify-end">
              {displayMyRole && <RoleBadge role={displayMyRole} size="md" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 p-4 bg-brand-light/10 rounded-xl">
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Data className="w-4 h-4 shrink-0" />
            <DateTimeDisplay value={session.startAt} format="long" fallback={formatStartAt(session.startAt)} />
          </div>
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Система:</span>
            <span>{session.system || 'Не вказана'}</span>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Timer className="w-4 h-4 shrink-0" />
            <time>{formatTimeOnly(session.startAt)}</time>
          </div>
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Доступність:</span>
            <VisibilityBadge visibility={session?.visibility} entityType={entityType} plainText />
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
          {session.price > 0 && (
            <div className="flex items-center gap-2 text-brand-medium text-sm">
              <HandCoins size={14} className="text-brand-primary" />
              <span>{session.price} Demo Coins</span>
            </div>
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
            {session.status === 'PLANNED' && canLeave && myRole && myRole !== 'OWNER' && !isSessionOwner && onLeave && (
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


SessionInfoWidget.propTypes = {
  session: PropTypes.object,
  myRole: PropTypes.string,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  canManage: PropTypes.bool,
  canStartSession: PropTypes.bool,
  canFinishSession: PropTypes.bool,
  canCancelSession: PropTypes.bool,
  canLeave: PropTypes.bool,
  onLeave: PropTypes.func,
  onStatusChange: PropTypes.func,
  onMarkAsFinished: PropTypes.func,
  showCampaignInfo: PropTypes.bool,
  canNavigateToCampaignDirectly: PropTypes.bool,
  campaignNavigationTarget: PropTypes.string,
  isLoading: PropTypes.bool,
};
