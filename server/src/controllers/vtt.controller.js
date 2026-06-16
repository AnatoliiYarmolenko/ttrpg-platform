'use strict';

const vttCharacterService = require('../services/vtt-character.service');
const vttCreaturesService = require('../services/vtt-creatures.service');
const vttSceneService = require('../services/vtt-scene.service');

/**
 * Парсує sessionId з req.params.id та перевіряє що це цілое додатнє число.
 */
function parseSessionId(req) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('sessionId повинен бути позитивним числом');
    err.status = 400;
    throw err;
  }
  return id;
}

const vttController = {

  // ─── Character Sheet ────────────────────────────────────────────────────────

  /**
   * GET /sessions/:id/vtt/character
   * Отримати аркуш персонажа поточного гравця.
   */
  async getCharacterSheet(req, res, next) {
    try {
      const sessionId = parseSessionId(req);
      const userId = req.user.id;

      const sheet = await vttCharacterService.getCharacterSheet(sessionId, userId);

      res.json({
        success: true,
        data: sheet, // null якщо аркуша ще немає
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /sessions/:id/vtt/character
   * Зберегти (upsert) аркуш персонажа. Тіло — об'єкт з useCharacterStore.
   */
  async upsertCharacterSheet(req, res, next) {
    try {
      const sessionId = parseSessionId(req);
      const userId = req.user.id;

      const sheet = await vttCharacterService.upsertCharacterSheet(sessionId, userId, req.body);

      res.json({
        success: true,
        message: 'Персонаж збережений',
        data: sheet,
      });
    } catch (error) {
      next(error);
    }
  },

  // ─── GM Creatures ───────────────────────────────────────────────────────────

  /**
   * GET /sessions/:id/vtt/creatures
   * Отримати список GM-істот для сесії.
   */
  async getCreatures(req, res, next) {
    try {
      const sessionId = parseSessionId(req);
      const gmUserId = req.user.id;

      const creatures = await vttCreaturesService.getCreatures(sessionId, gmUserId);

      res.json({
        success: true,
        data: creatures,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /sessions/:id/vtt/creatures
   * Додати нову GM-істоту. Body: { type: 'MONSTER' | 'HUMAN' }
   */
  async addCreature(req, res, next) {
    try {
      const sessionId = parseSessionId(req);
      const gmUserId = req.user.id;
      const { type } = req.body;

      const creature = await vttCreaturesService.addCreature(sessionId, gmUserId, type);

      res.status(201).json({
        success: true,
        message: 'Істота додана',
        data: creature,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /sessions/:id/vtt/creatures/:creatureId
   * Оновити дані GM-істоти.
   */
  async updateCreature(req, res, next) {
    try {
      const sessionId = parseSessionId(req);
      const gmUserId = req.user.id;
      const creatureId = Number.parseInt(req.params.creatureId, 10);

      if (!Number.isInteger(creatureId) || creatureId <= 0) {
        return res.status(400).json({ success: false, message: 'Невалідний creatureId' });
      }

      const creature = await vttCreaturesService.updateCreature(creatureId, sessionId, gmUserId, req.body);

      res.json({
        success: true,
        message: 'Істота оновлена',
        data: creature,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /sessions/:id/vtt/creatures/:creatureId
   * Видалити GM-істоту.
   */
  async removeCreature(req, res, next) {
    try {
      const sessionId = parseSessionId(req);
      const gmUserId = req.user.id;
      const creatureId = Number.parseInt(req.params.creatureId, 10);

      if (!Number.isInteger(creatureId) || creatureId <= 0) {
        return res.status(400).json({ success: false, message: 'Невалідний creatureId' });
      }

      await vttCreaturesService.removeCreature(creatureId, sessionId, gmUserId);

      res.json({
        success: true,
        message: 'Істота видалена',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /sessions/:id/vtt/creatures/sync
   * Bulk-синхронізація: замінює весь список GM-істот (localStorage → БД).
   * Body: { creatures: [...] }  — масив з useGmCreaturesStore
   */
  async syncCreatures(req, res, next) {
    try {
      const sessionId = parseSessionId(req);
      const gmUserId = req.user.id;
      const { creatures } = req.body;

      const result = await vttCreaturesService.syncCreatures(sessionId, gmUserId, creatures);

      res.json({
        success: true,
        message: `Синхронізовано ${result.length} істот`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // ─── Dice Log ────────────────────────────────────────────────────────────────

  /**
   * GET /sessions/:id/vtt/dice-log
   * Отримати історію кидків кубиків сесії з БД.
   * Query: ?limit=50
   */
  async getDiceLog(req, res, next) {
    try {
      const sessionId = parseSessionId(req);
      const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 200);

      const log = await vttSceneService.getDiceLog(sessionId, limit);

      res.json({
        success: true,
        data: log,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = vttController;
