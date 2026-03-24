import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import {
  StatusBadge,
  DateTimeDisplay,
  BackButton,
} from '@/components/shared';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Dice20 from '@/components/ui/icons/Dice20';

/**
 * SessionPreviewWidget — лівий віджет для не-учасників на /session/:id.
 *
 * Відображає інформацію про сесію з кнопкою "Приєднатися".
 *
 * @param {Object} session — дані сесії
 * @param {Function} onJoin — колбек приєднання ({ role: 'PLAYER' | 'GM' })
 * @param {boolean} canJoin — чи може юзер приєднатися
 */
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

  const formatDuration = (minutes) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} хв`;
    if (mins === 0) return `${hours} год`;
    return `${hours} год ${mins} хв`;
  };

  const getFreeSpots = () => {
    if (!session?.maxPlayers) return '∞';
    const currentPlayers =
      session.participants?.filter((participant) => participant.role === 'PLAYER').length || 0;
    return Math.max(0, session.maxPlayers - currentPlayers);
  };

  const getPlayerCount = () => {
    return session?.participants?.filter((participant) => participant.role === 'PLAYER').length || 0;
  };

  const handleJoin = async () => {
    setIsJoining(true);
    setJoinError(null);
    const result = await onJoin?.({
      role: 'PLAYER',
    });
    if (result?.success) {
      setShowJoinModal(false);
    } else {
      setJoinError(result?.error || 'Помилка при приєднанні');
    }
    setIsJoining(false);
  };

  const handleApplyAsGm = async () => {
    setIsApplyingGm(true);
    setJoinError(null);

    const result = await onJoin?.({
      role: 'GM',
    });

    if (result?.success) {
      setShowJoinModal(false);
    }

    if (!result?.success) {
      setJoinError(result?.error || 'Помилка при подачі заявки як GM');
    }

    setIsApplyingGm(false);
  };

  const organizerName = session?.owner?.displayName || session?.owner?.username || 'Організатор';
  const confirmedGm = session?.participants?.find(
    (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
  );
  const hasConfirmedGm = Boolean(confirmedGm);
  const confirmedGmName = confirmedGm?.user?.displayName || confirmedGm?.user?.username || null;
  const canRequestJoin = canJoin || canApplyAsGm;

  if (!session) return null;

  return (
    <DashboardCard
      title="Деталі сесії"
      actions={<BackButton to="/" label="Dashboard" variant="dark" />}
    >
      <div className="flex flex-col gap-5">
        {/* Заголовок + статус */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-xl font-bold text-[#164A41] flex-1 pr-3">
              {session.title}
            </h2>
            <StatusBadge status={session.status} />
          </div>
        </div>

        {/* Інформаційна сітка */}
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
              {getPlayerCount()}
              {session.maxPlayers ? ` / ${session.maxPlayers}` : ''} гравців
            </span>
          </div>
          {session.system && (
            <div className="flex items-center gap-2 text-[#4D774E]">
              <span>{session.system}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[#4D774E]">
            <span>Вільних: {getFreeSpots()}</span>
          </div>
          <div className="flex items-center gap-2 text-[#4D774E]">
            <span>Організатор: {organizerName}</span>
          </div>
          <div className="flex items-center gap-2 text-[#4D774E]">
            <span>GM: {confirmedGmName || 'Шукаємо GM'}</span>
          </div>
        </div>

        {/* Опис */}
        {session.description && (
          <div className="border-t border-[#9DC88D]/20 pt-4">
            <h4 className="text-sm font-bold text-[#164A41] mb-2">Опис</h4>
            <p className="text-sm text-[#4D774E] whitespace-pre-wrap">
              {session.description}
            </p>
          </div>
        )}

        {/* Кампанія */}
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

        {/* Ціна */}
        {session.price > 0 && (
          <div className="text-sm font-bold text-[#164A41]">
            {session.price} грн
          </div>
        )}

        {/* Помилка */}
        {joinError && (
          <div className="text-sm text-red-600 p-3 bg-red-50 rounded-lg">
            {joinError}
          </div>
        )}

        {/* Кнопка приєднання */}
        {canRequestJoin && (
          <Button
            onClick={() => setShowJoinModal(true)}
            variant="primary"
          >
            Приєднатися до сесії
          </Button>
        )}

        {!canRequestJoin && (
          <div className="text-sm text-[#4D774E] text-center p-3 bg-[#9DC88D]/10 rounded-lg">
            {session.campaign?.status === 'FINISHED'
              ? 'Кампанія завершена, приєднання до сесії недоступне'
              : session.status !== 'PLANNED'
              ? `Ця сесія ${
                  session.status === 'FINISHED'
                    ? 'вже завершена'
                    : session.status === 'ACTIVE'
                    ? 'вже в процесі'
                    : session.status === 'CANCELED'
                    ? 'скасована'
                    : 'недоступна'
                }`
              : 'Приєднання до цієї сесії зараз недоступне'}
          </div>
        )}
      </div>

      {/* Модалка приєднання */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-[#164A41] mb-4">
              Приєднатися до сесії
            </h3>
            <p className="text-sm text-[#4D774E] mb-4">
              {hasConfirmedGm
                ? 'Після підтвердження ви одразу приєднаєтесь до сесії як гравець.'
                : 'У сесії поки немає підтвердженого GM. Оберіть роль, на яку хочете податися.'}
            </p>
            <div className="flex flex-col gap-3">
              {!hasConfirmedGm && canJoin && (
                <Button
                  onClick={handleJoin}
                  isLoading={isJoining}
                  loadingText="Приєднання..."
                  variant="secondary"
                >
                  Приєднатися як гравець
                </Button>
              )}

              {!hasConfirmedGm && canApplyAsGm && (
                <Button
                  onClick={handleApplyAsGm}
                  isLoading={isApplyingGm}
                  loadingText="Відправка заявки..."
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
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinError(null);
                }}
                className="w-full py-2 border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
