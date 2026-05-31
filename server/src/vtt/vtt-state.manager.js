const { logger } = require('../lib/logger');

/**
 * VttStateManager — in-memory менеджер стану "Ігрового столу" (VTT).
 *
 * Простий singleton Map: sessionId -> { isOpen, openedAt, openedBy }
 *
 * Стан VTT зберігається в пам'яті (не в БД) — аналогічно до callState.
 * VTT залишається відкритим до тих пір, поки сесія не завершиться або не скасується.
 */
class VttStateManager {
  constructor() {
    // Map<string sessionId, VttRoomState>
    this.rooms = new Map();
  }

  /**
   * Відкрити VTT для сесії (викликається GM).
   * @param {string|number} sessionId
   * @param {string|number} openedBy — userId GM
   */
  openVtt(sessionId, openedBy) {
    sessionId = String(sessionId);
    this.rooms.set(sessionId, {
      isOpen: true,
      openedAt: new Date(),
      openedBy: openedBy ? String(openedBy) : null,
    });
    logger.info({ sessionId, openedBy }, 'VTT opened');
  }

  /**
   * Закрити/скинути стан VTT для сесії.
   * Викликається при завершенні або скасуванні сесії.
   * @param {string|number} sessionId
   */
  closeVtt(sessionId) {
    sessionId = String(sessionId);
    if (this.rooms.has(sessionId)) {
      this.rooms.delete(sessionId);
      logger.info({ sessionId }, 'VTT closed/reset');
    }
  }

  /**
   * Перевірити чи VTT відкрито для сесії.
   * @param {string|number} sessionId
   * @returns {boolean}
   */
  isVttOpen(sessionId) {
    sessionId = String(sessionId);
    return Boolean(this.rooms.get(sessionId)?.isOpen);
  }

  /**
   * Отримати повний стан VTT для сесії.
   * @param {string|number} sessionId
   * @returns {{ isOpen: boolean, openedAt: Date|null, openedBy: string|null }}
   */
  getVttState(sessionId) {
    sessionId = String(sessionId);
    const room = this.rooms.get(sessionId);
    if (!room) {
      return { isOpen: false, openedAt: null, openedBy: null };
    }
    return { ...room };
  }
}

// Singleton екземпляр
const vttStateManager = new VttStateManager();

module.exports = {
  vttStateManager,
  VttStateManager,
};
