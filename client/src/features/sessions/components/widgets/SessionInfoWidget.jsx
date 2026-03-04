import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import {
  StatusBadge,
  RoleBadge,
  DateTimeDisplay,
  ConfirmModal,
} from '@/components/shared';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Dice20 from '@/components/ui/icons/Dice20';
import { getSessionStartState } from '../../utils/sessionStartRules';

/**
 * SessionInfoWidget — лівий віджет у Full Mode (для учасників).
 *
 * Показує повну інформацію про сесію:
 * - Назву, статус, роль юзера
 * - Дату, час, тривалість
 * - Систему гри, кількість гравців
 * - Опис, нотатки GM
 * - Зв'язок з кампанією
 * - Дії: покинути сесію, управління статусом (GM)
 *
 * @param {Object} session — дані сесії
 * @param {string} myRole — роль юзера в сесії/кампанії (OWNER | GM | PLAYER)
 * @param {boolean} canManage — чи може юзер управляти сесією
 * @param {Function} onLeave — колбек виходу з сесії
 * @param {Function} onStatusChange — колбек зміни статусу (newStatus)
 * @param {boolean} isLoading — чи йде завантаження
 */
export default function SessionInfoWidget({
  session,
  myRole,
  canManage = false,
  onLeave,
  onStatusChange,
  onMarkAsFinished,
  isLoading = false,
}) {
  const navigate = useNavigate();
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    variant: 'primary',
  });

  const closeConfirmModal = useCallback(() => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Форматування тривалості
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

  const handleLeave = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Покинути сесію?',
      message: 'Ви впевнені, що хочете покинути цю сесію?',
      variant: 'danger',
      onConfirm: () => {
        closeConfirmModal();
        onLeave?.();
      },
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

    setConfirmModal({
      isOpen: true,
      title: `Змінити статус?`,
      message,
      variant: newStatus === 'CANCELED' ? 'danger' : 'primary',
      onConfirm: () => {
        closeConfirmModal();
        onStatusChange?.(newStatus);
      },
    });
  };

  if (!session) return null;

  const startState = getSessionStartState(session?.date, session?.duration);

  const handleMarkAsFinished = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Позначити як проведену?',
      message: 'Сесія буде позначена як проведена без запуску через кнопку "Розпочати". Продовжити?',
      variant: 'primary',
      onConfirm: () => {
        closeConfirmModal();
        if (onMarkAsFinished) {
          onMarkAsFinished();
          return;
        }
        onStatusChange?.('FINISHED');
      },
    });
  };

  return (
    <DashboardCard title="Інформація про сесію">
      <div className="flex flex-col gap-5">
        {/* Заголовок та статус */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-xl font-bold text-[#164A41] flex-1 pr-3">
              {session.title}
            </h2>
            <StatusBadge status={session.status} />
          </div>
          {myRole && <RoleBadge role={myRole} size="md" />}
        </div>

        {/* Основна інформація */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-[#9DC88D]/10 rounded-xl">
          {/* Дата */}
          <div className="flex items-center gap-2 text-[#4D774E]">
            <Data className="w-4 h-4" />
            <DateTimeDisplay value={session.date} format="long" />
          </div>
          {/* Час */}
          <div className="flex items-center gap-2 text-[#4D774E]">
            <Timer className="w-4 h-4" />
            <DateTimeDisplay value={session.date} format="time" />
          </div>
          {/* Тривалість */}
          {session.duration && (
            <div className="flex items-center gap-2 text-[#4D774E]">
              <Timer className="w-4 h-4" />
              <span>{formatDuration(session.duration)}</span>
            </div>
          )}
          {/* Гравці */}
          <div className="flex items-center gap-2 text-[#4D774E]">
            <GroupPeople className="w-4 h-4" />
            <span>
              {getPlayerCount()}
              {session.maxPlayers ? ` / ${session.maxPlayers}` : ''} гравців
            </span>
          </div>
          {/* Система */}
          {session.system && (
            <div className="flex items-center gap-2 text-[#4D774E]">
              <span>{session.system}</span>
            </div>
          )}
          {/* Вільних місць */}
          <div className="flex items-center gap-2 text-[#4D774E]">
            <span>Вільних: {getFreeSpots()}</span>
          </div>
          {/* GM */}
          {session.creator && (
            <div className="flex items-center gap-2 text-[#4D774E]">
              <span>
                {session.creator.displayName || session.creator.username || 'GM'}
              </span>
            </div>
          )}
          {/* Локація */}
          {session.location && (
            <div className="flex items-center gap-2 text-[#4D774E]">
              <span>{session.location}</span>
            </div>
          )}
        </div>

        {/* Опис */}
        {session.description && (
          <div className="border-t border-[#9DC88D]/20 pt-4">
            <h4 className="text-sm font-bold text-[#164A41] mb-2">Опис сесії</h4>
            <p className="text-sm text-[#4D774E] whitespace-pre-wrap">
              {session.description}
            </p>
          </div>
        )}

        {/* Нотатки GM */}
        {session.notes && (
          <div className="p-4 bg-[#F1B24A]/10 rounded-xl border-2 border-[#F1B24A]/30">
            <h4 className="text-sm font-bold text-[#164A41] mb-2">Нотатки від GM</h4>
            <p className="text-sm text-[#4D774E] whitespace-pre-wrap">
              {session.notes}
            </p>
          </div>
        )}

        {/* Кампанія */}
        <div className="border-t border-[#9DC88D]/20 pt-4">
          {session.campaign ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-[#164A41]">Кампанія:</span>
              <button
                onClick={() => navigate(`/campaign/${session.campaign.id}`)}
                className="text-sm text-[#4D774E] hover:text-[#164A41] underline transition-colors"
              >
                {session.campaign.title}
              </button>
              {session.campaign.system && (
                <span className="text-xs px-2 py-0.5 bg-[#9DC88D]/20 rounded">
                  {session.campaign.system}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#4D774E]">
              <Dice20 className="w-4 h-4" />
              <span>One-shot сесія</span>
            </div>
          )}
        </div>

        {/* Ціна */}
        {session.price > 0 && (
          <div className="text-sm font-bold text-[#164A41]">
            {session.price} грн
          </div>
        )}

        {/* Дії */}
        <div className="border-t border-[#9DC88D]/20 pt-4 flex flex-col gap-3">
          {/* Покинути сесію */}
          {session.status === 'PLANNED' && onLeave && (
            <Button
              onClick={handleLeave}
              variant="danger"
              isLoading={isLoading}
              loadingText="Вихід..."
            >
              Покинути сесію
            </Button>
          )}

          {/* Управління статусом (GM/Owner) */}
          {canManage && (
            <div className="pt-2 border-t border-[#9DC88D]/20">
              <h4 className="font-medium text-[#164A41] mb-2 text-sm">
                Управління статусом
              </h4>
              <div className="flex gap-2 flex-wrap">
                {session.status === 'PLANNED' && startState.canShowStartButton && (
                  <button
                    onClick={() => handleStatusChange('ACTIVE')}
                    className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                  >
                    Розпочати
                  </button>
                )}
                {session.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleStatusChange('FINISHED')}
                    className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                  >
                    Завершити
                  </button>
                )}
                {session.status === 'PLANNED' && (
                  <button
                    onClick={() => handleStatusChange('CANCELED')}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    Скасувати
                  </button>
                )}
                {session.status === 'PLANNED' && startState.canMarkAsFinished && (
                  <button
                    onClick={handleMarkAsFinished}
                    className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                  >
                    Позначити як проведену
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Модалка підтвердження */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </DashboardCard>
  );
}
