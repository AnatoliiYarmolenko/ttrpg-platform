import React, { useEffect } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import { EmptyState, ConfirmModal, ParticipantsList } from '@/components/shared';
import ParticipantCard from '../ui/ParticipantCard';
import useSessionStore from '../../store/useSessionStore';
import { useState, useCallback } from 'react';
import GroupPeople from '@/components/ui/icons/GroupPeople';

/**
 * SessionParticipantsWidget — правий віджет на сторінці сесії.
 *
 * Відображає список учасників.
 * Для GM/Owner — можливість видаляти учасників.
 * Клік на учасника → callback onViewProfile.
 *
 * @param {number} sessionId — ID сесії
 * @param {boolean} canManage — чи може юзер видаляти учасників
 * @param {number} currentUserId — ID поточного юзера
 * @param {Function} onViewProfile — колбек для перегляду профілю (userId)
 * @param {number} maxPlayers — макс кількість гравців
 */
export default function SessionPageParticipantsWidget({
  sessionId,
  session,
  canManage = false,
  canManageGmRequests = false,
  confirmedGm = null,
  onParticipantStatusChange,
  onKickGm,
  currentUserId,
  onViewProfile,
  maxPlayers,
}) {
  const {
    participants,
    fetchParticipants,
    removeParticipantAction,
    fetchSessionById,
  } = useSessionStore();

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

  const openConfirmModal = useCallback((title, message, onConfirm, variant = 'primary') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      variant,
    });
  }, []);

  // Завантажити учасників
  useEffect(() => {
    if (sessionId) {
      fetchParticipants(sessionId);
    }
  }, [sessionId, fetchParticipants]);

  const handleRemove = (participantId) => {
    openConfirmModal(
      'Видалити учасника?',
      'Видалити цього учасника з сесії?',
      async () => {
        closeConfirmModal();
        await removeParticipantAction(sessionId, participantId);
        await fetchParticipants(sessionId);
        await fetchSessionById(sessionId);
      },
      'danger'
    );
  };

  const handleApproveGm = (participantId) => {
    openConfirmModal(
      'Схвалити GM?',
      'Підтвердити цього користувача як GM для поточної сесії?',
      async () => {
        closeConfirmModal();
        await onParticipantStatusChange?.(participantId, 'CONFIRMED');
        await fetchParticipants(sessionId);
        await fetchSessionById(sessionId);
      },
      'primary'
    );
  };

  const handleRejectGm = (participantId) => {
    openConfirmModal(
      'Відхилити заявку GM?',
      'Заявку буде відхилено.',
      async () => {
        closeConfirmModal();
        await onParticipantStatusChange?.(participantId, 'DECLINED');
        await fetchParticipants(sessionId);
        await fetchSessionById(sessionId);
      },
      'danger'
    );
  };

  const handleKickConfirmedGm = () => {
    openConfirmModal(
      'Зняти GM?',
      'Підтвердженого GM буде знято із сесії.',
      async () => {
        closeConfirmModal();
        await onKickGm?.();
        await fetchParticipants(sessionId);
        await fetchSessionById(sessionId);
      },
      'danger'
    );
  };

  const title = maxPlayers
    ? `Учасники (${participants.filter((participant) => participant.role === 'PLAYER').length}/${maxPlayers})`
    : `Учасники (${participants.length})`;

  const canShowKickGmButton =
    canManageGmRequests
    && session?.status === 'PLANNED'
    && Boolean(confirmedGm)
    && confirmedGm?.userId !== session?.ownerId;

  return (
    <DashboardCard title={title}>
      {canShowKickGmButton && (
        <button
          type="button"
          onClick={handleKickConfirmedGm}
          className="mb-4 w-full px-3 py-2 text-sm font-semibold rounded-lg border-2 border-red-300 text-red-600 hover:bg-red-50 transition-colors"
        >
          Зняти GM
        </button>
      )}

      {participants.length === 0 ? (
        <EmptyState
          icon={<GroupPeople className="w-10 h-10" />}
          title="Ще немає учасників"
          description="Будьте першим!"
          className="h-full"
        />
      ) : (
        <ParticipantsList
          items={participants}
          getItemKey={(participant) => participant.id}
          renderItem={(participant) => (
            <ParticipantCard
              participant={participant}
              canManage={canManage}
              isOwner={participant.userId === session?.ownerId}
              currentUserId={currentUserId}
              onRemove={handleRemove}
              onViewProfile={onViewProfile}
              gmModeration={{
                enabled:
                  canManageGmRequests
                  && participant.role === 'GM'
                  && participant.status === 'PENDING',
                onApprove: handleApproveGm,
                onReject: handleRejectGm,
              }}
            />
          )}
        />
      )}

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
