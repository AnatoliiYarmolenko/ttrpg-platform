import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import { EmptyState, ConfirmModal, ParticipantsList } from '@/components/shared';
import MemberCard from '../ui/MemberCard';
import ParticipantCard from '@/features/sessions/components/ui/ParticipantCard';
import useCampaignStore from '../../store/useCampaignStore';
import GroupPeople from '@/components/ui/icons/GroupPeople';

/**
 * CampaignMembersWidget — правий віджет на сторінці кампанії.
 *
 * Відображає:
 * - Список членів кампанії (з ролями)
 * - Для Owner — управління ролями та видалення
 * - Для Власника/Майстра — список заявок на вступ
 * - Клік на учасника → callback onViewProfile
 *
 * @param {number} campaignId — ID кампанії
 * @param {boolean} isOwner — чи є юзер Owner
 * @param {boolean} isGM — чи є юзер GM
 * @param {boolean} canAssignRoles — чи може юзер призначати ролі (тільки Owner)
 * @param {boolean} canModerateRequests — чи може юзер модерувати заявки (Owner/GM)
 * @param {boolean} canRemovePlayers — чи може юзер видаляти гравців (Owner/GM)
 * @param {number} currentUserId — ID поточного юзера
 * @param {Function} onViewProfile — колбек для перегляду профілю (userId)
 */
export default function CampaignMembersWidget({
  campaignId,
  isOwner = false,
  isGM = false,
  canAssignRoles = false,
  canModerateRequests = false,
  canRemovePlayers = false,
  currentUserId,
  onViewProfile,
}) {
  const {
    campaignMembers,
    joinRequests,
    fetchCampaignMembers,
    fetchJoinRequests,
    removeMember,
    changeMemberRole,
    approveRequest,
    rejectRequest,
    fetchCampaignById,
  } = useCampaignStore();

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

  // Завантажити членів
  useEffect(() => {
    if (campaignId) {
      fetchCampaignMembers(campaignId);
      if (canModerateRequests) {
        fetchJoinRequests(campaignId);
      }
    }
  }, [campaignId, canModerateRequests, fetchCampaignMembers, fetchJoinRequests]);

  const handleRemove = (memberId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Видалити учасника?',
      message: 'Видалити цього учасника з кампанії?',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirmModal();
        await removeMember(campaignId, memberId);
        await fetchCampaignMembers(campaignId);
        await fetchCampaignById(campaignId);
      },
    });
  };

  const handleChangeRole = async (memberId, newRole) => {
    await changeMemberRole(campaignId, memberId, newRole);
    await fetchCampaignMembers(campaignId);
  };

  const handleApproveRequest = async (requestId) => {
    await approveRequest(requestId, 'PLAYER');
    await fetchCampaignMembers(campaignId);
    await fetchJoinRequests(campaignId);
    await fetchCampaignById(campaignId);
  };

  const handleRejectRequest = async (requestId) => {
    await rejectRequest(requestId);
    await fetchJoinRequests(campaignId);
  };

  const visiblePendingRequests = useMemo(() => {
    if (!canModerateRequests) return [];
    return joinRequests.filter((r) => r.status === 'PENDING');
  }, [canModerateRequests, joinRequests]);

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

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      <DashboardCard
        title={
          visiblePendingRequests.length > 0
            ? `Учасники (${campaignMembers.length}) • Заявки (${visiblePendingRequests.length})`
            : `Учасники (${campaignMembers.length})`
        }
      >
        {combinedItems.length === 0 ? (
          <EmptyState
            icon={<GroupPeople className="w-10 h-10" />}
            title="Ще немає учасників"
            description="Запросіть гравців за кодом запрошення"
          />
        ) : (
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
        )}
      </DashboardCard>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </div>
  );
}
