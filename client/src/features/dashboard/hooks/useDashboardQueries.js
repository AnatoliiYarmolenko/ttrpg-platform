import { useQuery } from '@tanstack/react-query';
import { getMyCampaigns } from '@/features/campaigns/api/campaignApi';
import { getMySessions, getNextRelevantSession, getSessionById } from '@/features/sessions/api/sessionApi';
import useAuthStore from '@/stores/useAuthStore';

const getConfirmedGmName = (participants = []) => {
  const confirmedGm = participants.find(
    (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
  );

  return confirmedGm?.user?.displayName || confirmedGm?.user?.username || null;
};

const hydrateHomeSessionFromDetails = (session, details) => {
  const participants = Array.isArray(details?.participants) ? details.participants : null;
  const playerCountFromParticipants = participants
    ? participants.filter((participant) => participant.role === 'PLAYER').length
    : null;

  return {
    ...session,
    title: session?.title ?? details?.title ?? null,
    description: session?.description ?? details?.description ?? details?.campaign?.description ?? null,
    startAt: session?.startAt ?? details?.startAt ?? null,
    status: session?.status ?? details?.status ?? null,
    visibility: session?.visibility ?? details?.visibility ?? null,
    system: session?.system ?? details?.system ?? details?.campaign?.system ?? null,
    organizerName:
      session?.organizerName
      ?? details?.owner?.displayName
      ?? details?.owner?.username
      ?? null,
    confirmedGmName: session?.confirmedGmName ?? getConfirmedGmName(participants || []),
    maxPlayers: session?.maxPlayers ?? details?.maxPlayers ?? null,
    participantsCount: session?.participantsCount ?? (participants ? participants.length : null),
    currentPlayers:
      session?.currentPlayers
      ?? playerCountFromParticipants
      ?? null,
    campaign: session?.campaign
      ?? (details?.campaign
        ? {
          id: details.campaign.id,
          title: details.campaign.title,
          status: details.campaign.status,
          system: details.campaign.system ?? null,
        }
        : null),
  };
};

export const useMyCampaignsQuery = (role = 'all') => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isSessionValidated = useAuthStore((state) => state.isSessionValidated);

  return useQuery({
    queryKey: ['dashboard', 'campaigns', userId, role],
    queryFn: async () => {
      const response = await getMyCampaigns(role);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch campaigns');
      }
      return response.data || [];
    },
    enabled: !!userId && isSessionValidated,
  });
};

export const useMySessionsQuery = (params = {}) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isSessionValidated = useAuthStore((state) => state.isSessionValidated);

  return useQuery({
    queryKey: ['dashboard', 'games', userId, params],
    queryFn: async () => {
      const response = await getMySessions(params);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch sessions');
      }
      return response.data || [];
    },
    enabled: !!userId && isSessionValidated,
  });
};

export const useNextRelevantSessionQuery = (enabled = true) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isSessionValidated = useAuthStore((state) => state.isSessionValidated);
  const isEnabled = enabled && Boolean(userId) && isSessionValidated;

  return useQuery({
    queryKey: ['dashboard', 'home', 'next-relevant-session', userId],
    queryFn: async () => {
      const response = await getNextRelevantSession();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch next relevant session');
      }

      const session = response.data?.session ?? null;
      if (!session?.id) {
        return null;
      }

      const needsHydration = !session.description || !session.organizerName || !session.maxPlayers;
      if (!needsHydration) {
        return session;
      }

      try {
        const detailsResponse = await getSessionById(session.id);
        if (!detailsResponse.success || !detailsResponse.data) {
          return session;
        }

        return hydrateHomeSessionFromDetails(session, detailsResponse.data);
      } catch {
        return session;
      }
    },
    enabled: isEnabled,
    staleTime: 30 * 1000,
    refetchInterval: isEnabled ? 30 * 1000 : false,
    refetchIntervalInBackground: false,
  });
};
