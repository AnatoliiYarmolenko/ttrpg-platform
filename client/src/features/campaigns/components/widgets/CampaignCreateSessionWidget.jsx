import React from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import { EmptyState } from '@/components/shared';
import CreateSessionForm from '@/features/dashboard/components/widgets/CreateSessionForm';

/**
 * CampaignCreateSessionWidget — права панель у вкладці "Сесії" кампанії.
 *
 * Показує форму створення постійно (без проміжного CTA-екрана).
 * Для кампанії форма завжди створює сесію з роллю GM.
 */
export default function CampaignCreateSessionWidget({
  campaignId,
  canCreateSessions = false,
  isCampaignFinished = false,
  onSessionCreated,
}) {
  const handleCreateSuccess = async () => {
    await onSessionCreated?.();
  };

  return (
    <DashboardCard title="Створити сесію">
      {!canCreateSessions ? (
        <EmptyState
          title={isCampaignFinished ? 'Кампанія завершена' : 'Недостатньо прав'}
          description={isCampaignFinished
            ? 'У завершеній кампанії не можна створювати нові сесії'
            : 'Створювати сесії в кампанії можуть тільки Власник або Майстер'}
          className="h-full"
        />
      ) : (
        <CreateSessionForm
          campaignId={campaignId}
          requireGmRole
          onSuccess={handleCreateSuccess}
        />
      )}
    </DashboardCard>
  );
}
