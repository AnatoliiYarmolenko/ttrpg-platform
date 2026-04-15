import React from "react";
import DashboardCard from "@/components/ui/DashboardCard";
import { ConfirmModal, EmptyState, StatusBadge } from "@/components/shared";
import useConfirmDialog from '@/hooks/useConfirmDialog';
import SessionListItem from "../ui/SessionListItem";

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

function CampaignSessionSection({
  section,
  sessions,
  canOwnerOverride,
  openCancelModal,
  openDeleteModal,
}) {
  const groupedSessions = sessions
    .filter((session) => session.status === section.key)
    .sort(sortByClosestDate);

  return (
    <section key={section.key} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-brand-dark uppercase tracking-wide">
          {section.title}
        </h4>
        <span className="text-xs text-brand-medium bg-brand-light/10 px-2 py-1 rounded-full">
          {groupedSessions.length}
        </span>
      </div>

      {groupedSessions.length === 0 ? (
        <div className="text-xs text-brand-medium/80 px-3 py-2 border border-dashed border-brand-light/40 rounded-lg bg-brand-light/5">
          {section.emptyText}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groupedSessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              showOwnerOverrideActions={Boolean(canOwnerOverride)}
              onCancelOwnerAction={() => openCancelModal(session.id)}
              onDeleteOwnerAction={() => openDeleteModal(session.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function CampaignSessionsWidget({
  campaign,
  canOwnerOverride = false,
  onCancelForeignSession,
  onDeleteForeignSession,
  onSessionCreated,
}) {
  const { openConfirm, confirmModalProps } = useConfirmDialog();

  if (!campaign) return null;

  const sessions = campaign.sessions || [];
  const activeCount = sessions.filter((session) => session.status === "ACTIVE").length;
  const plannedCount = sessions.filter((session) => session.status === "PLANNED").length;
  const finishedCount = sessions.filter((session) => session.status === "FINISHED").length;
  const canceledCount = sessions.filter((session) => session.status === "CANCELED").length;
  const title = `Сесії кампанії (${sessions.length})`;

  const openCancelModal = (sessionId) => {
    openConfirm({
      title: 'Скасувати сесію?',
      message: 'Сесія змінить статус на CANCELED. Продовжити?',
      variant: 'danger',
      confirmText: 'Скасувати',
      onConfirm: async () => {
        await onCancelForeignSession?.(sessionId);
        await onSessionCreated?.();
      },
    });
  };

  const openDeleteModal = (sessionId) => {
    openConfirm({
      title: 'Видалити сесію?',
      message: 'Сесію буде видалено без можливості відновлення. Продовжити?',
      variant: 'danger',
      confirmText: 'Видалити',
      onConfirm: async () => {
        await onDeleteForeignSession?.(sessionId);
        await onSessionCreated?.();
      },
    });
  };

  return (
    <DashboardCard title={title}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-brand-light/8 border border-brand-light/25">
          <span className="text-sm font-semibold text-brand-dark">Статус кампанії</span>
          <StatusBadge status={campaign.status || 'ACTIVE'} size="sm" />
        </div>

        {sessions.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-brand-medium p-3 bg-brand-light/10 rounded-xl flex-wrap">
            <span>Активні: {activeCount}</span>
            <span>Заплановано: {plannedCount}</span>
            <span>Завершено: {finishedCount}</span>
            <span>Скасовано: {canceledCount}</span>
            <span>Всього: {sessions.length}</span>
          </div>
        )}

        {sessions.length === 0 ? (
          <EmptyState
            title="Ще немає сесій"
            description="В кампанії ще не створено жодної сесії"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {STATUS_SECTIONS.map((section) => (
              <CampaignSessionSection
                key={section.key}
                section={section}
                sessions={sessions}
                canOwnerOverride={canOwnerOverride}
                openCancelModal={openCancelModal}
                openDeleteModal={openDeleteModal}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        {...confirmModalProps}
      />
    </DashboardCard>
  );
}
