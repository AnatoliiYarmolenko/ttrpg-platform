import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import {
  getCampaignPageById,
  getCampaignPageByShareToken,
  updateCampaign,
  transferCampaignOwnership,
  cancelCampaignSession,
  deleteCampaignSession,
  removeMemberFromCampaign,
  updateMemberRole,
  regenerateShareLink,
  getCampaignShareLink,
  submitJoinRequest,
  approveJoinRequest,
  rejectJoinRequest,
} from '../api/campaignApi';

export const campaignPageQueryKeys = {
  all: ['campaign-page'],
  byId: (campaignId) => ['campaign-page', campaignId || null, null],
  byShare: (shareToken) => ['campaign-page', null, shareToken || null],
  detail: ({ campaignId = null, shareToken = null } = {}) => (
    ['campaign-page', campaignId || null, shareToken || null]
  ),
};

export const invalidateCampaignPage = async (
  queryClient,
  { campaignId = null, shareToken = null } = {}
) => {
  const tasks = [];
  const isValidId = Number.isInteger(campaignId) && campaignId > 0;
  const hasShareToken = typeof shareToken === 'string' && shareToken.trim().length > 0;

  if (isValidId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['campaign-page', campaignId || null] }));
  }

  if (hasShareToken) {
    tasks.push(queryClient.invalidateQueries({ queryKey: campaignPageQueryKeys.byShare(shareToken) }));
  }

  if (!isValidId && !hasShareToken) {
    tasks.push(queryClient.invalidateQueries({ queryKey: campaignPageQueryKeys.all }));
  }

  await Promise.all(tasks);
};

export const useCampaignPageQuery = ({
  campaignId = null,
  shareToken = null,
} = {}) => {
  const isValidId = Number.isInteger(campaignId) && campaignId > 0;
  const hasShareToken = typeof shareToken === 'string' && shareToken.trim().length > 0;

  return useQuery({
    queryKey: campaignPageQueryKeys.detail({ campaignId, shareToken }),
    queryFn: async () => {
      const res = hasShareToken
        ? await getCampaignPageByShareToken(shareToken)
        : await getCampaignPageById(campaignId);

      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch campaign');
      }

      return res.data;
    },
    enabled: isValidId || hasShareToken,
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

export const useCampaignMutations = (campaignId, options = {}) => {
  const { shareToken = null } = options;
  const queryClient = useQueryClient();

  const invalidateCampaignPageQuery = () => invalidateCampaignPage(queryClient, { campaignId, shareToken });
  const invalidateCampaignDetail = () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
  const invalidateCampaignsList = () => queryClient.invalidateQueries({ queryKey: ['campaigns'] });
  const invalidateCampaignShareLink = () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'share-link'] });

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
      const apiError = err?.response?.data;
      const validationMessage = Array.isArray(apiError?.details) && apiError.details.length > 0
        ? apiError.details[0]?.message
        : null;

      toast.error(validationMessage || apiError?.error || err?.message || 'Сталася помилка');
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: (data) => updateCampaign(campaignId, data),
    ...handleMutation('Кампанію оновлено', [invalidateCampaignPageQuery, invalidateCampaignDetail, invalidateCampaignsList]),
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: (newOwnerId) => transferCampaignOwnership(campaignId, newOwnerId),
    ...handleMutation('Власника кампанії змінено', [invalidateCampaignPageQuery, invalidateCampaignDetail, invalidateCampaignsList]),
  });

  const regenerateShareLinkMutation = useMutation({
    mutationFn: () => regenerateShareLink(campaignId),
    ...handleMutation('Share-посилання оновлено', [invalidateCampaignPageQuery, invalidateCampaignDetail, invalidateCampaignShareLink]),
  });

  const submitJoinRequestMutation = useMutation({
    mutationFn: (message = '') => submitJoinRequest(campaignId, message, shareToken),
    ...handleMutation('Заявку на вступ надіслано', [invalidateCampaignPageQuery, invalidateCampaignDetail]),
  });

  const approveRequestMutation = useMutation({
    mutationFn: ({ requestId, role = 'PLAYER' }) => approveJoinRequest(requestId, role),
    ...handleMutation('Заявку підтверджено', [invalidateCampaignPageQuery, invalidateCampaignDetail, invalidateCampaignsList]),
  });

  const rejectRequestMutation = useMutation({
    mutationFn: (requestId) => rejectJoinRequest(requestId),
    ...handleMutation('Заявку відхилено', [invalidateCampaignPageQuery, invalidateCampaignDetail]),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId) => removeMemberFromCampaign(campaignId, memberId),
    ...handleMutation('Учасника видалено', [invalidateCampaignPageQuery, invalidateCampaignDetail, invalidateCampaignsList]),
  });

  const changeMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, role }) => updateMemberRole(campaignId, memberId, role),
    ...handleMutation('Роль учасника оновлено', [invalidateCampaignPageQuery, invalidateCampaignDetail]),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: (sessionId) => cancelCampaignSession(sessionId),
    ...handleMutation('Сесію скасовано', [invalidateCampaignPageQuery, invalidateCampaignDetail]),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId) => deleteCampaignSession(sessionId),
    ...handleMutation('Сесію видалено', [invalidateCampaignPageQuery, invalidateCampaignDetail]),
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
