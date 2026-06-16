const { AppError, ERROR_CODES } = require('../constants/errors');
const { vttStateManager } = require('../vtt/vtt-state.manager');
const sessionService = require('../services/session.service');
const { rollDice } = require('../vtt/dice-engine');
const { sendEvent } = require('./ws-utils');
const vttSceneService = require('../services/vtt-scene.service');
const { logger } = require('../lib/logger');

// Трекуємо auto-save інтервали по sessionId (Map<string, NodeJS.Timeout>)
const autoSaveIntervals = new Map();
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 хв

function parseSessionId(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'sessionId повинен бути позитивним числом');
  }
  return parsed;
}

function getVttRoom(sessionId) {
  return `vtt:${sessionId}`;
}

function getFilteredState(vttState, userId) {
  if (!vttState.diceLog) return vttState;

  const gmId = vttState.openedBy ? String(vttState.openedBy) : null;
  const uid = userId ? String(userId) : null;

  const filteredDiceLog = vttState.diceLog.filter((roll) => {
    if (roll.visibility === 'GM_ONLY') {
      return uid === gmId || uid === String(roll.initiatorId);
    }
    return true;
  });

  return { ...vttState, diceLog: filteredDiceLog };
}

async function handleVttJoin(socket, payload, roomManager) {
  const sessionId = parseSessionId(payload.sessionId);
  
  // Приєднуємо сокет до кімнати VTT
  roomManager.joinRoom(getVttRoom(sessionId), socket);
  
  // Одразу відправляємо поточний стан карти гравцю, який щойно приєднався
  const vttState = vttStateManager.getVttState(sessionId);
  sendEvent(socket, 'vtt:state', { sessionId, ...getFilteredState(vttState, socket.user?.id) });
}

async function handleVttLeave(socket, payload, roomManager) {
  const sessionId = parseSessionId(payload.sessionId);
  roomManager.leaveRoom(getVttRoom(sessionId), socket);
}

async function handleVttGetState(socket, payload) {
  const sessionId = parseSessionId(payload.sessionId);
  const vttState = vttStateManager.getVttState(sessionId);
  sendEvent(socket, 'vtt:state', { sessionId, ...getFilteredState(vttState, socket.user?.id) });
}

async function handleVttOpen(socket, payload, roomManager) {
  const sessionId = parseSessionId(payload.sessionId);
  const userId = socket.user?.id;

  if (!userId) {
    throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Необхідна авторизація');
  }

  const sessionPage = await sessionService.getSessionPageById(sessionId, userId);
  if (!sessionPage.actions.canOpenVtt) {
    throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Тільки GM може відкрити Ігровий стіл');
  }

  // Гідруємо in-memory з БД якщо сцен ще немає
  const currentState = vttStateManager.getVttState(sessionId);
  const hasScenes = Object.keys(currentState.scenes || {}).length > 0;

  if (!hasScenes) {
    try {
      const campaignId = sessionPage.campaignId || null;
      const dbState = await vttSceneService.loadVttState(sessionId, campaignId);

      if (Object.keys(dbState.scenes).length > 0) {
        // Завантажуємо сцени з БД в in-memory
        const room = vttStateManager._ensureRoom(sessionId);
        room.scenes = dbState.scenes;
        room.activeSceneId = dbState.activeSceneId;
        room.initiative = dbState.initiative;
        logger.info({ sessionId, sceneCount: Object.keys(dbState.scenes).length }, '[VTT] Hydrated from DB');
      }
    } catch (err) {
      logger.error({ err, sessionId }, '[VTT] Failed to load state from DB, starting fresh');
    }
  }

  vttStateManager.openVtt(sessionId, userId);

  // Запускаємо auto-save інтервал якщо ще не запущений
  startAutoSave(sessionId, sessionPage.campaignId || null);

  sendEvent(socket, 'vtt:opened', { sessionId, isOpen: true });
  
  // Надсилаємо повний стан (включно зі сценами, щойно завантаженими з БД) майстру
  sendEvent(socket, 'vtt:state', { sessionId, ...getFilteredState(vttStateManager.getVttState(sessionId), userId) });

  roomManager.broadcastExcept(getVttRoom(sessionId), {
    type: 'vtt:opened',
    sessionId,
    isOpen: true,
  }, socket);
}

async function handleVttTokenMove(socket, payload, roomManager, eventType) {
  const sessionId = parseSessionId(payload.sessionId);
  const { sceneId, tokenId, x, y } = payload;
  
  if (!tokenId) return;

  if (sceneId && eventType === 'vtt:token_drop') {
    vttStateManager.updateToken(sessionId, sceneId, tokenId, { x, y });
  }

  roomManager.broadcastExcept(getVttRoom(sessionId), {
    type: eventType,
    sessionId,
    sceneId,
    tokenId,
    x,
    y,
  }, socket);
}

async function handleVttSetBackground(socket, payload, roomManager) {
  const sessionId = parseSessionId(payload.sessionId);
  const { backgroundUrl, mapWidth, mapHeight } = payload;

  vttStateManager.setBackground(sessionId, backgroundUrl, mapWidth, mapHeight);
  
  roomManager.broadcastExcept(getVttRoom(sessionId), {
    type: 'vtt:set_background',
    sessionId,
    backgroundUrl,
    mapWidth,
    mapHeight,
  }, socket);
}

