import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import { invalidateSessionCollectionQueries, getCachedCampaignIdForSession } from '@/lib/queryInvalidation';
import {
  getSessionPageById,
  getSessionPageByShareToken,
  getSessionParticipants,
  updateSession,
  deleteSession,
  cancelSession,
  markSessionAsFinished,
  regenerateSessionShareLink,
  getSessionShareLink,
  joinSession,
  leaveSession,
  updateParticipantStatus,
  removeParticipant,
  getSessionCallConfig,
} from '../api/sessionApi';

export const sessionPageQueryKeys = {
  all: ['session-page'],
  byShare: (shareToken) => ['session-page', null, shareToken || null],
  detail: ({ sessionId = null, shareToken = null, campaignShareToken = null } = {}) => (
    ['session-page', sessionId || null, shareToken || null, campaignShareToken || null]
  ),
};

export const sessionQueryKeys = {
  all: ['session'],
  detail: (sessionId) => ['session', sessionId || null],
  participants: (sessionId) => ['session', sessionId || null, 'participants'],
  shareLink: (sessionId) => ['session', sessionId || null, 'share-link'],
  callConfig: (sessionId) => ['session', sessionId || null, 'call-config'],
};

export const invalidateSessionPage = async (
  queryClient,
  { sessionId = null, shareToken = null } = {}
) => {
  const tasks = [];
  const isValidId = Number.isInteger(sessionId) && sessionId > 0;
  const hasShareToken = typeof shareToken === 'string' && shareToken.trim().length > 0;

  if (isValidId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['session-page', sessionId || null] }));
  }

  if (hasShareToken) {
    tasks.push(queryClient.invalidateQueries({ queryKey: sessionPageQueryKeys.byShare(shareToken) }));
  }

  if (!isValidId && !hasShareToken) {
    tasks.push(queryClient.invalidateQueries({ queryKey: sessionPageQueryKeys.all }));
  }

  await Promise.allSettled(tasks);
};

export const useSessionPageQuery = ({
  sessionId = null,
  shareToken = null,
  campaignShareToken = null,
} = {}) => {
  const isValidId = Number.isInteger(sessionId) && sessionId > 0;
  const hasShareToken = typeof shareToken === 'string' && shareToken.trim().length > 0;

  return useQuery({
    queryKey: sessionPageQueryKeys.detail({ sessionId, shareToken, campaignShareToken }),
    queryFn: async () => {
      const res = hasShareToken
        ? await getSessionPageByShareToken(shareToken)
        : await getSessionPageById(sessionId, { campaignShareToken });

      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch session');
      }

      return res.data;
    },
    enabled: isValidId || hasShareToken,
  });
};

export const useSessionParticipantsQuery = (sessionId, enabled = true) => {
  const isValidId = Number.isInteger(sessionId) && sessionId > 0;

  return useQuery({
    queryKey: sessionQueryKeys.participants(sessionId),
    queryFn: async () => {
      const res = await getSessionParticipants(sessionId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch participants');
      }
      return res.data || [];
    },
    enabled: isValidId && enabled,
    staleTime: 30 * 1000,
  });
};

export const useSessionShareLinkQuery = (sessionId, enabled = true) => {
  const isValidId = Number.isInteger(sessionId) && sessionId > 0;

  return useQuery({
    queryKey: sessionQueryKeys.shareLink(sessionId),
    queryFn: async () => {
      const res = await getSessionShareLink(sessionId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch share link');
      }
      return res.data || null;
    },
    enabled: isValidId && enabled,
    staleTime: 30 * 1000,
  });
};

export const useSessionCallConfigQuery = (sessionId, enabled = true) => {
  const isValidId = Number.isInteger(sessionId) && sessionId > 0;

  return useQuery({
    queryKey: sessionQueryKeys.callConfig(sessionId),
    queryFn: async () => {
      const res = await getSessionCallConfig(sessionId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch call config');
      }
      return res.data || null;
    },
    enabled: isValidId && enabled,
    staleTime: 5 * 60 * 1000,
  });
};

