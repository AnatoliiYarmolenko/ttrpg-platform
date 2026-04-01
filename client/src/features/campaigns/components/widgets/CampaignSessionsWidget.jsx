import React, { useState } from "react";
import DashboardCard from "@/components/ui/DashboardCard";
import { ConfirmModal, EmptyState, StatusBadge } from "@/components/shared";
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

function buildConfirmModalConfig({
  closeConfirmModal,
  onAction,
  onSessionCreated,
  sessionId,
  type,
}) {
  const variants = {
    cancel: {
      title: 'Скасувати сесію?',
      message: 'Сесія змінить статус на CANCELED. Продовжити?',
    },
    delete: {
      title: 'Видалити сесію?',
      message: 'Сесію буде видалено без можливості відновлення. Продовжити?',
    },
  };

  return {
    isOpen: true,
    title: variants[type].title,
    message: variants[type].message,
    variant: "danger",
    onConfirm: async () => {
      closeConfirmModal();
      await onAction?.(sessionId);
      await onSessionCreated?.();
    },
  };
}

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
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    variant: "primary",
    onConfirm: null,
  });

  if (!campaign) return null;

  const sessions = campaign.sessions || [];
  const activeCount = sessions.filter((session) => session.status === "ACTIVE").length;
  const plannedCount = sessions.filter((session) => session.status === "PLANNED").length;
  const finishedCount = sessions.filter((session) => session.status === "FINISHED").length;
  const canceledCount = sessions.filter((session) => session.status === "CANCELED").length;
  const title = `Сесії кампанії (${sessions.length})`;

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  const openCancelModal = (sessionId) => {
    setConfirmModal(
      buildConfirmModalConfig({
        closeConfirmModal,
        onAction: onCancelForeignSession,
        onSessionCreated,
        sessionId,
        type: 'cancel',
      })
    );
  };

  const openDeleteModal = (sessionId) => {
    setConfirmModal(
      buildConfirmModalConfig({
        closeConfirmModal,
        onAction: onDeleteForeignSession,
        onSessionCreated,
        sessionId,
        type: 'delete',
      })
    );
  };

  return (
    <DashboardCard title={title}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#9DC88D]/8 border border-[#9DC88D]/25">
          <span className="text-sm font-semibold text-[#164A41]">Статус кампанії</span>
          <StatusBadge status={campaign.status || 'ACTIVE'} size="sm" />
        </div>

        {sessions.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-[#4D774E] p-3 bg-[#9DC88D]/10 rounded-xl flex-wrap">
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
