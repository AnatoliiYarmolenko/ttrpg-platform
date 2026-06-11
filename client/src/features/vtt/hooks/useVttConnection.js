import { useEffect, useCallback, useRef } from 'react';
import useVttStore from '@/stores/useVttStore';
import useBattlefieldStore from '../components/battlefield/useBattlefieldStore';
import { sharedWsManager } from '@/lib/shared-ws';

export default function useVttConnection(sessionId, options = {}) {
  const { enabled = true } = options;

  const setVttState = useBattlefieldStore((s) => s.setVttState);
  const previewSceneImage = useBattlefieldStore((s) => s.previewSceneImage);
  const moveToken = useBattlefieldStore((s) => s.moveToken);
  
  const setVttOpen = useVttStore((s) => s.setVttOpen);
  const setIncomingRoll = useVttStore((s) => s.setIncomingRoll);

  const handleVttMessage = useCallback((data) => {
    // Ігноруємо якщо повідомлення не для цієї сесії
    if (data.sessionId && String(data.sessionId) !== String(sessionId)) return;

    switch (data.type) {
      case 'vtt:state':
        setVttOpen(sessionId, data.isOpen ?? true);
        setVttState(data);
        break;
      case 'vtt:opened':
        setVttOpen(sessionId, data.isOpen);
        break;
      case 'vtt:token_drag':
      case 'vtt:token_drop':
        moveToken(data.tokenId, data.x, data.y);
        break;
      case 'vtt:set_background':
        setVttState({ backgroundUrl: data.backgroundUrl, mapWidth: data.mapWidth, mapHeight: data.mapHeight });
        break;
      case 'vtt:dice:result':
        if (data.roll) {
          setIncomingRoll(data.roll);
        }
        break;
      case 'vtt:scene:previewImage':
        previewSceneImage(data.sceneId, data.imageId, data.updates);
        break;
      default:
        break;
    }
  }, [sessionId, setVttOpen, setVttState, moveToken, setIncomingRoll, previewSceneImage]);

  const handleIncomingMessage = useCallback((data) => {
    if (!data || typeof data !== 'object') return;
    if (data.type?.startsWith('vtt:')) {
      handleVttMessage(data);
    }
  }, [handleVttMessage]);

  const sendEvent = useCallback((type, payload) => {
    return sharedWsManager.send(type, { sessionId, ...payload });
  }, [sessionId]);

  const joinVtt = useCallback(() => {
    if (!sessionId) return;
    sendEvent('vtt:join', {});
  }, [sessionId, sendEvent]);

  const leaveVtt = useCallback(() => {
    if (!sessionId) return;
    sendEvent('vtt:leave', {});
  }, [sessionId, sendEvent]);

  const handlersRef = useRef({ handleIncomingMessage, joinVtt, leaveVtt });
  useEffect(() => {
    handlersRef.current = { handleIncomingMessage, joinVtt, leaveVtt };
  });

  useEffect(() => {
    if (!enabled || !sessionId) return undefined;

    const unsubMsg = sharedWsManager.subscribeMessage((data) => {
      handlersRef.current.handleIncomingMessage(data);
    });
    
    const unsubConn = sharedWsManager.subscribeConnection((state) => {
      if (state === 'connected') {
        handlersRef.current.joinVtt();
      }
    });

    sharedWsManager.addRef();

    return () => {
      unsubMsg();
      unsubConn();
      handlersRef.current.leaveVtt();
      sharedWsManager.removeRef();
    };
  }, [sessionId, enabled]);

  return {
    sendVttOpen: () => sendEvent('vtt:open', {}),
    sendVttGetState: () => sendEvent('vtt:getState', {}),
    sendVttTokenDrag: (tokenId, x, y) => sendEvent('vtt:token_drag', { tokenId, x, y }),
    sendVttTokenDrop: (tokenId, x, y) => sendEvent('vtt:token_drop', { tokenId, x, y }),
    sendVttDiceRoll: (formula, name, strength, visibility) => sendEvent('vtt:dice:roll', { formula, name, strength, visibility }),
    sendVttSetBackground: (backgroundUrl, mapWidth, mapHeight) => sendEvent('vtt:set_background', { backgroundUrl, mapWidth, mapHeight }),
    sendVttSceneCreate: (data) => sendEvent('vtt:scene:create', data),
    sendVttSceneUpdate: (sceneId, updates) => sendEvent('vtt:scene:update', { sceneId, updates }),
    sendVttSceneDelete: (sceneId) => sendEvent('vtt:scene:delete', { sceneId }),
    sendVttSceneActivate: (sceneId) => sendEvent('vtt:scene:activate', { sceneId }),
    sendVttLayerCreate: (sceneId, name, layerType) => sendEvent('vtt:layer:create', { sceneId, name, layerType }),
    sendVttLayerUpdate: (sceneId, layerId, updates) => sendEvent('vtt:layer:update', { sceneId, layerId, updates }),
    sendVttLayerReorder: (sceneId, layerIds) => sendEvent('vtt:layer:reorder', { sceneId, layerIds }),
    sendVttLayerDelete: (sceneId, layerId) => sendEvent('vtt:layer:delete', { sceneId, layerId }),
    sendVttSceneAddImage: (sceneId, imageUrl, imageWidth, imageHeight) => sendEvent('vtt:scene:addImage', { sceneId, imageUrl, imageWidth, imageHeight }),
    sendVttSceneUpdateImage: (sceneId, imageId, updates) => sendEvent('vtt:scene:updateImage', { sceneId, imageId, updates }),
    sendVttScenePreviewImage: (sceneId, imageId, updates) => sendEvent('vtt:scene:previewImage', { sceneId, imageId, updates }),
    sendVttSceneRemoveImage: (sceneId, imageId) => sendEvent('vtt:scene:removeImage', { sceneId, imageId }),
  };
}
