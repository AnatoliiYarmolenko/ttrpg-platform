const { AppError, ERROR_CODES } = require('../constants/errors');
const chatService = require('../services/chat.service');
const { checkRateLimit } = require('../services/rate-limit.service');

function parseIncomingMessage(raw) {
  let data = raw;

  if (Buffer.isBuffer(raw)) {
    data = raw.toString('utf8');
  }

  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Невірний формат повідомлення');
  }

  const type = data.type;
  if (!type || typeof type !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Не вказано тип повідомлення');
  }

  let payload = {};
  if (data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) {
    payload = { ...data.payload };
  } else {
    payload = { ...data };
    delete payload.type;
    delete payload.payload;
  }

  return { type, payload };
}

function sendEvent(socket, type, payload = {}) {
  const message = {
    type,
    ...payload,
  };

  socket.send(JSON.stringify(message));
}

function parseChatId(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'chatId повинен бути позитивним числом');
  }
  return parsed;
}

function resolveErrorCode(error) {
  if (error instanceof AppError) {
    return error.code;
  }

  return ERROR_CODES.SERVER_ERROR;
}

function resolveErrorMessage(error) {
  if (error instanceof AppError) {
    return error.message;
  }

  return 'Помилка сервера';
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
        if (type === 'chat:join') {
          const chatId = parseChatId(payload.chatId);
          const joinState = await chatService.getChatJoinState(chatId, socket.user?.id);

          roomManager.joinRoom(chatId, socket);
          sendEvent(socket, 'chat:joined', {
            chatId,
            readonly: joinState.readonly,
            capabilities: joinState.capabilities,
            snapshotCursor: joinState.snapshotCursor || null,
          });
          return;
        }

        if (type === 'chat:leave') {
          const chatId = parseChatId(payload.chatId);
          roomManager.leaveRoom(chatId, socket);
          return;
        }

        if (type === 'chat:message:send') {
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
          return;
        }

        sendEvent(socket, 'chat:error', {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Невідомий тип повідомлення',
          chatId: payload?.chatId || null,
        });
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
