/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import useAuthStore from '@/stores/useAuthStore';
import { useCallStore } from '@/stores/useCallStore';
import { CallRpcClient } from '../lib/callRpcClient';
import { resolveCallWsUrl } from '../lib/resolveCallWsUrl';
import { useSessionCallConfigQuery } from '@/features/sessions/hooks/useSessionQueries';
import { toast } from '@/stores/useToastStore';
import { GlobalAudioRenderer } from './GlobalAudioRenderer';

const GlobalCallContext = createContext(null);

export function useGlobalCall() {
  return useContext(GlobalCallContext);
}

export function GlobalCallProvider({ children }) {
  
  const activeSessionId = useCallStore(state => state.activeSessionId);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  
  const { 
    setCallState, 
    setConnectionState,
    setPeers,
    addPeer,
    removePeer,
    updatePeerMedia,
    disconnectAndCleanup,
  } = useCallStore();
  
  const rpcClientRef = useRef(null);
  const [rpcClient, setRpcClient] = useState(null);
  
  const { data: callConfig, isSuccess: isConfigReady } = useSessionCallConfigQuery(activeSessionId, !!activeSessionId);

  // Очищення стану дзвінка при логауті
  useEffect(() => {
    if (!isAuthenticated) {
      useCallStore.getState().disconnectAndCleanup(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!activeSessionId || !isAuthenticated || !isConfigReady || !callConfig?.wsCallPath) {
      return;
    }

    const wsUrl = resolveCallWsUrl(callConfig.wsCallPath);
    if (!wsUrl) return;

    const newRpcClient = new CallRpcClient(wsUrl);
    rpcClientRef.current = newRpcClient;
    
    Promise.resolve().then(() => setRpcClient(newRpcClient));

    const mapPeer = (peer) => ({
      ...peer,
      micEnabled: peer.mediaState?.micEnabled || false,
      camEnabled: peer.mediaState?.camEnabled || false
    });

    const connect = async () => {
      setConnectionState('CONNECTING');
      try {
        await newRpcClient.connect();
        if (rpcClientRef.current !== newRpcClient) return;
        
        setConnectionState('CONNECTED');
        
        try {
          const state = await newRpcClient.request('call:getCallState', { sessionId: activeSessionId });
          if (rpcClientRef.current !== newRpcClient) return;
          setCallState(state.callState);
          setPeers((state.peers || []).map(mapPeer));
        } catch (err) {
          if (rpcClientRef.current !== newRpcClient) return;
          console.error('Failed to get initial call state', err);
        }

      } catch (err) {
        if (rpcClientRef.current !== newRpcClient) return;
        console.error('Failed to connect to call server', err);
        setConnectionState('DISCONNECTED');
        toast.error('Не вдалося підключитися до сигнального сервера дзвінка');
      }
    };

    newRpcClient.on('call:started', (payload) => {
      setCallState(payload.callState || 'ACTIVE');
    });

    newRpcClient.on('call:ended', () => {
      setCallState('ENDED');
      disconnectAndCleanup();
      toast.info('Дзвінок завершено');
    });

    newRpcClient.on('call:participant-joined', (payload) => {
      if (payload.participant) {
        addPeer(mapPeer(payload.participant));
      }
    });

    newRpcClient.on('call:participant-left', (payload) => {
      removePeer(payload.peerId);
    });

    newRpcClient.on('call:media-state-changed', (payload) => {
      updatePeerMedia(payload.peerId, {
        micEnabled: payload.mediaState.micEnabled || false,
        camEnabled: payload.mediaState.camEnabled || false
      });
    });

    newRpcClient.on('disconnected', () => {
      setConnectionState('DISCONNECTED');
    });
    
    newRpcClient.on('error', (payload) => {
      toast.error(`Call Error: ${payload.message}`);
    });

    connect();

    return () => {
      newRpcClient.disconnect();
      rpcClientRef.current = null;
      setRpcClient(null);
    };
  }, [
    activeSessionId, 
    isAuthenticated, 
    isConfigReady, 
    callConfig?.wsCallPath,
    addPeer,
    disconnectAndCleanup,
    removePeer,
    setCallState,
    setConnectionState,
    setPeers,
    updatePeerMedia
  ]);

  const contextValue = useMemo(() => ({
    rpcClient,
    callConfig,
  }), [rpcClient, callConfig]);

  return (
    <GlobalCallContext.Provider value={contextValue}>
      {children}
      <GlobalAudioRenderer />
    </GlobalCallContext.Provider>
  );
}

GlobalCallProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
