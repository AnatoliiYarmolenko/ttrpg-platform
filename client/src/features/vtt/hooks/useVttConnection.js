import { useEffect, useCallback, useRef } from 'react';
import useVttStore from '@/stores/useVttStore';
import useBattlefieldStore from '../components/battlefield/useBattlefieldStore';
import useInitiativeStore from '@/stores/useInitiativeStore';
import useCharacterStore from '@/stores/useCharacterStore';
import useGmCreaturesStore from '@/stores/useGmCreaturesStore';
import { sharedWsManager } from '@/lib/shared-ws';

export default function useVttConnection(sessionId, options = {}) {
  const { enabled = true } = options;

  const setVttState = useBattlefieldStore((s) => s.setVttState);
  // Note: previewSceneItem is accessed dynamically via useBattlefieldStore.getState()
  const moveToken = useBattlefieldStore((s) => s.moveToken);
  
  const setVttOpen = useVttStore((s) => s.setVttOpen);
  const setIncomingRoll = useVttStore((s) => s.setIncomingRoll);

  const handleVttMessage = useCallback((data) => { // nosonar
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
        moveToken(data.sceneId, data.tokenId, data.x, data.y);
        break;
      case 'vtt:set_background':
        setVttState({ backgroundUrl: data.backgroundUrl, mapWidth: data.mapWidth, mapHeight: data.mapHeight });
        break;
      case 'vtt:dice:result':
        if (data.roll) {
          setIncomingRoll(data.roll);
          if (data.roll.name === 'Ініціатива') {
            useInitiativeStore.getState().addRoll(data.roll);
          }
        }
        break;
      case 'vtt:scene:previewImage':
        // Оновлюємо тимчасовий стан зображення для плавного перетягування іншими гравцями
        useBattlefieldStore.getState().previewSceneItem(data.sceneId, data.imageId, data.updates);
        break;
      case 'vtt:scene:drawPreview':
        if (data.userId) {
          if (data.previewData) {
            // Якщо це існуючий малюнок (має id) - плавно рухаємо його
            if (data.previewData.id) {
              useBattlefieldStore.getState().previewSceneItem(data.sceneId, data.previewData.id, data.previewData);
            } else {
              // Якщо це новий малюнок у процесі малювання - показуємо привид
              useBattlefieldStore.getState().setDrawPreview(data.userId, { ...data.previewData, sceneId: data.sceneId });
            }
          } else {
            useBattlefieldStore.getState().removeDrawPreview(data.userId);
          }
        }
        break;
      case 'vtt:scene:clearAllPreviews':
        useBattlefieldStore.getState().clearAllPreviews();
        break;
      case 'vtt:scene:rulerPreview':
        if (data.userId && data.rulerData) {
          console.log('[VTT] Отримано rulerPreview від', data.userId, data.rulerData);
          useBattlefieldStore.getState().setRemoteRuler(data.userId, data.rulerData);
        }
        break;
      case 'vtt:scene:clearRuler':
        if (data.userId) {
          useBattlefieldStore.getState().setRemoteRuler(data.userId, null);
        }
        break;
      case 'vtt:initiative:updated':
        if (data.initiative) {
          useInitiativeStore.getState().setInitiative(data.initiative);
        }
        break;
      case 'vtt:closed':
        // GM закрив VTT — оновлюємо стан відкритості
        setVttOpen(sessionId, false);
        break;
      default:
        break;
    }
  }, [sessionId, setVttOpen, setVttState, moveToken, setIncomingRoll]);

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

    // Завантажуємо дані з сервера після підключення/реконнекту (async, не блокує)
    useCharacterStore.getState().loadFromServer(sessionId).catch(() => {});
    useGmCreaturesStore.getState().loadFromServer(sessionId).catch(() => {});
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
    sendVttClose: () => sendEvent('vtt:close', {}),
    sendVttGetState: () => sendEvent('vtt:getState', {}),
    sendVttTokenAdd: (sceneId, tokenData) => sendEvent('vtt:token_add', { sceneId, tokenData }),
    sendVttTokenUpdate: (sceneId, tokenId, updates) => sendEvent('vtt:token_update', { sceneId, tokenId, updates }),
    sendVttTokenRemove: (sceneId, tokenId) => sendEvent('vtt:token_remove', { sceneId, tokenId }),
    sendVttTokenDrag: (sceneId, tokenId, x, y) => sendEvent('vtt:token_drag', { sceneId, tokenId, x, y }),
    sendVttTokenDrop: (sceneId, tokenId, x, y) => sendEvent('vtt:token_drop', { sceneId, tokenId, x, y }),
    sendVttDiceRoll: (formula, name, strength, visibility, characterName) => sendEvent('vtt:dice:roll', { formula, name, strength, visibility, characterName }),
    sendVttSetBackground: (backgroundUrl, mapWidth, mapHeight) => sendEvent('vtt:set_background', { backgroundUrl, mapWidth, mapHeight }),
    sendVttSceneCreate: (data) => sendEvent('vtt:scene:create', data),
    sendVttSceneUpdate: (sceneId, updates) => sendEvent('vtt:scene:update', { sceneId, updates }),
    sendVttSceneDelete: (sceneId) => sendEvent('vtt:scene:delete', { sceneId }),
    sendVttSceneActivate: (sceneId) => sendEvent('vtt:scene:activate', { sceneId }),
    sendVttInitiativeUpdate: (initiative) => sendEvent('vtt:initiative:update', { initiative }),
    sendVttLayerCreate: (sceneId, name, layerType) => sendEvent('vtt:layer:create', { sceneId, name, layerType }),
    sendVttLayerUpdate: (sceneId, layerId, updates) => sendEvent('vtt:layer:update', { sceneId, layerId, updates }),
    sendVttLayerReorder: (sceneId, layerIds) => sendEvent('vtt:layer:reorder', { sceneId, layerIds }),
    sendVttLayerDelete: (sceneId, layerId) => sendEvent('vtt:layer:delete', { sceneId, layerId }),
    sendVttSceneAddImage: (sceneId, imageUrl, width, height) => sendEvent('vtt:scene:addImage', { sceneId, imageUrl, imageWidth: width, imageHeight: height }),
    sendVttSceneUpdateImage: (sceneId, imageId, updates) => sendEvent('vtt:scene:updateImage', { sceneId, imageId, updates }),
    sendVttScenePreviewImage: (sceneId, imageId, updates) => sendEvent('vtt:scene:previewImage', { sceneId, imageId, updates }),
    sendVttSceneRemoveImage: (sceneId, imageId) => sendEvent('vtt:scene:removeImage', { sceneId, imageId }),
    sendVttSceneDrawPreview: (sceneId, userId, previewData) => sendEvent('vtt:scene:drawPreview', { sceneId, userId, previewData }),
    sendVttSceneAddDrawing: (sceneId, drawingData) => sendEvent('vtt:scene:addDrawing', { sceneId, drawingData }),
    sendVttSceneUpdateDrawing: (sceneId, drawingId, updates) => sendEvent('vtt:scene:updateDrawing', { sceneId, drawingId, updates }),
    sendVttSceneRemoveDrawing: (sceneId, drawingId) => sendEvent('vtt:scene:removeDrawing', { sceneId, drawingId }),
    sendVttSceneUndoDrawing: (sceneId, userId) => sendEvent('vtt:scene:undoDrawing', { sceneId, userId }),
    sendVttSceneClearDrawings: (sceneId) => sendEvent('vtt:scene:clearDrawings', { sceneId }),
    sendVttSceneRulerPreview: (sceneId, userId, rulerData) => sendEvent('vtt:scene:rulerPreview', { sceneId, userId, rulerData }),
    sendVttSceneClearRuler: (sceneId, userId) => sendEvent('vtt:scene:clearRuler', { sceneId, userId }),
  };
}
