import { useMemo } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import { EmptyState, ConfirmModal, ParticipantsList } from '@/components/shared';
import ParticipantCard from '../ui/ParticipantCard';
import { useSessionParticipantsQuery, useSessionMutations } from '../../hooks/useSessionQueries';
import useConfirmDialog from '@/hooks/useConfirmDialog';
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
  initialParticipants = [],
  canReadParticipants = true,
  canManage = false,
  canManageGmRequests = false,
  currentUserId,
  onViewProfile,
  maxPlayers,
}) {
  const { data: queriedParticipants = [] } = useSessionParticipantsQuery(sessionId, canReadParticipants);
  const mutations = useSessionMutations(sessionId);
  const participants = queriedParticipants.length > 0 ? queriedParticipants : initialParticipants;
  const { openConfirm, confirmModalProps } = useConfirmDialog();

  // Дані завантажуються автоматично через useQuery

  const handleRemove = (participantId) => {
    openConfirm({
      title: 'Видалити учасника?',
      message: 'Видалити цього учасника з сесії?',
      variant: 'danger',
      confirmText: 'Видалити',
      onConfirm: async () => mutations.removeParticipant(participantId),
    });
  };

  const handleApproveGm = (participantId) => {
    openConfirm({
      title: 'Схвалити GM?',
      message: 'Підтвердити цього користувача як GM для поточної сесії?',
      variant: 'primary',
      confirmText: 'Схвалити',
      onConfirm: async () => mutations.updateParticipantStatus({ participantId, status: 'CONFIRMED' }),
    });
  };

  const handleRejectGm = (participantId) => {
    openConfirm({
      title: 'Відхилити заявку GM?',
      message: 'Заявку буде відхилено.',
      variant: 'danger',
      confirmText: 'Відхилити',
      onConfirm: async () => mutations.updateParticipantStatus({ participantId, status: 'DECLINED' }),
    });
  };

  const handleApprovePlayer = (participantId) => {
    openConfirm({
      title: 'Схвалити гравця?',
      message: 'Підтвердити цього гравця для поточної сесії?',
      variant: 'primary',
      confirmText: 'Схвалити',
      onConfirm: async () => mutations.updateParticipantStatus({ participantId, status: 'CONFIRMED' }),
    });
  };

  const handleRejectPlayer = (participantId) => {
    openConfirm({
      title: 'Відхилити заявку гравця?',
      message: 'Заявку гравця буде відхилено.',
      variant: 'danger',
      confirmText: 'Відхилити',
      onConfirm: async () => mutations.updateParticipantStatus({ participantId, status: 'DECLINED' }),
    });
  };

  const title = maxPlayers
    ? `Учасники (${participants.filter((participant) => participant.role === 'PLAYER').length}/${maxPlayers})`
    : `Учасники (${participants.length})`;

  const sortedParticipants = useMemo(() => {
    return participants
      .map((participant, index) => ({ participant, index }))
      .sort((a, b) => {
        const aPending = a.participant.status === 'PENDING' ? 0 : 1;
        const bPending = b.participant.status === 'PENDING' ? 0 : 1;

        if (aPending !== bPending) {
          return aPending - bPending;
        }

        return a.index - b.index;
      })
      .map(({ participant }) => participant);
  }, [participants]);

  return (
    <DashboardCard title={title}>
      {sortedParticipants.length === 0 ? (
        <EmptyState
          icon={<GroupPeople className="w-10 h-10" />}
          title="Ще немає учасників"
          description="Будьте першим!"
          className="h-full"
        />
      ) : (
        <ParticipantsList
          items={sortedParticipants}
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
              playerModeration={{
                enabled:
                  canManage
                  && participant.role === 'PLAYER'
                  && participant.status === 'PENDING',
                onApprove: handleApprovePlayer,
                onReject: handleRejectPlayer,
              }}
            />
          )}
        />
      )}

      <ConfirmModal
        {...confirmModalProps}
      />
    </DashboardCard>
  );
}
