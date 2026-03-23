import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import {
  getCampaignById,
  getCampaignMembers,
  getJoinRequests,
  updateCampaign,
  transferCampaignOwnership,
  removeMemberFromCampaign,
  updateMemberRole,
  regenerateInviteCode,
  submitJoinRequest,
  approveJoinRequest,
  rejectJoinRequest,
  cancelCampaignSession,
  deleteCampaignSession,
} from '../api/campaignApi';

// QUERIES
export const useCampaignQuery = (campaignId) => {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      const res = await getCampaignById(campaignId);
      if (!res.success) throw new Error(res.error || 'Failed to fetch campaign');
      return res.data;
    },
    enabled: !!campaignId,
  });
};

export const useCampaignMembersQuery = (campaignId) => {
  return useQuery({
    queryKey: ['campaign', campaignId, 'members'],
    queryFn: async () => {
      const res = await getCampaignMembers(campaignId);
      if (!res.success) throw new Error(res.error || 'Failed to fetch members');
      return res.data || [];
    },
    enabled: !!campaignId,
    staleTime: 30 * 1000,
  });
};

export const useCampaignJoinRequestsQuery = (campaignId, canModerate) => {
  return useQuery({
    queryKey: ['campaign', campaignId, 'requests'],
    queryFn: async () => {
      const res = await getJoinRequests(campaignId);
      if (!res.success) throw new Error(res.error || 'Failed to fetch requests');
      return res.data || [];
    },
    enabled: !!campaignId && !!canModerate,
    staleTime: 30 * 1000,
  });
};

// MUTATIONS
export const useCampaignMutations = (campaignId) => {
  const queryClient = useQueryClient();

  const invalidateCampaign = () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'members'] });
  const invalidateRequests = () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'requests'] });

  const handleMutation = (successMessage, invalidateFns = []) => ({
    onSuccess: (res) => {
      if (res?.success === false) {
        toast.error(res.error || res.message || 'Сталася помилка');
      } else {
        if (successMessage) toast.success(successMessage);
        invalidateFns.forEach((fn) => fn());
      }
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || err?.message || 'Сталася помилка');
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: (data) => updateCampaign(campaignId, data),
    ...handleMutation('Кампанію успішно оновлено', [invalidateCampaign]),
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: (newOwnerId) => transferCampaignOwnership(campaignId, newOwnerId),
    ...handleMutation('Власника кампанії змінено', [invalidateCampaign, invalidateMembers]),
  });

  const regenerateCodeMutation = useMutation({
    mutationFn: () => regenerateInviteCode(campaignId),
    ...handleMutation('Код запрошення оновлено', [invalidateCampaign]),
  });

  const submitJoinRequestMutation = useMutation({
    mutationFn: (message) => submitJoinRequest(campaignId, message),
    ...handleMutation('Заявку надіслано', [invalidateRequests]),
  });

  const approveRequestMutation = useMutation({
    mutationFn: ({ requestId, role }) => approveJoinRequest(requestId, role),
    ...handleMutation('Заявку схвалено', [invalidateMembers, invalidateRequests, invalidateCampaign]),
  });

  const rejectRequestMutation = useMutation({
    mutationFn: (requestId) => rejectJoinRequest(requestId),
    ...handleMutation('Заявку відхилено', [invalidateRequests]),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId) => removeMemberFromCampaign(campaignId, memberId),
    ...handleMutation('Учасника видалено', [invalidateMembers, invalidateCampaign]),
  });

  const changeMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, role }) => updateMemberRole(campaignId, memberId, role),
    ...handleMutation('Роль учасника змінено', [invalidateMembers]),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: (sessionId) => cancelCampaignSession(sessionId),
    ...handleMutation('Сесію скасовано', [invalidateCampaign]),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId) => deleteCampaignSession(sessionId),
    ...handleMutation('Сесію видалено', [invalidateCampaign]),
  });

  return {
    updateCampaign: updateCampaignMutation.mutateAsync,
    transferOwnership: transferOwnershipMutation.mutateAsync,
    regenerateCode: regenerateCodeMutation.mutateAsync,
    submitJoinRequest: submitJoinRequestMutation.mutateAsync,
    approveRequest: approveRequestMutation.mutateAsync,
    rejectRequest: rejectRequestMutation.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    changeMemberRole: changeMemberRoleMutation.mutateAsync,
    cancelSession: cancelSessionMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
  };
};
