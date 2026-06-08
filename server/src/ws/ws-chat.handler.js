const { AppError, ERROR_CODES } = require('../constants/errors');
const chatService = require('../services/chat.service');
const { checkRateLimit } = require('../services/rate-limit.service');
const { vttStateManager } = require('../vtt/vtt-state.manager');
const sessionService = require('../services/session.service');
const { rollDice } = require('../vtt/dice-engine');
const { parseIncomingMessage, sendEvent, resolveErrorCode, resolveErrorMessage } = require('./ws-utils');

function parseChatId(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'chatId повинен бути позитивним числом');
  }
  return parsed;
}

async function handleChatJoin(socket, payload, roomManager) {
  const chatId = parseChatId(payload.chatId);
  const joinState = await chatService.getChatJoinState(chatId, socket.user?.id);

  // Зберігаємо chatId→sessionId для VTT events
  if (!socket._chatSessionMap) socket._chatSessionMap = new Map();
  const chatRecord = await chatService.getChatById(chatId);
  if (chatRecord?.sessionId) {
    socket._chatSessionMap.set(chatId, chatRecord.sessionId);
  }

  roomManager.joinRoom(chatId, socket);
  sendEvent(socket, 'chat:joined', {
    chatId,
    readonly: joinState.readonly,
    capabilities: joinState.capabilities,
    snapshotCursor: joinState.snapshotCursor || null,
  });
}

async function handleChatLeave(socket, payload, roomManager) {
  const chatId = parseChatId(payload.chatId);
  roomManager.leaveRoom(chatId, socket);
}

async function handleChatMessageSend(socket, payload, roomManager) {
  const chatId = parseChatId(payload.chatId);

  const rateLimitKey = String(socket.user?.id || 'unknown_ws_client');
  await checkRateLimit('chat_send_message', rateLimitKey, {
    maxRequests: 20,
    windowMs: 10 * 1000,
    blockDurationMs: 10 * 1000,
  });

  const { clientMessageId, content } = payload;
  const message = await chatService.createUserMessage(chatId, socket.user?.id, content);

  sendEvent(socket, 'chat:message:new', {
    message,
    clientMessageId: clientMessageId || null,
  });

  roomManager.broadcastExcept(chatId, {
    type: 'chat:message:new',
    message,
  }, socket);
}

async function handleVttGetState(socket, payload) {
  const chatId = parseChatId(payload.chatId);
  const sessionId = socket._chatSessionMap?.get(chatId) || null;
  const vttState = sessionId ? vttStateManager.getVttState(sessionId) : { isOpen: false };
  sendEvent(socket, 'vtt:state', { chatId, sessionId, ...vttState });
}

async function handleVttOpen(socket, payload, roomManager) {
  const chatId = parseChatId(payload.chatId);
  const sessionId = socket._chatSessionMap?.get(chatId) || null;
  const userId = socket.user?.id;

  if (!sessionId) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Не вдалося визначити сесію для цього чату');
  }
  if (!userId) {
    throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Необхідна авторизація');
  }

  // Перевірка прав — тільки GM або власник сесії
  const sessionPage = await sessionService.getSessionPageById(sessionId, userId);
  if (!sessionPage.actions.canOpenVtt) {
    throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Тільки GM може відкрити Ігровий стіл');
  }

  vttStateManager.openVtt(sessionId, userId);

  // Підтвердження ініціатору
  sendEvent(socket, 'vtt:opened', { chatId, sessionId, isOpen: true });

  // Broadcast усім у кімнаті (крім відправника)
  roomManager.broadcastExcept(chatId, {
    type: 'vtt:opened',
    chatId,
    sessionId,
    isOpen: true,
  }, socket);
}

async function handleVttTokenMove(socket, payload, roomManager, eventType) {
  const chatId = parseChatId(payload.chatId);
  const { tokenId, x, y } = payload;
  
  if (!tokenId) return;

  // Просто пересилаємо координати всім іншим у кімнаті
  roomManager.broadcastExcept(chatId, {
    type: eventType,
    chatId,
    tokenId,
    x,
    y,
  }, socket);
}

