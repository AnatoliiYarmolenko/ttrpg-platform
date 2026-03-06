import React, { useState } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import { BackButton, ConfirmModal, EmptyState } from '@/components/shared';
import SessionListItem from '../ui/SessionListItem';
import CreateSessionForm from '@/features/dashboard/components/widgets/CreateSessionForm';

/**
 * CampaignSessionsWidget — лівий віджет у Full Mode, таб "Сесії" (default).
 *
 * Показує список сесій кампанії.
 * Майстер/Власник може створювати нові сесії.
 *
 * @param {Object} campaign — дані кампанії (з sessions)
 * @param {boolean} canCreateSessions — чи може юзер створювати сесії
 * @param {boolean} canOwnerOverride — чи може власник кампанії керувати чужими сесіями
 */
export default function CampaignSessionsWidget({
  campaign,
  canCreateSessions = false,
  canOwnerOverride = false,
  onCancelForeignSession,
  onDeleteForeignSession,
  onSessionCreated,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'primary',
    onConfirm: null,
  });

  if (!campaign) return null;

  const sessions = campaign.sessions || [];

  // Сортуємо: спочатку PLANNED/ACTIVE (за датою desc), потім FINISHED/CANCELED
  const sortedSessions = [...sessions].sort((a, b) => {
    const activeStatuses = ['PLANNED', 'ACTIVE'];
    const aIsActive = activeStatuses.includes(a.status);
    const bIsActive = activeStatuses.includes(b.status);

    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;

    // Всередині групи — за датою (новіші спочатку)
    return new Date(b.date) - new Date(a.date);
  });

  const plannedCount = sessions.filter((s) => s.status === 'PLANNED').length;
  const finishedCount = sessions.filter((s) => s.status === 'FINISHED').length;

  const title = `📅 Сесії кампанії (${sessions.length})`;

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  const campaignOwnerId = campaign.ownerId;

  // === Режим створення сесії ===
  if (isCreating) {
    return (
      <DashboardCard
        title="Створити сесію"
        actions={
          <BackButton label="Назад" onClick={() => setIsCreating(false)} variant="dark" />
        }
      >
        <CreateSessionForm
          campaignId={campaign.id}
          onSuccess={() => {
            setIsCreating(false);
            onSessionCreated?.();
          }}
          onCancel={() => setIsCreating(false)}
        />
      </DashboardCard>
    );
  }

  // === Режим списку сесій ===
  return (
    <DashboardCard title={title}>
      <div className="flex flex-col gap-4">
        {/* Статистика */}
        {sessions.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-[#4D774E] p-3 bg-[#9DC88D]/10 rounded-xl">
            <span>Заплановано: {plannedCount}</span>
            <span>Завершено: {finishedCount}</span>
            <span>Всього: {sessions.length}</span>
          </div>
        )}

        {/* Список сесій */}
        {sortedSessions.length === 0 ? (
          <EmptyState
            icon="📅"
            title="Ще немає сесій"
            description={canCreateSessions ? 'Створіть першу сесію для цієї кампанії' : 'Майстер ще не створив жодної сесії'}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {sortedSessions.map((session, idx) => {
              const sessionOwnerId = session.ownerId;
              const showOwnerOverrideActions = Boolean(
                canOwnerOverride
                && sessionOwnerId
                && campaignOwnerId
                && sessionOwnerId !== campaignOwnerId
              );

              return (
              <SessionListItem
                key={session.id}
                session={session}
                index={idx}
                showOwnerOverrideActions={showOwnerOverrideActions}
                onCancelOwnerAction={() =>
                  setConfirmModal({
                    isOpen: true,
                    title: 'Скасувати сесію?',
                    message: 'Сесія змінить статус на CANCELED. Продовжити?',
                    variant: 'danger',
                    onConfirm: async () => {
                      closeConfirmModal();
                      await onCancelForeignSession?.(session.id);
                      await onSessionCreated?.();
                    },
                  })
                }
                onDeleteOwnerAction={() =>
                  setConfirmModal({
                    isOpen: true,
                    title: 'Видалити сесію?',
                    message: 'Сесію буде видалено без можливості відновлення. Продовжити?',
                    variant: 'danger',
                    onConfirm: async () => {
                      closeConfirmModal();
                      await onDeleteForeignSession?.(session.id);
                      await onSessionCreated?.();
                    },
                  })
                }
              />
              );
            })}
          </div>
        )}

        {/* Кнопка створення сесії (Майстер/Власник) */}
        {canCreateSessions && (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full py-3 border-2 border-dashed border-[#9DC88D]/50 rounded-xl text-[#4D774E] hover:border-[#164A41] hover:text-[#164A41] hover:bg-[#9DC88D]/5 transition-all font-medium"
          >
            + Створити сесію
          </button>
        )}
      </div>

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
