import React, { useEffect, useState, useCallback } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import { EmptyState, ConfirmModal, UserAvatar, DateTimeDisplay } from '@/components/shared';
import MemberCard from '../ui/MemberCard';
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

  const pendingRequests = joinRequests.filter((r) => r.status === 'PENDING');

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
      {/* Учасники */}
      <DashboardCard title={`Учасники (${campaignMembers.length})`}>
        {campaignMembers.length === 0 ? (
          <EmptyState
            icon={<GroupPeople className="w-10 h-10" />}
            title="Ще немає учасників"
            description="Запросіть гравців за кодом запрошення"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {campaignMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                currentUserId={currentUserId}
                canRemove={canRemoveMember(member)}
                canChangeRole={canChangeMemberRole(member)}
                onRemove={canRemoveMember(member) ? handleRemove : undefined}
                onChangeRole={canChangeMemberRole(member) ? handleChangeRole : undefined}
                onViewProfile={onViewProfile}
              />
            ))}
          </div>
        )}
      </DashboardCard>

      {/* Заявки на вступ (Власник/Майстер) */}
      {canModerateRequests && pendingRequests.length > 0 && (
        <DashboardCard title={`Заявки (${pendingRequests.length})`}>
          <div className="flex flex-col gap-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="p-3 border-2 border-[#F1B24A]/30 rounded-xl bg-[#F1B24A]/5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <UserAvatar
                    src={request.user?.avatarUrl}
                    name={request.user?.displayName || request.user?.username}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onViewProfile?.(request.user?.id)}
                      className="font-medium text-[#164A41] hover:underline text-sm truncate text-left block"
                    >
                      {request.user?.displayName || request.user?.username || 'Невідомий'}
                    </button>
                    <div className="text-xs text-[#4D774E]">
                      <DateTimeDisplay value={request.createdAt} format="long" />
                    </div>
                  </div>
                </div>

                {request.message && (
                  <p className="text-xs text-[#4D774E] p-2 bg-white rounded-lg mb-2">
                    "{request.message}"
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveRequest(request.id)}
                    className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs font-medium"
                  >
                    ✓ Прийняти
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs font-medium"
                  >
                    ✕ Відхилити
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

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
