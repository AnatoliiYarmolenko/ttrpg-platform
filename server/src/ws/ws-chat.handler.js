const { AppError, ERROR_CODES } = require('../constants/errors');
const chatService = require('../services/chat.service');
const { checkRateLimit } = require('../services/rate-limit.service');
const { vttStateManager } = require('../vtt/vtt-state.manager');
const sessionService = require('../services/session.service');
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
