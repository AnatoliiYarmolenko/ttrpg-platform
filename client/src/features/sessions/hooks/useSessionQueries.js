import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import { invalidateSessionCollectionQueries } from '@/lib/queryInvalidation';
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
} from '../api/sessionApi';

export const sessionPageQueryKeys = {
  all: ['session-page'],
  byId: (sessionId, campaignShareToken = null) => ['session-page', sessionId || null, null, campaignShareToken || null],
  byShare: (shareToken) => ['session-page', null, shareToken || null],
  detail: ({ sessionId = null, shareToken = null, campaignShareToken = null } = {}) => (
    ['session-page', sessionId || null, shareToken || null, campaignShareToken || null]
  ),
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

  await Promise.all(tasks);
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
    queryKey: ['session', sessionId, 'participants'],
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
    queryKey: ['session', sessionId, 'share-link'],
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

export const useSessionMutations = (sessionId, options = {}) => {
  const { shareToken = null } = options;
  const queryClient = useQueryClient();

  const invalidateSession = () => queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
  const invalidateSessionPageQuery = () => invalidateSessionPage(queryClient, { sessionId, shareToken });
  const invalidateParticipants = () => queryClient.invalidateQueries({ queryKey: ['session', sessionId, 'participants'] });
  const invalidateShareLink = () => queryClient.invalidateQueries({ queryKey: ['session', sessionId, 'share-link'] });

  const handleMutation = (successMessage, invalidateFns = []) => ({
    onSuccess: async (res) => {
      if (res?.success === false) {
        toast.error(res.error || res.message || 'Сталася помилка');
      } else {
        if (successMessage) {
          toast.success(successMessage);
        }
        await Promise.allSettled(invalidateFns.map((fn) => fn()));
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

  const updateSessionHandlers = handleMutation('Сесію успішно оновлено', [
    invalidateSessionPageQuery,
    invalidateSession,
    invalidateParticipants,
    invalidateShareLink,
    () => invalidateSessionCollectionQueries(queryClient),
  ]);

  const updateSessionMutation = useMutation({
    mutationFn: (data) => updateSession(sessionId, data),
    onSuccess: async (res) => {
      await updateSessionHandlers.onSuccess(res);
      if (res?.success !== false && res?.data?.campaignId) {
        await queryClient.invalidateQueries({ 
          queryKey: ['campaign-page', res.data.campaignId] 
        });
      }
    },
    onError: updateSessionHandlers.onError, // якщо є
  });

  const deleteSessionMutation = useMutation({
    mutationFn: () => deleteSession(sessionId),
    ...handleMutation('Сесію видалено', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      () => queryClient.invalidateQueries({ queryKey: ['campaign-page'] }),
    ]),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: () => cancelSession(sessionId),
    ...handleMutation('Сесію скасовано', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      () => queryClient.invalidateQueries({ queryKey: ['campaign-page'] }),
    ]),
  });

  const finishSessionMutation = useMutation({
    mutationFn: () => markSessionAsFinished(sessionId),
    ...handleMutation('Сесію завершено', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      () => queryClient.invalidateQueries({ queryKey: ['campaign-page'] }),
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
      () => queryClient.invalidateQueries({ queryKey: ['campaign-page'] }),
    ]),
  });
  
  const joinSessionMutation = useMutation({
    mutationFn: (payload) => joinSession(sessionId, {
      ...payload,
      ...(shareToken ? { shareToken } : {}),
    }),
    ...handleMutation('Ви успішно приєдналися до сесії', [
      invalidateSessionPageQuery,
      invalidateSession,
      invalidateParticipants,
      () => invalidateSessionCollectionQueries(queryClient),
      () => queryClient.invalidateQueries({ queryKey: ['campaign-page'] }),
    ]),
  });

  const leaveSessionMutation = useMutation({
    mutationFn: () => leaveSession(sessionId),
    onSuccess: async (res) => {
      if (res?.success === false) {
        toast.error(res.error || res.message || 'Сталася помилка');
        return;
      }

      toast.success(res?.message || 'Ви покинули сесію');
      await Promise.allSettled([
        invalidateSessionPageQuery(),
        invalidateSession(),
        invalidateParticipants(),
        invalidateSessionCollectionQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['campaign-page'] }),
      ]);
    },
    onError: (err) => {
      const apiError = err?.response?.data;
      const validationMessage = Array.isArray(apiError?.details) && apiError.details.length > 0
        ? apiError.details[0]?.message
        : null;

      toast.error(validationMessage || apiError?.error || err?.message || 'Сталася помилка');
    },
  });

  const updateParticipantStatusMutation = useMutation({
    mutationFn: ({ participantId, status }) => updateParticipantStatus(sessionId, participantId, status),
    ...handleMutation('Статус учасника оновлено', [
      invalidateParticipants,
      invalidateSessionPageQuery,
      invalidateSession,
      () => invalidateSessionCollectionQueries(queryClient),
      () => queryClient.invalidateQueries({ queryKey: ['campaign-page'] }),
    ]),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId) => removeParticipant(sessionId, participantId),
    ...handleMutation('Учасника видалено', [
      invalidateParticipants,
      invalidateSessionPageQuery,
      invalidateSession,
      () => invalidateSessionCollectionQueries(queryClient),
      () => queryClient.invalidateQueries({ queryKey: ['campaign-page'] }),
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
  };
};
