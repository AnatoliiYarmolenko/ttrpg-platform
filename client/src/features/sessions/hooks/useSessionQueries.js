import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import {
  getSessionById,
  getSessionByShareToken,
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

export const useSessionQuery = ({ sessionId = null, shareToken = null } = {}) => {
  const isValidId = Number.isInteger(sessionId) && sessionId > 0;
  const hasShareToken = typeof shareToken === 'string' && shareToken.trim().length > 0;

  return useQuery({
    queryKey: ['session', sessionId || null, shareToken || null],
    queryFn: async () => {
      const res = hasShareToken
        ? await getSessionByShareToken(shareToken)
        : await getSessionById(sessionId);

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
  const invalidateParticipants = () => queryClient.invalidateQueries({ queryKey: ['session', sessionId, 'participants'] });

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

  const updateSessionMutation = useMutation({
    mutationFn: (data) => updateSession(sessionId, data),
    ...handleMutation('Сесію успішно оновлено', [invalidateSession, invalidateParticipants]),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: () => deleteSession(sessionId),
    ...handleMutation('Сесію видалено', [invalidateSession, invalidateParticipants]),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: () => cancelSession(sessionId),
    ...handleMutation('Сесію скасовано', [invalidateSession, invalidateParticipants]),
  });

  const finishSessionMutation = useMutation({
    mutationFn: () => markSessionAsFinished(sessionId),
    ...handleMutation('Сесію завершено', [invalidateSession, invalidateParticipants]),
  });

  const regenerateShareLinkMutation = useMutation({
    mutationFn: () => regenerateSessionShareLink(sessionId),
    ...handleMutation('Share link regenerated', [invalidateSession]),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status) => updateSession(sessionId, { status }),
    ...handleMutation('Статус сесії оновлено', [invalidateSession, invalidateParticipants]),
  });

  const joinSessionMutation = useMutation({
    mutationFn: (payload) => joinSession(sessionId, {
      ...payload,
      ...(shareToken ? { shareToken } : {}),
    }),
    ...handleMutation('Ви успішно приєдналися до сесії', [invalidateSession, invalidateParticipants]),
  });

  const leaveSessionMutation = useMutation({
    mutationFn: () => leaveSession(sessionId),
    ...handleMutation('Ви покинули сесію', [invalidateSession, invalidateParticipants]),
  });

  const updateParticipantStatusMutation = useMutation({
    mutationFn: ({ participantId, status }) => updateParticipantStatus(sessionId, participantId, status),
    ...handleMutation('Статус учасника оновлено', [invalidateParticipants, invalidateSession]),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId) => removeParticipant(sessionId, participantId),
    ...handleMutation('Учасника видалено', [invalidateParticipants, invalidateSession]),
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
