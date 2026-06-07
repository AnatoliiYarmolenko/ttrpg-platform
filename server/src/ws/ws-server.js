const { WebSocketServer } = require('ws');
const { STATUS_CODES } = require('node:http');
const { authenticateWsRequest, ensureAllowedOrigin } = require('./ws-auth.middleware');
const { ERROR_CODES } = require('../constants/errors');

const DEFAULT_WS_PATH = '/ws/chat';

const activeWssInstances = new Set();

function resolveWsPath(request) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    return url.pathname;
  } catch {
    return request.url;
  }
}

function writeUpgradeError(socket, err) {
  const status = err?.status || 401;
  const code = err?.code || ERROR_CODES.SERVER_ERROR;
  const message = err?.message || 'WebSocket handshake rejected';
  const statusText = STATUS_CODES[status] || 'Unauthorized';
  const payload = JSON.stringify({ code, error: message });

  socket.write(
    `HTTP/1.1 ${status} ${statusText}\r\n`
    + 'Content-Type: application/json\r\n'
    + 'Connection: close\r\n'
    + `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n`
    + payload
  );
  socket.destroy();
}

function createWsServer({ server, path = DEFAULT_WS_PATH, logger, onConnection } = {}) {
  if (!server) {
    throw new Error('HTTP server instance is required to start WebSocket server');
  }

  const wsPath = path || DEFAULT_WS_PATH;
  const wss = new WebSocketServer({ noServer: true });
  activeWssInstances.add(wss);

  const handleUpgrade = async (request, socket, head) => {
    if (resolveWsPath(request) !== wsPath) {
      return;
    }

    try {
      ensureAllowedOrigin(request);
      const user = await authenticateWsRequest(request);

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.user = user;
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      logger?.warn({ err }, 'WS handshake rejected');
      writeUpgradeError(socket, err);
    }
  };

  server.on('upgrade', handleUpgrade);

  wss.on('connection', (socket, request) => {
    logger?.info({ url: request.url, path: wsPath }, 'WS client connected');

    if (typeof onConnection === 'function') {
      onConnection(socket, request);
    }

    socket.on('close', (code, reason) => {
      logger?.info({ code, reason: reason?.toString(), path: wsPath }, 'WS client disconnected');
    });
  });

  const close = () => new Promise((resolve) => {
    for (const client of wss.clients) {
      client.terminate();
    }

    wss.close(() => {
      activeWssInstances.delete(wss);
      server.off('upgrade', handleUpgrade);
      logger?.info({ path: wsPath }, 'WS server closed');
      resolve();
    });
  });

  return {
    wss,
    path: wsPath,
    close,
  };
}

function disconnectUser(userId) {
  const userIdNumber = Number.parseInt(userId, 10);
  for (const wss of activeWssInstances) {
    for (const client of wss.clients) {
      if (client.user?.id === userIdNumber) {
        try {
          client.send(JSON.stringify({ type: 'auth:expired', message: 'Ваш акаунт було заблоковано' }));
        } catch {}
        client.terminate();
      }
    }
  }
}

module.exports = {
  createWsServer,
  disconnectUser,
};
