import { useEffect, useRef, useCallback, useState } from 'react';
import useNotificationStore from '@/stores/useNotificationStore';

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

/**
 * Hook для підключення до SSE stream сповіщень
 * MVP-16: Client SSE with reconnect and backoff
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
          // Keep connection alive, no action needed
          return;
        }

        if (data.type === 'notification' && data.data) {
          const notification = data.data;

          // Add to live notifications
          addLiveNotification(notification);

          console.log('[SSE] Notification received:', notification.title);
        }
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error);
      }
    };

    es.onerror = (error) => {
      console.error('[SSE] Error:', error);
      setConnectionState('error', 'Connection error');

      // Close current connection
      es.close();
      eventSourceRef.current = null;

      // Attempt reconnect with backoff
      setReconnectAttempts((prevAttempts) => {
        const newAttempts = prevAttempts + 1;
        if (newAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, newAttempts - 1),
            MAX_RECONNECT_DELAY
          );

          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${newAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
          }, delay);
        } else {
          console.error('[SSE] Max reconnect attempts reached');
          setConnectionState('error', 'Max reconnect attempts reached');
        }
        return newAttempts;
      });
    };
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

  // Cleanup on unmount
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