async function handleVttInitiativeUpdate(socket, payload, roomManager) {
  const sessionId = parseSessionId(payload.sessionId);
  const updatedInitiative = vttStateManager.setInitiative(sessionId, payload.initiative);
  
  roomManager.broadcast(getVttRoom(sessionId), {
    type: 'vtt:initiative:updated',
    sessionId,
    initiative: updatedInitiative
  });
}

async function handleVttDiceRoll(socket, payload, roomManager) {
  const sessionId = parseSessionId(payload.sessionId);
  const { formula, name, strength, visibility, characterName } = payload;
  const player = characterName || socket.user?.username || 'Гравець';
  const initiatorId = socket.user?.id ? String(socket.user.id) : null;
  
  const rollResult = { 
    ...rollDice(formula, player), 
    name, 
    strength: strength || 1,
    visibility: visibility || 'PUBLIC',
    initiatorId
  };
  const entry = vttStateManager.addDiceRoll(sessionId, rollResult);

  // Асинхронне збереження в БД (не блокує WS)
  vttSceneService.saveDiceRoll(
    sessionId,
    entry,
    socket.user?.id ? Number(socket.user.id) : null
  ).catch((err) => logger.error({ err, sessionId }, '[VTT] dice roll DB save failed'));

  if (entry.visibility === 'GM_ONLY') {
    const vttState = vttStateManager.getVttState(sessionId);
    const gmId = vttState.openedBy ? String(vttState.openedBy) : null;
    roomManager.broadcastFilter(getVttRoom(sessionId), {
      type: 'vtt:dice:result',
      sessionId,
      roll: entry
    }, (clientSocket) => {
      const clientId = clientSocket.user?.id ? String(clientSocket.user.id) : null;
      return clientId === gmId || clientId === initiatorId;
    });
  } else {
    roomManager.broadcast(getVttRoom(sessionId), {
      type: 'vtt:dice:result',
      sessionId,
      roll: entry
    });
  }
}

// ─── Auto-Save Helpers ───────────────────────────────────────────────────────────────

/**
 * Запускає автозбереження кожні 5 хв.
 * @param {number} sessionId
 * @param {number|null} campaignId
 */
function startAutoSave(sessionId, campaignId) {
  const key = String(sessionId);
  if (autoSaveIntervals.has(key)) return; // вже запущений

  const interval = setInterval(async () => {
    try {
      const state = vttStateManager.getVttState(sessionId);
      if (state.isOpen) {
        await vttSceneService.saveVttState(sessionId, campaignId, state);
      }
    } catch (err) {
      logger.error({ err, sessionId }, '[VTT] Auto-save failed');
    }
  }, AUTO_SAVE_INTERVAL_MS);

  autoSaveIntervals.set(key, interval);
  logger.info({ sessionId }, '[VTT] Auto-save started (5 min)');
}

/**
 * Зупиняє автозбереження і зберігає стан в БД.
 * @param {number} sessionId
 * @param {number|null} campaignId
 */
async function stopAutoSave(sessionId, campaignId) {
  const key = String(sessionId);
  const interval = autoSaveIntervals.get(key);
  if (interval) {
    clearInterval(interval);
    autoSaveIntervals.delete(key);
  }

  try {
    const state = vttStateManager.getVttState(sessionId);
    await vttSceneService.saveVttState(sessionId, campaignId, state);
    logger.info({ sessionId }, '[VTT] Final save on close ✓');
  } catch (err) {
    logger.error({ err, sessionId }, '[VTT] Final save failed');
  }
}

async function handleVttClose(socket, payload, roomManager) {
  const sessionId = parseSessionId(payload.sessionId);
  const userId = socket.user?.id;

  const sessionPage = await sessionService.getSessionPageById(sessionId, userId);
  if (!sessionPage.actions.canOpenVtt) {
    throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Тільки GM може закрити VTT');
  }

  vttStateManager.closeVtt(sessionId);
  await stopAutoSave(sessionId, sessionPage.campaignId || null);

  roomManager.broadcast(getVttRoom(sessionId), {
    type: 'vtt:closed',
    sessionId,
    isOpen: false,
  });
}

