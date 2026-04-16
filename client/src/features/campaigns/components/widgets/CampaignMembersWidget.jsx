import React, { useMemo } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import { EmptyState, ConfirmModal, ParticipantsList } from '@/components/shared';
import useConfirmDialog from '@/hooks/useConfirmDialog';
import MemberCard from '../ui/MemberCard';
import ParticipantCard from '@/features/sessions/components/ui/ParticipantCard';
import { useCampaignMutations } from '../../hooks/useCampaignQueries';
import GroupPeople from '@/components/ui/icons/GroupPeople';

/**
 * Правий віджет сторінки кампанії з учасниками та заявками на вступ.
 */
export default function CampaignMembersWidget({
  campaignId,
  membersSection = null,
  joinRequestsSection = null,
  canReadMembers = true,
  isOwner = false,
  isGM = false,
  canAssignRoles = false,
  canModerateRequests = false,
  canRemovePlayers = false,
  currentUserId,
  onViewProfile,
}) {
  const mutations = useCampaignMutations(campaignId);
  const campaignMembers = Array.isArray(membersSection?.items) ? membersSection.items : [];
  const joinRequests = Array.isArray(joinRequestsSection?.items) ? joinRequestsSection.items : [];
  const { openConfirm, confirmModalProps } = useConfirmDialog();

  const handleRemove = (memberId) => {
    openConfirm({
      title: 'Видалити учасника?',
      message: 'Видалити цього учасника з кампанії?',
      variant: 'danger',
      confirmText: 'Видалити',
      onConfirm: async () => mutations.removeMember(memberId),
    });
  };

  const handleChangeRole = async (memberId, newRole) => {
    await mutations.changeMemberRole({ memberId, role: newRole });
  };

  const handleApproveRequest = async (requestId) => {
    await mutations.approveRequest({ requestId, role: 'PLAYER' });
  };

  const handleRejectRequest = async (requestId) => {
    await mutations.rejectRequest(requestId);
  };

  const visiblePendingRequests = useMemo(() => {
    if (!canModerateRequests || joinRequestsSection?.visible === false) return [];
    return joinRequests.filter((request) => request.status === 'PENDING');
  }, [canModerateRequests, joinRequests, joinRequestsSection?.visible]);

  const combinedItems = useMemo(() => {
    const requestItems = visiblePendingRequests.map((request) => ({
      type: 'request',
      id: `request-${request.id}`,
      request,
    }));

    const memberItems = campaignMembers.map((member) => ({
      type: 'member',
      id: `member-${member.id}`,
      member,
    }));

    return [...requestItems, ...memberItems];
  }, [visiblePendingRequests, campaignMembers]);

  const canRemoveMember = (member) => {
    if (!canRemovePlayers || !member) return false;
    if (member.userId === currentUserId) return false;
    if (member.role === 'OWNER') return false;

    if (isOwner) {
      return member.role === 'PLAYER' || member.role === 'GM';
    }

    if (isGM) {
      return member.role === 'PLAYER';
    }

    return false;
  };

  const canChangeMemberRole = (member) => {
    if (!canAssignRoles || !member) return false;
    if (member.userId === currentUserId) return false;
    if (member.role === 'OWNER') return false;
    return true;
  };

  const shouldShowHiddenState = !canReadMembers && visiblePendingRequests.length === 0;
  const shouldShowEmptyState = !shouldShowHiddenState && combinedItems.length === 0;

  let cardContent = null;
  if (shouldShowHiddenState) {
    cardContent = (
      <EmptyState
        icon={<GroupPeople className="w-10 h-10" />}
        title="Список учасників прихований"
        description="Для цього режиму перегляду список учасників недоступний."
      />
    );
  } else if (shouldShowEmptyState) {
    cardContent = (
      <EmptyState
        icon={<GroupPeople className="w-10 h-10" />}
        title="Ще немає учасників"
        description="Запросіть гравців через share-посилання кампанії"
      />
    );
  } else {
    cardContent = (
      <ParticipantsList
        items={combinedItems}
        getItemKey={(item) => item.id}
        renderItem={(item) => {
          if (item.type === 'request') {
            const request = item.request;
            return (
              <ParticipantCard
                participant={{
                  id: request.id,
                  userId: request.user?.id,
                  user: request.user,
                  role: 'PLAYER',
                  status: 'PENDING',
                }}
                canManage={false}
                currentUserId={currentUserId}
                onViewProfile={onViewProfile}
                playerModeration={{
                  enabled: true,
                  onApprove: handleApproveRequest,
                  onReject: handleRejectRequest,
                }}
              />
            );
          }

          const member = item.member;
          return (
            <MemberCard
              member={member}
              currentUserId={currentUserId}
              canRemove={canRemoveMember(member)}
              canChangeRole={canChangeMemberRole(member)}
              onRemove={canRemoveMember(member) ? handleRemove : undefined}
              onChangeRole={canChangeMemberRole(member) ? handleChangeRole : undefined}
              onViewProfile={onViewProfile}
            />
          );
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      <DashboardCard
        title={
          visiblePendingRequests.length > 0
            ? `Учасники (${campaignMembers.length}) • Заявки (${visiblePendingRequests.length})`
            : `Учасники (${campaignMembers.length})`
        }
      >
        {cardContent}
      </DashboardCard>

      <ConfirmModal
        {...confirmModalProps}
      />
    </div>
  );
}
