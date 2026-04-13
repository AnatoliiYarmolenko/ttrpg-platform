import React, { useState, useCallback } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import {
  VisibilityBadge,
  StatusBadge,
  RoleBadge,
  DateTimeDisplay,
  ConfirmModal,
} from '@/components/shared';
import Data from '@/components/ui/icons/Data';
import GroupPeople from '@/components/ui/icons/GroupPeople';

export default function CampaignInfoWidget({
  campaign,
  myRole,
  canManageShareLink = false,
  currentShareLink = '',
  onLeave,
  onRegenerateShareLink,
  onCopyShareLink,
  isLoading = false,
}) {
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

  const handleLeave = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Покинути кампанію?',
      message: 'Ви впевнені, що хочете покинути цю кампанію? Ви втратите доступ до всіх сесій кампанії.',
      variant: 'danger',
      onConfirm: () => {
        closeConfirmModal();
        onLeave?.();
      },
    });
  };

  const handleRegenerateShareLink = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Оновити share-посилання?',
      message: 'Старе share-посилання перестане працювати. Нове посилання буде згенеровано та скопійовано.',
      variant: 'danger',
      onConfirm: () => {
        closeConfirmModal();
        onRegenerateShareLink?.();
      },
    });
  };

  if (!campaign) return null;

  return (
    <DashboardCard title="Інформація про кампанію">
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-xl font-bold text-brand-dark flex-1 pr-3">
              {campaign.title}
            </h2>
            <div className="flex flex-col items-end gap-2">
              <VisibilityBadge visibility={campaign.visibility} />
              <StatusBadge status={campaign.status || 'ACTIVE'} size="sm" />
            </div>
          </div>
          {myRole && <RoleBadge role={myRole} size="md" />}
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 bg-brand-light/10 rounded-xl">
          {campaign.system && (
            <div className="flex items-center gap-2 text-brand-medium">
              <span>{campaign.system}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-brand-medium">
            <GroupPeople className="w-4 h-4" />
            <span>{campaign.members?.length || 0} учасників</span>
          </div>
          <div className="flex items-center gap-2 text-brand-medium">
            <Data className="w-4 h-4" />
            <span>{campaign.sessions?.length || 0} сесій</span>
          </div>
          {campaign.owner && (
            <div className="flex items-center gap-2 text-brand-medium">
              <span>{campaign.owner.displayName || campaign.owner.username || 'Власник'}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-brand-medium col-span-2">
            <Data className="w-4 h-4" />
            <span>Створено:</span>
            <DateTimeDisplay value={campaign.createdAt} format="long" />
          </div>
        </div>

        {campaign.imageUrl && (
          <div className="w-full h-48 rounded-xl overflow-hidden">
            <img
              src={campaign.imageUrl}
              alt={campaign.title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        {campaign.description && (
          <div className="border-t border-brand-light/20 pt-4">
            <h4 className="text-sm font-bold text-brand-dark mb-2">Опис кампанії</h4>
            <p className="text-sm text-brand-medium whitespace-pre-wrap">
              {campaign.description}
            </p>
          </div>
        )}

        {canManageShareLink && (
          <div className="border-t border-brand-light/20 pt-4">
            <h4 className="text-sm font-bold text-brand-dark mb-3">Share-посилання</h4>
            <div className="p-4 bg-brand-light/20 rounded-xl flex flex-col gap-3">
              {currentShareLink ? (
                <code className="px-3 py-2 bg-white rounded-lg font-mono text-brand-dark text-xs break-all">
                  {currentShareLink}
                </code>
              ) : (
                <p className="text-sm text-brand-medium">
                  Share-посилання буде доступне тут після завантаження або перевипуску.
                </p>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                {currentShareLink && (
                  <Button
                    onClick={onCopyShareLink}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    className="w-full lg:w-auto"
                  >
                    Копіювати посилання
                  </Button>
                )}
                <Button
                  onClick={handleRegenerateShareLink}
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  className="w-full lg:w-auto"
                >
                  Оновити share-посилання
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-brand-light/20 pt-4 flex flex-col gap-3">
          {myRole && myRole !== 'OWNER' && campaign.status !== 'FINISHED' && onLeave && (
            <Button
              onClick={handleLeave}
              variant="danger"
              isLoading={isLoading}
              loadingText="Вихід..."
              fullWidth={false}
              className="w-full lg:w-auto"
            >
              Покинути кампанію
            </Button>
          )}
        </div>
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
