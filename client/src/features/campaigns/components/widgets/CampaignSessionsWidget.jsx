import React, { useState } from "react";
import DashboardCard from "@/components/ui/DashboardCard";
import Button from "@/components/ui/Button";
import { ConfirmModal, EmptyState, BackButton } from "@/components/shared";
import useConfirmDialog from '@/hooks/useConfirmDialog';
import SessionListItem from "../ui/SessionListItem";
import CreateSessionForm from '@/features/dashboard/components/widgets/CreateSessionForm';
import Dice20 from '@/components/ui/icons/Dice20';

const STATUS_SECTIONS = [
  { key: 'ACTIVE', title: 'Активні' },
  { key: 'PLANNED', title: 'Заплановані' },
  { key: 'FINISHED', title: 'Завершені' },
  { key: 'CANCELED', title: 'Скасовані' },
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
  openCancelModal,
  openDeleteModal,
}) {
  const groupedSessions = sessions
    .filter((session) => session.status === section.key)
    .sort(sortByClosestDate);

  if (groupedSessions.length === 0) {
    return null;
  }

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

      <div className="flex flex-col gap-2">
        {groupedSessions.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            onCancelAction={() => openCancelModal(session)}
            onDeleteAction={() => openDeleteModal(session)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * CampaignSessionsWidget — права панель таба "Сесії".
 *
 * Показує всі сесії кампанії, згруповані за статусом.
 * Якщо є права — показує кнопку "Створити сесію" знизу (sticky footer).
 * При настиканні — замінює контент на форму створення сесії.
 */
export default function CampaignSessionsWidget({
  campaignId,
  sessionsSection = null,
  canCreateSessions = false,
  isCampaignFinished = false,
  onCancelSession,
  onDeleteSession,
  onSessionCreated,
}) {
  const { openConfirm, confirmModalProps } = useConfirmDialog();
  const [isCreating, setIsCreating] = useState(false);

  const sessions = Array.isArray(sessionsSection?.items) ? sessionsSection.items : [];
  const title = isCreating ? 'Створити сесію' : `Сесії кампанії (${sessions.length})`;

  const openCancelModal = (session) => {
    if (!session?.actions?.canCancel) {
      return;
    }

    openConfirm({
      title: 'Скасувати сесію?',
      message: 'Сесія змінить статус на CANCELED. Продовжити?',
      variant: 'danger',
      confirmText: 'Скасувати',
      onConfirm: async () => {
        await onCancelSession?.(session.id);
      },
    });
  };

  const openDeleteModal = (session) => {
    if (!session?.actions?.canDelete) {
      return;
    }

    openConfirm({
      title: 'Видалити сесію?',
      message: 'Сесію буде видалено без можливості відновлення. Продовжити?',
      variant: 'danger',
      confirmText: 'Видалити',
      onConfirm: async () => {
        await onDeleteSession?.(session.id);
      },
    });
  };

  const handleSessionCreated = async () => {
    setIsCreating(false);
    await onSessionCreated?.();
  };

  const canShowCreateButton = canCreateSessions && !isCampaignFinished;

  if (isCreating) {
    return (
      <DashboardCard
        title={title}
        actions={
          <BackButton label="Назад" onClick={() => setIsCreating(false)} variant="dark" />
        }
      >
        <CreateSessionForm
          campaignId={campaignId}
          requireGmRole
          onSuccess={handleSessionCreated}
          onCancel={() => setIsCreating(false)}
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title={title}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">
          {sessions.length === 0 ? (
            <EmptyState
              icon={<Dice20 className="w-14 h-14" />}
              title="Немає запланованих сесій"
              description={
                canCreateSessions
                  ? 'Натисніть "Створити сесію" щоб додати першу'
                  : 'В кампанії ще не створено жодної сесії'
              }
            />
          ) : (
            <div className="flex flex-col gap-4 pb-2">
              {STATUS_SECTIONS.map((section) => (
                <CampaignSessionSection
                  key={section.key}
                  section={section}
                  sessions={sessions}
                  openCancelModal={openCancelModal}
                  openDeleteModal={openDeleteModal}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        {canShowCreateButton && (
          <div className="pt-4 border-t border-brand-light/20 mt-auto flex-shrink-0">
            <Button
              onClick={() => setIsCreating(true)}
              variant="primary"
              fullWidth={true}
              className="flex items-center justify-center gap-2"
            >
              Створити сесію
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        {...confirmModalProps}
      />
    </DashboardCard>
  );
}
