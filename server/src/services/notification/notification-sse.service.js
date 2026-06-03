const { logger } = require('../../lib/logger');

class NotificationSSEService {
  constructor() {
    this.connections = new Map();
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  /**
   * Зареєструвати нове SSE з'єднання для користувача
   * @param {number} userId - ID користувача
   * @param {Object} res - Об'єкт відповіді Express із заголовками SSE
   */
  registerConnection(userId, res) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    const userConnections = this.connections.get(userId);
    userConnections.add(res);

    res.on('close', () => {
      this.removeConnection(userId, res);
    });

    res.on('error', () => {
      this.removeConnection(userId, res);
    });

    this.sendToConnection(res, {
      type: 'connected',
      timestamp: new Date().toISOString(),
    });

    logger.info({ userId, totalConnections: this.getTotalConnections() }, '[SSE] Користувач підключився');
  }

  /**
   * Видалити SSE з'єднання для користувача
   * @param {number} userId - ID користувача
   * @param {Object} res - Об'єкт відповіді Express
   */
  removeConnection(userId, res) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(res);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
    logger.info({ userId, totalConnections: this.getTotalConnections() }, '[SSE] Користувач відключився');
  }

  /**
   * Надіслати сповіщення конкретному користувачу
   * @param {number} userId - ID користувача
   * @param {Object} payload - Дані сповіщення (payload)
   */
  pushToUser(userId, payload) {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      return false;
    }

    const message = {
      type: 'notification',
      data: payload,
      timestamp: new Date().toISOString(),
    };

    let sentCount = 0;
    userConnections.forEach((res) => {
      try {
        this.sendToConnection(res, message);
        sentCount++;
      } catch (error) {
        logger.error({ err: error, userId }, '[SSE] Помилка при відправці повідомлення користувачу');
        this.removeConnection(userId, res);
      }
    });

    return sentCount > 0;
  }

  /**
   * Надіслати сповіщення декільком користувачам
   * @param {number[]} userIds - Масив ID користувачів
   * @param {Object} payload - Дані сповіщення (payload)
   */
  pushToUsers(userIds, payload) {
    let totalSent = 0;
    userIds.forEach((userId) => {
      if (this.pushToUser(userId, payload)) {
        totalSent++;
      }
    });
    return totalSent;
  }

  /**
   * Надіслати повідомлення до конкретного з'єднання
   * @param {Object} res - Об'єкт відповіді Express
   * @param {Object} data - Дані для відправки
   */
  sendToConnection(res, data) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // 30 секунд

    if (typeof this.heartbeatInterval.unref === 'function') {
      this.heartbeatInterval.unref();
    }

    logger.info('[SSE] Запущено heartbeat для підтримки активних з\'єднань');
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  sendHeartbeat() {
    const heartbeat = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    };

    this.connections.forEach((userConnections, userId) => {
      userConnections.forEach((res) => {
        try {
          this.sendToConnection(res, heartbeat);
        } catch (error) {
          logger.error({ err: error, userId }, '[SSE] Помилка при відправці heartbeat користувачу');
          this.removeConnection(userId, res);
        }
      });
    });
  }

  getTotalConnections() {
    let total = 0;
    this.connections.forEach((userConnections) => {
      total += userConnections.size;
    });
    return total;
  }

  getConnectedUsersCount() {
    return this.connections.size;
  }

  /**
   * Закрити всі з'єднання та зупинити heartbeat (для graceful shutdown)
   */
  shutdown() {
    this.stopHeartbeat();
    this.connections.forEach((userConnections, userId) => {
      userConnections.forEach((res) => {
        try {
          this.sendToConnection(res, { type: 'shutdown', timestamp: new Date().toISOString() });
          res.end();
        } catch (e) {
          logger.warn({ err: e, userId }, '[SSE] Помилка при закритті з\'єднання під час завершення роботи');
        }
      });
    });
    this.connections.clear();
    logger.info('[SSE] Завершення роботи завершено, всі з\'єднання закрито');
  }

  /**
   * Перевірити, чи є у користувача активні з'єднання
   * @param {number} userId - ID користувача
   */
  isUserConnected(userId) {
    const userConnections = this.connections.get(userId);
    return userConnections && userConnections.size > 0;
  }
}

module.exports = new NotificationSSEService();
