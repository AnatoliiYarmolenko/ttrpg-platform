import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import {
  getSessionById,
  getSessionParticipants,
  updateSession,
  deleteSession,
  cancelSession,
  markSessionAsFinished,
  joinSession,
  leaveSession,
  updateParticipantStatus,
  removeParticipant,
} from '../api/sessionApi';

// QUERIES
export const useSessionQuery = (sessionId) => {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const res = await getSessionById(sessionId);
      if (!res.success) throw new Error(res.error || 'Failed to fetch session');
      return res.data;
    },
    enabled: !!sessionId,
  });
};

export const useSessionParticipantsQuery = (sessionId) => {
  return useQuery({
    queryKey: ['session', sessionId, 'participants'],
    queryFn: async () => {
      const res = await getSessionParticipants(sessionId);
      if (!res.success) throw new Error(res.error || 'Failed to fetch participants');
      return res.data || [];
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });
};

// MUTATIONS
export const useSessionMutations = (sessionId) => {
  const queryClient = useQueryClient();

  const invalidateSession = () => queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
  const invalidateParticipants = () => queryClient.invalidateQueries({ queryKey: ['session', sessionId, 'participants'] });

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

  const updateSessionMutation = useMutation({
    mutationFn: (data) => updateSession(sessionId, data),
    ...handleMutation('Сесію успішно оновлено', [invalidateSession]),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: () => deleteSession(sessionId),
    ...handleMutation('Сесію видалено', [invalidateSession]),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: () => cancelSession(sessionId),
    ...handleMutation('Сесію скасовано', [invalidateSession]),
  });

  const finishSessionMutation = useMutation({
    mutationFn: () => markSessionAsFinished(sessionId),
    ...handleMutation('Сесію завершено', [invalidateSession]),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status) => updateSession(sessionId, { status }),
    ...handleMutation('Статус сесії оновлено', [invalidateSession]),
  });

  const joinSessionMutation = useMutation({
    mutationFn: (payload) => joinSession(sessionId, payload),
    ...handleMutation('Ви успішно приєдналися до сесії', [invalidateSession, invalidateParticipants]),
  });

  const leaveSessionMutation = useMutation({
    mutationFn: () => leaveSession(sessionId),
    ...handleMutation('Ви покинули сесію', [invalidateSession, invalidateParticipants]),
  });

  const updateParticipantStatusMutation = useMutation({
    mutationFn: ({ participantId, status }) => updateParticipantStatus(sessionId, participantId, status),
    ...handleMutation('Статус учасника оновлено', [invalidateParticipants]),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId) => removeParticipant(sessionId, participantId),
    ...handleMutation('Учасника видалено', [invalidateParticipants]),
  });

  return {
    updateSession: updateSessionMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
    cancelSession: cancelSessionMutation.mutateAsync,
    finishSession: finishSessionMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    joinSession: joinSessionMutation.mutateAsync,
    leaveSession: leaveSessionMutation.mutateAsync,
    updateParticipantStatus: updateParticipantStatusMutation.mutateAsync,
    removeParticipant: removeParticipantMutation.mutateAsync,
  };
};
