import { useEffect, useRef, useCallback, useState } from 'react';
import useNotificationStore from '@/stores/useNotificationStore';
import { queryClient } from '@/lib/queryClient';
import {
  invalidateCampaignCollectionQueries,
  invalidateSessionCollectionQueries,
  getCachedCampaignIdForSession,
} from '@/lib/queryInvalidation';
import { invalidateSessionPage, sessionQueryKeys } from '@/features/sessions/hooks/useSessionQueries';
import { invalidateCampaignPage } from '@/features/campaigns/hooks/useCampaignQueries';

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

const CAMPAIGN_MEMBERSHIP_EVENTS = new Set([
  'CAMPAIGN_PARTICIPATION_CONFIRMED',
  'CAMPAIGN_PARTICIPATION_DECLINED',
  'CAMPAIGN_MEMBER_REMOVED',

  'CAMPAIGN_CONFIRMED',
  'CAMPAIGN_DECLINED',
  'CAMPAIGN_REMOVED',
  'CAMPAIGN_JOINED',
  'JOIN_REQUEST_APPROVED',
]);

const CAMPAIGN_JOIN_REQUEST_EVENTS = new Set([
  'CAMPAIGN_JOIN_REQUESTS_UPDATED',
  'CAMPAIGN_JOIN_REQUESTS',
]);

const SESSION_PARTICIPATION_EVENTS = new Set([
  'SESSION_PARTICIPATION_CONFIRMED',
  'SESSION_PARTICIPATION_DECLINED',
  'SESSION_PARTICIPANT_JOINED',
  'SESSION_TIME_CONFLICT',
  'SESSION_CANCELLED',
  'SESSION_RESCHEDULED',

  'SESSION_CONFIRMED',
  'SESSION_CONFLICT_REVIEW',
  'SESSION_PARTICIPANT_ADDED',
]);

const SESSION_JOIN_REQUEST_EVENTS = new Set([
  'SESSION_JOIN_REQUESTS_UPDATED',
  'SESSION_JOIN_REQUESTS',
]);

export const normalizeEventCode = (notification) => {
  const raw = notification?.type || notification?.eventType || notification?.eventKey || '';
  if (typeof raw !== 'string' || raw.length === 0) {
    return '';
  }

  return raw.split(':')[0].trim().toUpperCase();
};

const getNotificationSessionId = (notification) => {
  const metadataSessionId = Number(notification?.metadata?.sessionId);
  if (Number.isInteger(metadataSessionId) && metadataSessionId > 0) {
    return metadataSessionId;
  }

  return null;
};

const getNotificationCampaignId = (notification) => {
  const metadataCampaignId = Number(notification?.metadata?.campaignId);
  if (Number.isInteger(metadataCampaignId) && metadataCampaignId > 0) {
    return metadataCampaignId;
  }

  return null;
};

const KNOWN_EVENT_SETS = [
  CAMPAIGN_MEMBERSHIP_EVENTS,
  CAMPAIGN_JOIN_REQUEST_EVENTS,
  SESSION_PARTICIPATION_EVENTS,
  SESSION_JOIN_REQUEST_EVENTS,
];

