import React, { useState } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import { ConfirmModal, EmptyState } from '@/components/shared';
import SessionListItem from '../ui/SessionListItem';

const STATUS_SECTIONS = [
  { key: 'ACTIVE', title: 'Активні', emptyText: 'Активних сесій немає' },
  { key: 'PLANNED', title: 'Заплановані', emptyText: 'Запланованих сесій немає' },
  { key: 'FINISHED', title: 'Завершені', emptyText: 'Завершених сесій немає' },
  { key: 'CANCELED', title: 'Скасовані', emptyText: 'Скасованих сесій немає' },
];

const parseSessionTime = (sessionDate) => {
  const time = new Date(sessionDate).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
};

const sortByClosestDate = (a, b) => {
  const now = Date.now();
  const aTime = parseSessionTime(a.date);
  const bTime = parseSessionTime(b.date);
  const aDiff = Math.abs(aTime - now);
  const bDiff = Math.abs(bTime - now);

  if (aDiff !== bDiff) return aDiff - bDiff;
  return aTime - bTime;
};

/**
 * CampaignSessionsWidget — лівий віджет у Full Mode, таб "Сесії" (default).
 *
 * Показує список сесій кампанії, згрупований за статусами.
 *
 * @param {Object} campaign — дані кампанії (з sessions)
 * @param {boolean} canOwnerOverride — чи може користувач керувати сесіями кампанії
 */
export default function CampaignSessionsWidget({
  campaign,
  canOwnerOverride = false,
  onCancelForeignSession,
  onDeleteForeignSession,
  onSessionCreated,
}) {
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'primary',
    onConfirm: null,
  });

  if (!campaign) return null;

  const sessions = campaign.sessions || [];
  const activeCount = sessions.filter((s) => s.status === 'ACTIVE').length;
  const plannedCount = sessions.filter((s) => s.status === 'PLANNED').length;
  const finishedCount = sessions.filter((s) => s.status === 'FINISHED').length;
  const canceledCount = sessions.filter((s) => s.status === 'CANCELED').length;

  const title = `Сесії кампанії (${sessions.length})`;

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <DashboardCard title={title}>
      <div className="flex flex-col gap-4">
        {/* Статистика */}
        {sessions.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-[#4D774E] p-3 bg-[#9DC88D]/10 rounded-xl flex-wrap">
            <span>Активні: {activeCount}</span>
            <span>Заплановано: {plannedCount}</span>
            <span>Завершено: {finishedCount}</span>
            <span>Скасовано: {canceledCount}</span>
            <span>Всього: {sessions.length}</span>
          </div>
        )}

        {/* Список сесій */}
        {sessions.length === 0 ? (
          <EmptyState
            icon="📅"
            title="Ще немає сесій"
            description="В кампанії ще не створено жодної сесії"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {STATUS_SECTIONS.map((section) => {
              const groupedSessions = sessions
                .filter((session) => session.status === section.key)
                .sort(sortByClosestDate);

              return (
                <section key={section.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#164A41] uppercase tracking-wide">
                      {section.title}
                    </h4>
                    <span className="text-xs text-[#4D774E] bg-[#9DC88D]/10 px-2 py-1 rounded-full">
                      {groupedSessions.length}
                    </span>
                  </div>

                  {groupedSessions.length === 0 ? (
                    <div className="text-xs text-[#4D774E]/80 px-3 py-2 border border-dashed border-[#9DC88D]/40 rounded-lg bg-[#9DC88D]/5">
                      {section.emptyText}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {groupedSessions.map((session) => {
                        const showOwnerOverrideActions = Boolean(canOwnerOverride);

                        return (
                          <SessionListItem
                            key={session.id}
                            session={session}
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
                </section>
              );
            })}
          </div>
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