async function handleVttSetBackground(socket, payload, roomManager) {
  const chatId = parseChatId(payload.chatId);
  const { backgroundUrl, mapWidth, mapHeight } = payload;

  // Зберігаємо стан карти, щоб нові гравці отримали її при підключенні
  const sessionId = socket._chatSessionMap?.get(chatId) || null;
  if (sessionId) {
    vttStateManager.setBackground(sessionId, backgroundUrl, mapWidth, mapHeight);
  }
  
  roomManager.broadcastExcept(chatId, {
    type: 'vtt:set_background',
    chatId,
    backgroundUrl,
    mapWidth,
    mapHeight,
  }, socket);
}

async function handleVttDiceRoll(socket, payload, roomManager) {
  const chatId = parseChatId(payload.chatId);
  const sessionId = socket._chatSessionMap?.get(chatId) || null;
  console.log('[WS] handleVttDiceRoll received:', { chatId, sessionId, payload });
  if (!sessionId) {
    console.error('[WS] Error: sessionId is missing for chatId:', chatId);
    return;
  }

  const { formula, name, strength } = payload;
  const player = socket.user?.username || 'Гравець';
  
  // Обчислюємо результати на сервері
  const rollResult = { ...rollDice(formula, player), name, strength: strength || 1 };
  
  // Зберігаємо в стані кімнати
  const entry = vttStateManager.addDiceRoll(sessionId, rollResult);

  // Broadcast ВСІМ (включаючи відправника), щоб усі побачили однаковий кидок
  roomManager.broadcast(chatId, {
    type: 'vtt:dice:result',
    chatId,
    sessionId,
    roll: entry
  });
}

async function handleVttStateChange(socket, payload, roomManager, actionType) {
  const chatId = parseChatId(payload.chatId);
  const sessionId = socket._chatSessionMap?.get(chatId) || null;
  if (!sessionId) return;

  const { sceneId, layerId, updates, name, width, height, backgroundUrl, backgroundColor, gridEnabled, gridType, gridColor, gridSize, gridOpacity, layerType, layerIds, imageUrl, imageId, imageWidth, imageHeight } = payload;

  switch (actionType) {
    case 'vtt:scene:create':
      vttStateManager.createScene(sessionId, { name, width, height, backgroundUrl, backgroundColor, gridEnabled, gridType, gridColor, gridSize, gridOpacity });
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

  // Broadcast the updated state to everyone in the room, including the sender
  const vttState = vttStateManager.getVttState(sessionId);
  roomManager.broadcast(chatId, {
    type: 'vtt:state',
    chatId,
    sessionId,
    ...vttState
  });
}

function createChatHandler({ roomManager, logger } = {}) {
  if (!roomManager) {
    throw new Error('Room manager is required for chat handler');
  }

  return (socket) => {
    socket.on('message', async (raw) => {
      let type;
      let payload;

      try {
        ({ type, payload } = parseIncomingMessage(raw));
        console.log('[WS RAW MSG IN]:', type, payload);
      } catch (error) {
        const code = resolveErrorCode(error);
        const message = resolveErrorMessage(error);
        sendEvent(socket, 'chat:error', { code, message });
        return;
      }

      try {
        switch (type) {
          case 'chat:join':
            await handleChatJoin(socket, payload, roomManager);
            break;
          case 'chat:leave':
            await handleChatLeave(socket, payload, roomManager);
            break;
          case 'chat:message:send':
            await handleChatMessageSend(socket, payload, roomManager);
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
            // Просто бродкастимо без збереження стану (для плавного drag/resize)
            roomManager.broadcastExcept(parseChatId(payload.chatId), { type, ...payload }, socket);
            break;
          default:
            sendEvent(socket, 'chat:error', {
              code: ERROR_CODES.VALIDATION_FAILED,
              message: 'Невідомий тип повідомлення',
              chatId: payload?.chatId || null,
            });
        }
      } catch (error) {
        const code = resolveErrorCode(error);
        const message = resolveErrorMessage(error);

        sendEvent(socket, 'chat:error', {
          chatId: payload?.chatId || null,
          code,
          message,
          clientMessageId: payload?.clientMessageId || null,
        });

        if (!(error instanceof AppError)) {
          logger?.error({ err: error }, 'WS chat handler error');
        }
      }
    });

    socket.on('close', () => {
      roomManager.leaveAll(socket);
    });
  };
}

module.exports = {
  createChatHandler,
};
