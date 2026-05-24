import { useEffect, useRef, useState } from 'react';
import useAuthStore from '@/stores/useAuthStore';
import { useCallStore } from '@/stores/useCallStore';
import { CallRpcClient } from '../lib/callRpcClient';
import { resolveCallWsUrl } from '../lib/resolveCallWsUrl';
import { useSessionCallConfigQuery } from '@/features/sessions/hooks/useSessionQueries';
import { toast } from '@/stores/useToastStore';

export function useCallConnection(sessionId) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const { 
    setCallState, 
    setConnectionState,
    setPeers,
    addPeer,
    removePeer,
    updatePeerMedia,
    reset
  } = useCallStore();
  
  const rpcClientRef = useRef(null);
  const [rpcClient, setRpcClient] = useState(null);
  const { data: callConfig, isSuccess: isConfigReady } = useSessionCallConfigQuery(sessionId);

  useEffect(() => {
    if (!sessionId || !isAuthenticated || !isConfigReady || !callConfig?.wsCallPath) {
      return;
    }

    const wsUrl = resolveCallWsUrl(callConfig.wsCallPath);
    if (!wsUrl) return;

    const rpcClient = new CallRpcClient(wsUrl);
    rpcClientRef.current = rpcClient;
    // Уникаємо синхронного setState в effect, щоб не викликати каскадні ререндери.
    // Плануємо оновлення стану в черзі мікрозадач.
    Promise.resolve().then(() => setRpcClient(rpcClient));

    const mapPeer = (peer) => ({
      ...peer,
      micEnabled: peer.mediaState?.micEnabled || false,
      camEnabled: peer.mediaState?.camEnabled || false
    });

    const connect = async () => {
      setConnectionState('CONNECTING');
      try {
        await rpcClient.connect();
        setConnectionState('CONNECTED');
        
        // Отримуємо поточний стан дзвінка під час підключення
        try {
          const state = await rpcClient.request('call:getCallState', { sessionId });
          setCallState(state.callState);
          setPeers((state.peers || []).map(mapPeer));
        } catch (err) {
          console.error('Failed to get initial call state', err);
        }

      } catch (err) {
        console.error('Failed to get initial call state', err);
        setConnectionState('DISCONNECTED');
        toast.error('Failed to connect to call signaling server');
      }
    };

    // Обробники серверних подій
    rpcClient.on('call:started', (payload) => {
      setCallState(payload.callState);
    });

    rpcClient.on('call:ended', () => {
      setCallState('ENDED');
      setPeers([]);
      // Повністю WS не відключаємо, просто очікуємо
    });

    rpcClient.on('call:participant-joined', (payload) => {
      if (payload.participant) {
        addPeer(mapPeer(payload.participant));
      }
    });

    rpcClient.on('call:participant-left', (payload) => {
      removePeer(payload.userId);
    });

    rpcClient.on('call:media-state-changed', (payload) => {
      updatePeerMedia(payload.userId, {
        micEnabled: payload.mediaState.micEnabled || false,
        camEnabled: payload.mediaState.camEnabled || false
      });
    });

    rpcClient.on('disconnected', () => {
      setConnectionState('DISCONNECTED');
    });
    
    rpcClient.on('error', (payload) => {
      toast.error(`Call Error: ${payload.message}`);
    });

    connect();

    return () => {
      rpcClient.disconnect();
      rpcClientRef.current = null;
      reset();
    };
  }, [sessionId, isAuthenticated, isConfigReady, callConfig?.wsCallPath, setConnectionState, setCallState, setPeers, addPeer, removePeer, updatePeerMedia, reset]);

  return {
    rpcClient,
    connectionState: useCallStore(state => state.connectionState),
    callState: useCallStore(state => state.callState),
    callConfig,
  };
}