async function handleVttStateChange(socket, payload, roomManager, actionType) {
  const sessionId = parseSessionId(payload.sessionId);
  const { sceneId, layerId, updates, name, width, height, backgroundUrl, backgroundColor, gridEnabled, gridType, gridColor, gridSize, gridOpacity, gridScale, layerType, layerIds, imageUrl, imageId, imageWidth, imageHeight } = payload;

  switch (actionType) {
    case 'vtt:scene:create':
      vttStateManager.createScene(sessionId, { name, width, height, backgroundUrl, backgroundColor, gridEnabled, gridType, gridColor, gridSize, gridOpacity, gridScale });
      break;
    case 'vtt:scene:update':
      vttStateManager.updateScene(sessionId, sceneId, updates);
      break;
    case 'vtt:scene:delete':
      vttStateManager.deleteScene(sessionId, sceneId);
      break;
    case 'vtt:scene:activate':
      vttStateManager.activateScene(sessionId, sceneId);
      break;
    case 'vtt:layer:create':
      vttStateManager.createLayer(sessionId, sceneId, name, layerType);
      break;
    case 'vtt:layer:update':
      vttStateManager.updateLayer(sessionId, sceneId, layerId, updates);
      break;
    case 'vtt:layer:reorder':
      vttStateManager.reorderLayers(sessionId, sceneId, layerIds);
      break;
    case 'vtt:layer:delete':
      vttStateManager.deleteLayer(sessionId, sceneId, layerId);
      break;
    case 'vtt:scene:addImage':
      vttStateManager.addImageToScene(sessionId, sceneId, imageUrl, imageWidth, imageHeight);
      break;
    case 'vtt:scene:updateImage':
      vttStateManager.updateSceneImage(sessionId, sceneId, imageId, updates);
      break;
    case 'vtt:scene:removeImage':
      vttStateManager.removeSceneImage(sessionId, sceneId, imageId);
      break;
    case 'vtt:scene:addDrawing':
      vttStateManager.addDrawingToScene(sessionId, sceneId, payload.drawingData);
      break;
    case 'vtt:scene:updateDrawing':
      vttStateManager.updateDrawing(sessionId, sceneId, payload.drawingId, payload.updates);
      break;
    case 'vtt:scene:removeDrawing':
      vttStateManager.removeDrawingById(sessionId, sceneId, payload.drawingId);
      break;
    case 'vtt:scene:undoDrawing':
      vttStateManager.removeLastDrawing(sessionId, sceneId, payload.userId);
      break;
    case 'vtt:scene:clearDrawings':
      vttStateManager.clearDrawings(sessionId, sceneId);
      roomManager.broadcast(getVttRoom(sessionId), { type: 'vtt:scene:clearAllPreviews' });
      break;
    case 'vtt:token_add':
      vttStateManager.addToken(sessionId, sceneId, payload.tokenData);
      break;
    case 'vtt:token_update':
      vttStateManager.updateToken(sessionId, sceneId, payload.tokenId, payload.updates);
      break;
    case 'vtt:token_remove':
      vttStateManager.removeToken(sessionId, sceneId, payload.tokenId);
      break;
  }

  const vttState = vttStateManager.getVttState(sessionId);
  roomManager.broadcast(getVttRoom(sessionId), {
    type: 'vtt:state',
    sessionId,
    ...vttState
  });
}

const vttHandler = async (socket, type, payload, roomManager) => {
  switch (type) {
    case 'vtt:join':
      await handleVttJoin(socket, payload, roomManager);
      break;
    case 'vtt:leave':
      await handleVttLeave(socket, payload, roomManager);
      break;
    case 'vtt:getState':
      await handleVttGetState(socket, payload);
      break;
    case 'vtt:open':
      await handleVttOpen(socket, payload, roomManager);
      break;
    case 'vtt:close':
      await handleVttClose(socket, payload, roomManager);
      break;
    case 'vtt:token_drag':
    case 'vtt:token_drop':
      await handleVttTokenMove(socket, payload, roomManager, type);
      break;
    case 'vtt:set_background':
      await handleVttSetBackground(socket, payload, roomManager);
      break;
    case 'vtt:initiative:update':
      await handleVttInitiativeUpdate(socket, payload, roomManager);
      break;
    case 'vtt:dice:roll':
      await handleVttDiceRoll(socket, payload, roomManager);
      break;
    case 'vtt:scene:create':
    case 'vtt:scene:update':
    case 'vtt:scene:delete':
    case 'vtt:scene:activate':
    case 'vtt:layer:create':
    case 'vtt:layer:update':
    case 'vtt:layer:reorder':
    case 'vtt:layer:delete':
    case 'vtt:scene:addImage':
    case 'vtt:scene:updateImage':
    case 'vtt:scene:removeImage':
    case 'vtt:scene:addDrawing':
    case 'vtt:scene:updateDrawing':
    case 'vtt:scene:removeDrawing':
    case 'vtt:scene:undoDrawing':
    case 'vtt:scene:clearDrawings':
    case 'vtt:token_add':
    case 'vtt:token_update':
    case 'vtt:token_remove':
      await handleVttStateChange(socket, payload, roomManager, type);
      break;
    case 'vtt:scene:previewImage':
    case 'vtt:scene:drawPreview':
    case 'vtt:scene:rulerPreview':
    case 'vtt:scene:clearRuler':
      if (type === 'vtt:scene:rulerPreview') {
        console.log('[VTT SERVER] Broadcasting rulerPreview', payload.userId);
      }
      // Broadcast without saving
      roomManager.broadcastExcept(getVttRoom(parseSessionId(payload.sessionId)), { type, ...payload }, socket);
      break;
    default:
      sendEvent(socket, 'chat:error', {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Невідомий тип VTT повідомлення',
      });
  }
};

module.exports = {
  vttHandler,
};
