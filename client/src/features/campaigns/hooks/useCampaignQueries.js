import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import {
  getCampaignById,
  getCampaignByShareToken,
  getCampaignMembers,
  getJoinRequests,
  updateCampaign,
  transferCampaignOwnership,
  removeMemberFromCampaign,
  updateMemberRole,
  regenerateShareLink,
  getCampaignShareLink,
  submitJoinRequest,
  approveJoinRequest,
  rejectJoinRequest,
  cancelCampaignSession,
  deleteCampaignSession,
} from '../api/campaignApi';

export const useCampaignQuery = ({ campaignId = null, shareToken = null } = {}) => {
  const isValidId = Number.isInteger(campaignId) && campaignId > 0;
  const hasShareToken = typeof shareToken === 'string' && shareToken.trim().length > 0;

  return useQuery({
    queryKey: ['campaign', campaignId || null, shareToken || null],
    queryFn: async () => {
      const res = hasShareToken
        ? await getCampaignByShareToken(shareToken)
        : await getCampaignById(campaignId);

      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch campaign');
      }

      return res.data;
    },
    enabled: isValidId || hasShareToken,
  });
};

export const useCampaignMembersQuery = (campaignId, enabled = true) => {
  const isValidId = Number.isInteger(campaignId) && campaignId > 0;

  return useQuery({
    queryKey: ['campaign', campaignId, 'members'],
    queryFn: async () => {
      const res = await getCampaignMembers(campaignId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch members');
      }
      return res.data || [];
    },
    enabled: isValidId && enabled,
    staleTime: 30 * 1000,
  });
};

export const useCampaignShareLinkQuery = (campaignId, enabled = true) => {
  const isValidId = Number.isInteger(campaignId) && campaignId > 0;

  return useQuery({
    queryKey: ['campaign', campaignId, 'share-link'],
    queryFn: async () => {
      const res = await getCampaignShareLink(campaignId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch share link');
      }
      return res.data || null;
    },
    enabled: isValidId && enabled,
    staleTime: 30 * 1000,
  });
};

export const useCampaignJoinRequestsQuery = (campaignId, canModerate) => {
  const isValidId = Number.isInteger(campaignId) && campaignId > 0;

  return useQuery({
    queryKey: ['campaign', campaignId, 'requests'],
    queryFn: async () => {
      const res = await getJoinRequests(campaignId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch requests');
      }
      return res.data || [];
    },
    enabled: isValidId && !!canModerate,
    staleTime: 30 * 1000,
  });
};

export const useCampaignMutations = (campaignId, options = {}) => {
  const { shareToken = null } = options;
  const queryClient = useQueryClient();

  const invalidateCampaign = () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'members'] });
  const invalidateRequests = () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'requests'] });

  const handleMutation = (successMessage, invalidateFns = []) => ({
    onSuccess: (res) => {
      if (res?.success === false) {
        toast.error(res.error || res.message || 'Сталася помилка');
      } else {
        if (successMessage) {
          toast.success(successMessage);
        }
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

  const regenerateShareLinkMutation = useMutation({
    mutationFn: () => regenerateShareLink(campaignId),
    ...handleMutation('Share link regenerated', [invalidateCampaign]),
  });

  const submitJoinRequestMutation = useMutation({
    mutationFn: (message) => submitJoinRequest(campaignId, message, shareToken),
    ...handleMutation('Заявку надіслано', [invalidateRequests, invalidateCampaign]),
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
    ...handleMutation('Роль учасника змінено', [invalidateMembers, invalidateCampaign]),
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
    regenerateShareLink: regenerateShareLinkMutation.mutateAsync,
    submitJoinRequest: submitJoinRequestMutation.mutateAsync,
    approveRequest: approveRequestMutation.mutateAsync,
    rejectRequest: rejectRequestMutation.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    changeMemberRole: changeMemberRoleMutation.mutateAsync,
    cancelSession: cancelSessionMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
  };
};
