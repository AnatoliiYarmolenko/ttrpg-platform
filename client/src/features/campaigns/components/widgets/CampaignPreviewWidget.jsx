import React, { useState } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import {
  VisibilityBadge,
  DateTimeDisplay,
  BackButton,
} from '@/components/shared';
import Data from '@/components/ui/icons/Data';
import GroupPeople from '@/components/ui/icons/GroupPeople';

/**
 * CampaignPreviewWidget — лівий віджет для не-учасників на /campaign/:id.
 *
 * Відображає інформацію про кампанію з кнопкою "Подати заявку".
 *
 * @param {Object} campaign — дані кампанії
 * @param {Function} onJoinRequest — колбек подачі заявки (message)
 * @param {boolean} canJoin — чи може юзер подати заявку
 * @param {string|null} pendingRequestStatus — статус вже поданої заявки (якщо є)
 */
export default function CampaignPreviewWidget({
  campaign,
  onJoinRequest,
  canJoin = false,
  pendingRequestStatus = null,
}) {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinRequest = async () => {
    setIsJoining(true);
    setJoinError(null);
    const result = await onJoinRequest?.('');
    if (result?.success) {
      setShowJoinModal(false);
    } else {
      setJoinError(result?.error || 'Помилка при подачі заявки');
    }
    setIsJoining(false);
  };

  if (!campaign) return null;

  return (
    <DashboardCard
      title="Деталі кампанії"
      actions={<BackButton to="/" label="Dashboard" variant="dark" />}
    >
      <div className="flex flex-col gap-5">
        {/* Заголовок + видимість */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-xl font-bold text-[#164A41] flex-1 pr-3">
              {campaign.title}
            </h2>
            <VisibilityBadge visibility={campaign.visibility} />
          </div>
        </div>

        {/* Інформаційна сітка */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-[#9DC88D]/10 rounded-xl">
          {/* Система */}
          {campaign.system && (
            <div className="flex items-center gap-2 text-[#4D774E]">
              <span>{campaign.system}</span>
            </div>
          )}
          {/* Учасники */}
          <div className="flex items-center gap-2 text-[#4D774E]">
            <GroupPeople className="w-4 h-4" />
            <span>{campaign.members?.length || campaign._count?.members || 0} учасників</span>
          </div>
          {/* Власник/Майстер */}
          {campaign.owner && (
            <div className="flex items-center gap-2 text-[#4D774E]">
              <span>{campaign.owner.displayName || campaign.owner.username || 'Власник'}</span>
            </div>
          )}
          {/* Сесій */}
          <div className="flex items-center gap-2 text-[#4D774E]">
            <Data className="w-4 h-4" />
            <span>{campaign.sessions?.length || campaign._count?.sessions || 0} сесій</span>
          </div>
          {/* Створено */}
          <div className="flex items-center gap-2 text-[#4D774E] col-span-2">
            <Data className="w-4 h-4" />
            <span>Створено: </span>
            <DateTimeDisplay value={campaign.createdAt} format="long" />
          </div>
        </div>

        {/* Опис */}
        {campaign.description && (
          <div className="border-t border-[#9DC88D]/20 pt-4">
            <h4 className="text-sm font-bold text-[#164A41] mb-2">Опис</h4>
            <p className="text-sm text-[#4D774E] whitespace-pre-wrap">
              {campaign.description}
            </p>
          </div>
        )}

        {/* Зображення */}
        {campaign.imageUrl && (
          <div className="border-t border-[#9DC88D]/20 pt-4">
            <div className="w-full h-48 rounded-xl overflow-hidden">
              <img
                src={campaign.imageUrl}
                alt={campaign.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Помилка */}
        {joinError && (
          <div className="text-sm text-red-600 p-3 bg-red-50 rounded-lg">
            {joinError}
          </div>
        )}

        {/* Статус вже поданої заявки */}
        {pendingRequestStatus && (
          <div className="text-sm text-[#4D774E] text-center p-3 bg-[#F1B24A]/10 rounded-lg border border-[#F1B24A]/30">
            Ваша заявка вже подана і очікує на розгляд
          </div>
        )}

        {/* Кнопка подачі заявки */}
        {canJoin && !pendingRequestStatus && (
          <Button
            onClick={() => setShowJoinModal(true)}
            variant="primary"
          >
            Подати заявку на вступ
          </Button>
        )}

        {!canJoin && !pendingRequestStatus && (
          <div className="text-sm text-[#4D774E] text-center p-3 bg-[#9DC88D]/10 rounded-lg">
            Ця кампанія недоступна для приєднання
          </div>
        )}
      </div>

      {/* Модалка подачі заявки */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-[#164A41] mb-4">
              Подати заявку на вступ
            </h3>
            <p className="text-sm text-[#4D774E] mb-4">
              Після підтвердження заявку буде надіслано організатору кампанії.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinError(null);
                }}
                className="flex-1 py-2 border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Скасувати
              </button>
              <Button
                onClick={handleJoinRequest}
                isLoading={isJoining}
                loadingText="Надсилання..."
                variant="secondary"
                fullWidth={false}
                className="flex-1"
              >
                Надіслати заявку
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
