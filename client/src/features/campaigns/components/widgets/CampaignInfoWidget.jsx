import React from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import {
  VisibilityBadge,
  StatusBadge,
  RoleBadge,
  DateTimeDisplay,
  ConfirmModal,
} from '@/components/shared';
import useConfirmDialog from '@/hooks/useConfirmDialog';
import Data from '@/components/ui/icons/Data';
import GroupPeople from '@/components/ui/icons/GroupPeople';

/**
 * CampaignInfoWidget — ліва панель таба "Деталі".
 *
 * Чистий read-only віджет: назва, статус, система, статистика, опис.
 * Для учасника тут є кнопка виходу з кампанії.
 */
export default function CampaignInfoWidget({
  campaign,
  myRole,
  onLeave,
  isCampaignFinished = false,
}) {
  const { openConfirm, confirmModalProps } = useConfirmDialog();

  if (!campaign) return null;

  const canLeaveCampaign = Boolean(myRole && myRole !== 'OWNER' && !isCampaignFinished && onLeave);

  const handleLeave = () => {
    openConfirm({
      title: 'Покинути кампанію?',
      message: 'Ви впевнені, що хочете покинути цю кампанію? Ви втратите доступ до всіх сесій цієї кампанії.',
      variant: 'danger',
      confirmText: 'Вийти',
      onConfirm: onLeave,
    });
  };

  return (
    <>
      <DashboardCard title="Деталі кампанії">
        <div className="flex h-full flex-col gap-5">
          {/* Заголовок */}
          <div>
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-xl font-bold text-brand-dark flex-1 pr-3">
                {campaign.title}
              </h2>
              <div className="flex flex-col items-end gap-2">
                <VisibilityBadge visibility={campaign.visibility} entityType="campaign" />
                <StatusBadge status={campaign.status || 'ACTIVE'} size="sm" />
              </div>
            </div>
            {myRole && <RoleBadge role={myRole} size="md" />}
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-brand-light/10 rounded-xl">
            <div className="flex items-center gap-2 text-brand-medium text-sm">
              <GroupPeople className="w-4 h-4" />
              <span>{campaign.membersCount ?? campaign.members?.length ?? 0} учасників</span>
            </div>
            {campaign.system && (
              <div className="flex items-center gap-2 text-brand-medium text-sm">
                <span className="font-medium">Система:</span>
                <span>{campaign.system}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-brand-medium text-sm">
              <Data className="w-4 h-4" />
              <span>{campaign.sessionsCount ?? campaign.sessions?.length ?? 0} сесій</span>
            </div>
            {campaign.owner && (
              <div className="flex items-center gap-2 text-brand-medium text-sm">
                <span className="font-medium">Власник:</span>
                <span className="truncate">
                  {campaign.owner.displayName || campaign.owner.username || 'Власник'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-brand-medium text-sm">
              <Data className="w-4 h-4" />
              <span>Створено:</span>
              <DateTimeDisplay value={campaign.createdAt} format="long" />
            </div>
          </div>

          {/* Опис */}
          {campaign.description ? (
            <div className="border-t border-brand-light/20 pt-4">
              <h4 className="text-sm font-bold text-brand-dark mb-2">Опис кампанії</h4>
              <p className="text-sm text-brand-medium whitespace-pre-wrap leading-relaxed">
                {campaign.description}
              </p>
            </div>
          ) : (
            <div className="border-t border-brand-light/20 pt-4">
              <p className="text-sm text-brand-medium/60 italic">Опис відсутній</p>
            </div>
          )}

          {canLeaveCampaign && (
            <div className="mt-auto border-t border-brand-light/20 pt-4">
              <Button
                onClick={handleLeave}
                variant="danger"
                fullWidth={true}
                className="w-full min-h-[44px]"
              >
                Покинути кампанію
              </Button>
            </div>
          )}
        </div>
      </DashboardCard>

      <ConfirmModal {...confirmModalProps} />
    </>
  );
}
