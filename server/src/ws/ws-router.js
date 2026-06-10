const { AppError, ERROR_CODES } = require('../constants/errors');
const { parseIncomingMessage, sendEvent, resolveErrorCode, resolveErrorMessage } = require('./ws-utils');
const { chatHandler } = require('./ws-chat.handler');
const { vttHandler } = require('../vtt/ws-vtt.handler');

function createMainWsHandler({ roomManager, logger }) {
  if (!roomManager) {
    throw new Error('Room manager is required for main ws handler');
  }

  return (socket) => {
    socket.on('message', async (raw) => {
      let type;
      let payload;

      try {
        ({ type, payload } = parseIncomingMessage(raw));
        logger?.info({ type, payload }, '[WS RAW MSG IN]');
      } catch (error) {
        const code = resolveErrorCode(error);
        const message = resolveErrorMessage(error);
        sendEvent(socket, 'chat:error', { code, message });
        return;
      }

      try {
        if (type.startsWith('chat:')) {
          await chatHandler(socket, type, payload, roomManager);
        } else if (type.startsWith('vtt:')) {
          await vttHandler(socket, type, payload, roomManager);
        } else {
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
          logger?.error({ err: error }, 'WS handler error');
        }
      }
    });

    socket.on('close', () => {
      roomManager.leaveAll(socket);
    });
  };
}

module.exports = {
  createMainWsHandler,
};
