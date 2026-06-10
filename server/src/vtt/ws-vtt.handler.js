const { AppError, ERROR_CODES } = require('../constants/errors');
const { vttStateManager } = require('./vtt-state.manager');
const sessionService = require('../services/session.service');
const { rollDice } = require('./dice-engine');
const { sendEvent } = require('../ws/ws-utils');

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

  vttStateManager.openVtt(sessionId, userId);

  sendEvent(socket, 'vtt:opened', { sessionId, isOpen: true });

  roomManager.broadcastExcept(getVttRoom(sessionId), {
    type: 'vtt:opened',
    sessionId,
    isOpen: true,
  }, socket);
}

async function handleVttTokenMove(socket, payload, roomManager, eventType) {
  const sessionId = parseSessionId(payload.sessionId);
  const { tokenId, x, y } = payload;
  
  if (!tokenId) return;

  roomManager.broadcastExcept(getVttRoom(sessionId), {
    type: eventType,
    sessionId,
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

async function handleVttDiceRoll(socket, payload, roomManager) {
  const sessionId = parseSessionId(payload.sessionId);
  const { formula, name, strength, visibility } = payload;
  const player = socket.user?.username || 'Гравець';
  const initiatorId = socket.user?.id ? String(socket.user.id) : null;
  
  const rollResult = { 
    ...rollDice(formula, player), 
    name, 
    strength: strength || 1,
    visibility: visibility || 'PUBLIC',
    initiatorId
  };
  const entry = vttStateManager.addDiceRoll(sessionId, rollResult);

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
    case 'vtt:token_drag':
    case 'vtt:token_drop':
      await handleVttTokenMove(socket, payload, roomManager, type);
      break;
    case 'vtt:set_background':
      await handleVttSetBackground(socket, payload, roomManager);
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
      await handleVttStateChange(socket, payload, roomManager, type);
      break;
    case 'vtt:scene:previewImage':
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