export const useSessionMutations = (sessionId, options = {}) => {
  const { shareToken = null } = options;
  const queryClient = useQueryClient();

  const invalidateSession = () => queryClient.invalidateQueries({ queryKey: sessionQueryKeys.detail(sessionId) });
  const invalidateSessionPageQuery = () => invalidateSessionPage(queryClient, { sessionId, shareToken });
  const invalidateParticipants = () => queryClient.invalidateQueries({ queryKey: sessionQueryKeys.participants(sessionId) });
  const invalidateShareLink = () => queryClient.invalidateQueries({ queryKey: sessionQueryKeys.shareLink(sessionId) });

  const getCachedCampaignId = () => {
    return options.campaignId || getCachedCampaignIdForSession(queryClient, sessionId);
  };

  const invalidateCampaignPageForSession = (res) => {
    const campaignId = res?.data?.campaignId || res?.data?.campaign?.id || getCachedCampaignId();
    if (campaignId) {
      return queryClient.invalidateQueries({ queryKey: ['campaign-page', campaignId] });
    }
    return queryClient.invalidateQueries({ queryKey: ['campaign-page'] });
  };

  const handleMutation = (successMessage, invalidateFns = []) => ({
    onSuccess: async (res) => {
      if (res?.success === false) {
        toast.error(res.error || res.message || 'Сталася помилка');
      } else {
        const message = typeof successMessage === 'function' ? successMessage(res) : successMessage;
        if (message) {
          toast.success(message);
        }
        await Promise.allSettled(invalidateFns.map((fn) => fn(res)));
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

  const updateSessionMutation = useMutation({
    mutationFn: (data) => updateSession(sessionId, data),
    ...handleMutation('Сесію успішно оновлено', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      invalidateShareLink,
      () => invalidateSessionCollectionQueries(queryClient),
      invalidateCampaignPageForSession,
    ]),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: () => deleteSession(sessionId),
    ...handleMutation('Сесію видалено', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      invalidateCampaignPageForSession,
    ]),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: () => cancelSession(sessionId),
    ...handleMutation('Сесію скасовано', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      invalidateCampaignPageForSession,
    ]),
  });

  const finishSessionMutation = useMutation({
    mutationFn: () => markSessionAsFinished(sessionId),
    ...handleMutation('Сесію завершено', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      invalidateCampaignPageForSession,
      () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
    ]),
  });

  const regenerateShareLinkMutation = useMutation({
    mutationFn: () => regenerateSessionShareLink(sessionId),
    ...handleMutation('Share-посилання оновлено', [invalidateSessionPageQuery, invalidateSession, invalidateShareLink]),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status) => updateSession(sessionId, { status }),
    ...handleMutation('Статус сесії оновлено', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      invalidateCampaignPageForSession,
    ]),
  });
  
  const joinSessionMutation = useMutation({
    mutationFn: (payload) => joinSession(sessionId, {
      ...payload,
      ...(shareToken ? { shareToken } : {}),
    }),
    ...handleMutation((res) => res?.message || 'Заявку подано', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      invalidateCampaignPageForSession,
    ]),
  });

  const leaveSessionMutation = useMutation({
    mutationFn: () => leaveSession(sessionId),
    ...handleMutation((res) => res?.message || 'Ви покинули сесію', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      invalidateCampaignPageForSession,
    ]),
  });

  const updateParticipantStatusMutation = useMutation({
    mutationFn: ({ participantId, status }) => updateParticipantStatus(sessionId, participantId, status),
    ...handleMutation('Статус учасника оновлено', [
      invalidateParticipants,
      invalidateSessionPageQuery,
      invalidateSession,
      () => invalidateSessionCollectionQueries(queryClient),
      invalidateCampaignPageForSession,
    ]),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId) => removeParticipant(sessionId, participantId),
    ...handleMutation('Учасника видалено з сесії', [
      invalidateParticipants,
      invalidateSessionPageQuery,
      invalidateSession,
      () => invalidateSessionCollectionQueries(queryClient),
      invalidateCampaignPageForSession,
    ]),
  });

  return {
    updateSession: updateSessionMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
    cancelSession: cancelSessionMutation.mutateAsync,
    finishSession: finishSessionMutation.mutateAsync,
    regenerateShareLink: regenerateShareLinkMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    joinSession: joinSessionMutation.mutateAsync,
    leaveSession: leaveSessionMutation.mutateAsync,
    updateParticipantStatus: updateParticipantStatusMutation.mutateAsync,
    removeParticipant: removeParticipantMutation.mutateAsync,
    isPendingUpdate: updateSessionMutation.isPending,
    isPendingRegenerateShareLink: regenerateShareLinkMutation.isPending,
  };
};
