import React, { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import DashboardCard from "@/components/ui/DashboardCard";
import Button from "@/components/ui/Button";
import {
  BaseModal,
  SessionTimeBadge,
  DateTimeDisplay,
  BackButton,
  StatusBadge,
} from "@/components/shared";
import Data from "@/components/ui/icons/Data";
import Timer from "@/components/ui/icons/Timer";
import GroupPeople from "@/components/ui/icons/GroupPeople";
import { VisibilityBadge } from '@/components/shared';

function getEntityType(session) {
  return session?.campaign ? 'campaignSession' : 'oneShot';
}

function getUnavailableJoinMessage(session) {
  if (session.campaign?.status === 'FINISHED') {
    return 'Кампанія завершена, приєднання до сесії недоступне';
  }

  if (session.status !== 'PLANNED') {
    const statusMessages = {
      FINISHED: 'вже завершена',
      ACTIVE: 'вже в процесі',
      CANCELED: 'скасована',
    };

    return `Ця сесія ${statusMessages[session.status] || 'нова'}`;
  }

  return 'Приєднання до цієї сесії зараз недоступне';
}

function getJoinModalMessage({ hasConfirmedGm, canApplyAsGm }) {
  if (hasConfirmedGm) {
    return 'Після підтвердження ви одразу приєднаєтесь як гравець.';
  }

  if (!canApplyAsGm) {
    return 'Бажаєте приєднатися як гравець?';
  }

  return 'У сесії поки немає підтвердженого GM. Оберіть роль, на яку хочете податися.';
}

async function submitJoinRequest({ onJoin, role, setJoinError, setShowJoinModal }) {
  setJoinError(null);

  const result = await onJoin?.({ role });
  if (result?.success) {
    setShowJoinModal(false);
    return;
  }

  setJoinError(
    result?.error ||
    (role === 'GM' ? 'Не вдалося подати заявку як GM' : 'Не вдалося приєднатися до сесії')
  );
}

function SessionJoinModal({
  hasConfirmedGm,
  canJoin,
  canApplyAsGm,
  isJoining,
  isApplyingGm,
  handleJoin,
  handleApplyAsGm,
  closeModal,
}) {
  return (
    <BaseModal
      isOpen={true}
      onClose={closeModal}
      closeWhileLoading={false}
      isLoading={isJoining || isApplyingGm}
      panelClassName="max-w-md"
    >
      <div className="rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-bold text-brand-dark">Приєднатись до сесії</h3>
        <p className="mb-6 text-brand-medium">{getJoinModalMessage({ hasConfirmedGm, canApplyAsGm })}</p>
        <div className="flex flex-row flex-wrap justify-center gap-3">
          <Button
            onClick={closeModal}
            variant="outline"
            fullWidth={false}
            className="min-w-[170px]"
          >
            Скасувати
          </Button>

          {!hasConfirmedGm && canJoin && (
            <Button
              onClick={handleJoin}
              isLoading={isJoining}
              loadingText="Приєднання..."
              variant="primary"
              fullWidth={false}
              className="min-w-[170px]"
            >
              Приєднатись як гравець
            </Button>
          )}

          {!hasConfirmedGm && canApplyAsGm && (
            <Button
              onClick={handleApplyAsGm}
              isLoading={isApplyingGm}
              loadingText="Відправка..."
              variant={canJoin ? 'outline' : 'primary'}
              fullWidth={false}
              className="min-w-[170px]"
            >
              Податися як GM
            </Button>
          )}

          {hasConfirmedGm && (
            <Button
              onClick={handleJoin}
              isLoading={isJoining}
              loadingText="Приєднання..."
              variant="primary"
              fullWidth={false}
              className="min-w-[170px]"
            >
              Приєднатися
            </Button>
          )}
        </div>
      </div>
    </BaseModal>
  );
}

SessionJoinModal.propTypes = {
  hasConfirmedGm: PropTypes.bool.isRequired,
  canJoin: PropTypes.bool.isRequired,
  canApplyAsGm: PropTypes.bool.isRequired,
  isJoining: PropTypes.bool.isRequired,
  isApplyingGm: PropTypes.bool.isRequired,
  handleJoin: PropTypes.func.isRequired,
  handleApplyAsGm: PropTypes.func.isRequired,
  closeModal: PropTypes.func.isRequired,
};

export default function SessionPagePreviewWidget({
  session,
  showCampaignInfo = true,
  canNavigateToCampaignDirectly = false,
  campaignNavigationTarget = null,
  onJoin,
  canJoin = false,
  canApplyAsGm = false,
}) {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isApplyingGm, setIsApplyingGm] = useState(false);

  if (!session) return null;

  const organizerName = session.owner?.displayName || session.owner?.username || "Organizer";
  const summaryPlayersCount = Number(session?.participantsSummaryCount);
  const playersCount = Number.isFinite(summaryPlayersCount)
    ? summaryPlayersCount
    : (session.participants?.filter((participant) => participant.role === 'PLAYER').length || 0);
  const confirmedGm = session.participants?.find(
    (participant) => participant.role === "GM" && participant.status === "CONFIRMED"
  );
  const hasConfirmedGm = typeof session?.hasConfirmedGm === 'boolean'
    ? session.hasConfirmedGm
    : Boolean(confirmedGm);
  const canRequestJoin = canJoin || canApplyAsGm;
  const canRenderCampaign = Boolean(showCampaignInfo && session?.campaign?.title);
  const campaignLink = campaignNavigationTarget || (session?.campaign?.id ? `/campaign/${session.campaign.id}` : null);
  const shouldRenderCampaignLink = Boolean(canRenderCampaign && campaignLink && canNavigateToCampaignDirectly);

  const closeJoinModal = () => {
    setShowJoinModal(false);
    setJoinError(null);
  };

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      await submitJoinRequest({
        onJoin,
        role: "PLAYER",
        setJoinError,
        setShowJoinModal,
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleApplyAsGm = async () => {
    setIsApplyingGm(true);
    try {
      await submitJoinRequest({
        onJoin,
        role: "GM",
        setJoinError,
        setShowJoinModal,
      });
    } finally {
      setIsApplyingGm(false);
    }
  };

  return (
    <DashboardCard
      title="Деталі сесії"
      actions={<BackButton to="/" label="Назад" variant="dark" />}
    >
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
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 p-4 bg-brand-light/10 rounded-xl">
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Data className="w-4 h-4 shrink-0" />
            <DateTimeDisplay value={session.date} format="long" />
          </div>
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Система:</span>
            <span>{session.system || 'Не вказана'}</span>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Timer className="w-4 h-4 shrink-0" />
            <time>{session.date ? new Date(session.date).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time>
          </div>
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Доступність:</span>
            <VisibilityBadge visibility={session?.visibility} entityType={getEntityType(session)} plainText />
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <GroupPeople className="w-4 h-4 shrink-0" />
            <span>
              {playersCount}
              {session.maxPlayers ? ` / ${session.maxPlayers}` : ''} гравців
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

        {session.description && (
          <div className="border-t border-brand-light/20 pt-3">
            <h4 className="text-sm font-bold text-brand-dark mb-3">Опис</h4>
            <p className="text-sm text-brand-medium whitespace-pre-wrap leading-relaxed">
              {session.description?.trim() || 'Опис відсутній'}
            </p>
          </div>
        )}

        {joinError && (
          <div className="text-sm text-red-600 p-3 bg-red-50 rounded-lg">{joinError}</div>
        )}

        <div className="mt-auto">
          {canRequestJoin ? (
            <Button onClick={() => setShowJoinModal(true)} variant="primary" fullWidth className="w-full min-h-[43px]">
              Приєднатись до сесії
            </Button>
          ) : (
            <div className="text-sm text-brand-medium text-center p-3 bg-brand-light/10 rounded-lg">
              {getUnavailableJoinMessage(session)}
            </div>
          )}
        </div>
      </div>

      {showJoinModal && (
        <SessionJoinModal
          hasConfirmedGm={hasConfirmedGm}
          canJoin={canJoin}
          canApplyAsGm={canApplyAsGm}
          isJoining={isJoining}
          isApplyingGm={isApplyingGm}
          handleJoin={handleJoin}
          handleApplyAsGm={handleApplyAsGm}
          closeModal={closeJoinModal}
        />
      )}
    </DashboardCard>
  );
}

SessionPagePreviewWidget.propTypes = {
  session: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
    status: PropTypes.string,
    date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    duration: PropTypes.number,
    maxPlayers: PropTypes.number,
    system: PropTypes.string,
    description: PropTypes.string,
    price: PropTypes.number,
    visibility: PropTypes.string,
    owner: PropTypes.shape({
      displayName: PropTypes.string,
      username: PropTypes.string,
    }),
    campaign: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      title: PropTypes.string,
      status: PropTypes.string,
    }),
    participants: PropTypes.arrayOf(
      PropTypes.shape({
        role: PropTypes.string,
        status: PropTypes.string,
        user: PropTypes.shape({
          displayName: PropTypes.string,
          username: PropTypes.string,
        }),
      })
    ),
  }),
  onJoin: PropTypes.func,
  showCampaignInfo: PropTypes.bool,
  canNavigateToCampaignDirectly: PropTypes.bool,
  campaignNavigationTarget: PropTypes.string,
  canJoin: PropTypes.bool,
  canApplyAsGm: PropTypes.bool,
};
