import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import DashboardCard from "@/components/ui/DashboardCard";
import Button from "@/components/ui/Button";
import {
  StatusBadge,
  DateTimeDisplay,
  BackButton,
} from "@/components/shared";
import Data from "@/components/ui/icons/Data";
import Timer from "@/components/ui/icons/Timer";
import GroupPeople from "@/components/ui/icons/GroupPeople";
import Dice20 from "@/components/ui/icons/Dice20";

function formatDuration(minutes) {
  if (!minutes) return "";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins} хв`;
  if (mins === 0) return `${hours} год`;
  return `${hours} год ${mins} хв`;
}

function getPlayerCount(session) {
  return session?.participants?.filter((participant) => participant.role === "PLAYER").length || 0;
}

function getFreeSpots(session) {
  if (!session?.maxPlayers) return '∞';
  return String(Math.max(0, session.maxPlayers - getPlayerCount(session)));
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

function getJoinModalMessage(hasConfirmedGm) {
  return hasConfirmedGm
    ? 'Після підтвердження ви одразу приєднаєтесь як гравець.'
    : 'У сесії поки немає підтвердженого GM. Оберіть роль, на яку хочете податися.';
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-[#164A41] mb-4">Приєднатись до сесії</h3>
        <p className="text-sm text-[#4D774E] mb-4">{getJoinModalMessage(hasConfirmedGm)}</p>
        <div className="flex flex-col gap-3">
          {!hasConfirmedGm && canJoin && (
            <Button
              onClick={handleJoin}
              isLoading={isJoining}
              loadingText="Приєднання..."
              variant="secondary"
            >
              Приєднатись як гравець
            </Button>
          )}

          {!hasConfirmedGm && canApplyAsGm && (
            <Button
              onClick={handleApplyAsGm}
              isLoading={isApplyingGm}
              loadingText="Відправка..."
              variant={canJoin ? 'outline' : 'secondary'}
            >
              Податися як GM
            </Button>
          )}

          {hasConfirmedGm && (
            <Button
              onClick={handleJoin}
              isLoading={isJoining}
              loadingText="Приєднання..."
              variant="secondary"
            >
              Підтвердити приєднання
            </Button>
          )}

          <button
            onClick={closeModal}
            className="w-full py-2 border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
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
  onJoin,
  canJoin = false,
  canApplyAsGm = false,
  showCampaignInfo = true,
  canNavigateToCampaignDirectly = true,
}) {
  const navigate = useNavigate();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isApplyingGm, setIsApplyingGm] = useState(false);

  if (!session) return null;

  const organizerName = session.owner?.displayName || session.owner?.username || "Organizer";
  const confirmedGm = session.participants?.find(
    (participant) => participant.role === "GM" && participant.status === "CONFIRMED"
  );
  const hasConfirmedGm = Boolean(confirmedGm);
  const confirmedGmName = confirmedGm?.user?.displayName || confirmedGm?.user?.username || null;
  const canRequestJoin = canJoin || canApplyAsGm;

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
      actions={<BackButton to="/" label="Панель" variant="dark" />}
    >
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-xl font-bold text-[#164A41] flex-1 pr-3">{session.title}</h2>
            <StatusBadge status={session.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 bg-[#9DC88D]/10 rounded-xl">
          <div className="flex items-center gap-2 text-[#4D774E]">
            <Data className="w-4 h-4" />
            <DateTimeDisplay value={session.date} format="long" />
          </div>
          <div className="flex items-center gap-2 text-[#4D774E]">
            <Timer className="w-4 h-4" />
            <DateTimeDisplay value={session.date} format="time" />
          </div>
          {session.duration && (
            <div className="flex items-center gap-2 text-[#4D774E]">
              <Timer className="w-4 h-4" />
              <span>{formatDuration(session.duration)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[#4D774E]">
            <GroupPeople className="w-4 h-4" />
            <span>
              {getPlayerCount(session)}
              {session.maxPlayers ? ` / ${session.maxPlayers}` : ''} гравців
            </span>
          </div>
          {session.system && (
            <div className="flex items-center gap-2 text-[#4D774E]">
              <span>{session.system}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[#4D774E]">
            <span>Вільних: {getFreeSpots(session)}</span>
          </div>
          <div className="flex items-center gap-2 text-[#4D774E]">
            <span>Організатор: {organizerName}</span>
          </div>
          <div className="flex items-center gap-2 text-[#4D774E]">
            <span>GM: {confirmedGmName || 'Шукаємо GM'}</span>
          </div>
        </div>

        {session.description && (
          <div className="border-t border-[#9DC88D]/20 pt-4">
            <h4 className="text-sm font-bold text-[#164A41] mb-2">Опис</h4>
            <p className="text-sm text-[#4D774E] whitespace-pre-wrap">{session.description}</p>
          </div>
        )}

        <div className="border-t border-[#9DC88D]/20 pt-4">
          {session.campaign && showCampaignInfo ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-[#164A41]">Кампанія:</span>
              {canNavigateToCampaignDirectly ? (
                <button
                  onClick={() => navigate(`/campaign/${session.campaign.id}`)}
                  className="text-sm text-[#4D774E] hover:text-[#164A41] underline transition-colors"
                >
                  {session.campaign.title}
                </button>
              ) : (
                <span className="text-sm text-[#4D774E]">{session.campaign.title}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#4D774E]">
              <Dice20 className="w-4 h-4" />
              <span>{session.campaign ? 'Сесія кампанії' : 'One-shot сесія'}</span>
            </div>
          )}
        </div>

        {session.price > 0 && (
          <div className="text-sm font-bold text-[#164A41]">{session.price} грн</div>
        )}

        {joinError && (
          <div className="text-sm text-red-600 p-3 bg-red-50 rounded-lg">{joinError}</div>
        )}

        {canRequestJoin ? (
          <Button onClick={() => setShowJoinModal(true)} variant="primary">
            Приєднатись до сесії
          </Button>
        ) : (
          <div className="text-sm text-[#4D774E] text-center p-3 bg-[#9DC88D]/10 rounded-lg">
            {getUnavailableJoinMessage(session)}
          </div>
        )}
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
  canJoin: PropTypes.bool,
  canApplyAsGm: PropTypes.bool,
  showCampaignInfo: PropTypes.bool,
  canNavigateToCampaignDirectly: PropTypes.bool,
};