const invalidateQueriesByNotification = (notification) => {
  const eventCode = normalizeEventCode(notification);

  if (CAMPAIGN_MEMBERSHIP_EVENTS.has(eventCode)) {
    const campaignId = getNotificationCampaignId(notification);

    invalidateCampaignCollectionQueries(queryClient, {
      includeGames: true,
      includeHome: true,
      includeSearchSessions: true,
    });
    invalidateSessionPage(queryClient);

    if (campaignId) {
      invalidateCampaignPage(queryClient, { campaignId });
    } else {
      invalidateCampaignPage(queryClient);
    }
  }

  if (CAMPAIGN_JOIN_REQUEST_EVENTS.has(eventCode)) {
    const campaignId = getNotificationCampaignId(notification);

    if (campaignId) {
      invalidateCampaignPage(queryClient, { campaignId });
    } else {
      invalidateCampaignPage(queryClient);
    }
  }

  if (SESSION_JOIN_REQUEST_EVENTS.has(eventCode)) {
    const sessionId = getNotificationSessionId(notification);

    if (sessionId) {
      invalidateSessionPage(queryClient, { sessionId });
      queryClient.invalidateQueries({ queryKey: sessionQueryKeys.detail(sessionId) });
    } else {
      invalidateSessionPage(queryClient);
    }
  }

  if (SESSION_PARTICIPATION_EVENTS.has(eventCode)) {
    const sessionId = getNotificationSessionId(notification);
    const campaignId = getNotificationCampaignId(notification);

    invalidateSessionCollectionQueries(queryClient);

    if (campaignId) {
      invalidateCampaignPage(queryClient, { campaignId });
    } else {
      const cachedCampaignId = getCachedCampaignIdForSession(queryClient, sessionId);
      if (cachedCampaignId) {
        invalidateCampaignPage(queryClient, { campaignId: cachedCampaignId });
      } else {
        invalidateCampaignPage(queryClient);
      }
    }

    if (sessionId) {
      invalidateSessionPage(queryClient, { sessionId });
      queryClient.invalidateQueries({ queryKey: sessionQueryKeys.detail(sessionId) });
    }
  }

  const isHandled = eventCode && KNOWN_EVENT_SETS.some((set) => set.has(eventCode));
  if (!isHandled && eventCode) {
    const category = notification.category;
    if (category === 'session') {
      invalidateSessionCollectionQueries(queryClient);
    } else if (category === 'campaign') {
      invalidateCampaignCollectionQueries(queryClient, { includeGames: true, includeHome: true });
    }
  }
};

/**
 * Hook для підключення до SSE stream сповіщень
 *
 * @param {boolean} enabled - чи активувати SSE
 */
export default function useNotificationSSE(enabled = true) {
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const connectRef = useRef(null);

  const {
    setConnectionState,
    addLiveNotification,
    connectionState,
  } = useNotificationStore();

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    setConnectionState('connecting');

    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const sseUrl = `${apiBaseUrl.replace(/\/$/, '')}/notifications/stream`;
    const es = new EventSource(sseUrl, { withCredentials: true });

    eventSourceRef.current = es;

    es.onopen = () => {
      console.log('[SSE] Connected');
      setConnectionState('connected');
      setReconnectAttempts(0);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('[SSE] Connection confirmed:', data.timestamp);
          return;
        }

        if (data.type === 'heartbeat') {
          return;
        }

        if (data.type === 'cache:invalidate' && Array.isArray(data.queryKeys)) {
          data.queryKeys.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey });
          });
          return;
        }

        if (data.type === 'notification' && data.data) {
          const notification = data.data;

          addLiveNotification(notification);
          invalidateQueriesByNotification(notification);

          console.log('[SSE] Notification received:', notification.title);
        }
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error);
      }
    };

    const scheduleReconnect = (attempts) => {
      const newAttempts = attempts + 1;
      if (newAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, newAttempts - 1),
          MAX_RECONNECT_DELAY
        );

        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${newAttempts})`);

        reconnectTimeoutRef.current = setTimeout(connectRef.current, delay);
      } else {
        console.error('[SSE] Max reconnect attempts reached');
        setConnectionState('error', 'Max reconnect attempts reached');
      }

      return newAttempts;
    };

    const handleError = (error) => {
      console.error('[SSE] Error:', error);
      setConnectionState('error', 'Connection error');

      es.close();
      eventSourceRef.current = null;

      setReconnectAttempts((prev) => scheduleReconnect(prev));
    };

    es.onerror = handleError;
  }, [enabled, setConnectionState, addLiveNotification]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setReconnectAttempts(0);
    setConnectionState('disconnected');
  }, [setConnectionState]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setReconnectAttempts(0);
      setConnectionState('disconnected');
    };
  }, [enabled, connect, setConnectionState]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    hasError: connectionState === 'error',
    reconnectAttempts,
    connect,
    disconnect,
  };
}
