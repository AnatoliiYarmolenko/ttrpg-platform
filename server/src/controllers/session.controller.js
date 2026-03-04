const sessionService = require('../services/session.service');

/**
 * SessionController — контроллер для управління сесіями (грами)
 * 
 * Сесія = Конкретна зустріч з датою/часом
 * - Може бути частиною кампанії або standalone (one-shot)
 * - Має GM (creator) та гравців (SessionParticipant)
 * 
 * Головні функції:
 * 1. CRUD сесій (створення, отримання, оновлення, видалення)
 * 2. Управління учасниками (приєднання, вихід)
 * 3. Календар агрегація (для відображення на UI)
 */
class SessionController {
  // ============== CRUD Сесії ==============

  /**
   * Створити нову сесію
   * POST /api/sessions
   * 
   * @param {string} title - Назва сесії
   * @param {string} description - Опис (opcional)
   * @param {DateTime} date - Дата/час початку (UTC)
   * @param {number} duration - Тривалість в хвилинах (default: 180)
   * @param {number} maxPlayers - Макс гравців (default: 4)
   * @param {number} price - Ціна за гру (default: 0)
   * @param {number} campaignId - ID кампанії (opcional для one-shot)
   * @param {string} visibility - PUBLIC | PRIVATE | LINK_ONLY (default: PRIVATE)
   */
  async createSession(req, res, next) {
    try {
      const {
        title,
        description,
        date,
        duration = 180,
        maxPlayers = 4,
        price = 0,
        campaignId,
        visibility = 'PRIVATE',
        system,
      } = req.body;
      const creatorId = req.user.id;

      const session = await sessionService.createSession({
        title,
        description,
        date: new Date(date),
        duration,
        maxPlayers,
        price,
        campaignId: campaignId || null,
        creatorId,
        visibility,
        system: system || null,
      });

      res.status(201).json({
        success: true,
        message: 'Сесія створена успішно!',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отримати мої сесії (як GM або як гравець)
   * GET /api/sessions
   * 
   * Query params:
    * @param {string} status - PLANNED | ACTIVE | FINISHED | CANCELED (opcional)
   * @param {string} role - GM | PLAYER | ALL (default: ALL)
   * @param {number} limit - Кількість результатів (default: 20)
   * @param {number} offset - Paginationля (default: 0)
   */
  async getMySessions(req, res, next) {
    try {
      const userId = req.user.id;
      const { status, role = 'ALL', limit = 20, offset = 0 } = req.query;

      const sessions = await sessionService.getMySessions(userId, {
        status,
        role,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отримати календар (агрегація сесій по датам)
   * GET /api/sessions/calendar
   * 
   * Повертає: { "2026-02-03": 3, "2026-02-04": 1, ... }
   * (дата: кількість сесій в цей день)
   * 
   * Query params:
   * @param {string} year - Рік (default: поточний)
   * @param {string} month - Місяць 1-12 (default: поточний)
   * @param {string} type - MY | PUBLIC | ALL (default: MY)
   */
  async getCalendar(req, res, next) {
    try {
      const userId = req.user?.id;
      // Якщо користувач не авторизований, він не може дивитися "MY", тільки "PUBLIC"
      // Це захист від дефолтного значення 'MY' для анонімів
      let { year, month, type = 'MY' } = req.query;

      if (!userId) {
        type = 'PUBLIC';
      }

      const calendar = await sessionService.getCalendar(userId, {
        year: year ? parseInt(year) : new Date().getFullYear(),
        month: month ? parseInt(month) : new Date().getMonth() + 1,
        type,
      });

      res.json({
        success: true,
        data: calendar,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отримати статистику календаря з підтримкою фільтрів
   * GET /api/sessions/calendar-stats
   * 
  * Повертає: { "2026-02-03": { count: 3, sessions: [...] }, ... }
   * 
   * Query params:
   * @param {string} month - ISO дата місяця (напр. "2026-02-01")
   * @param {string} scope - 'global' | 'user' | 'search'
   * @param {string} filters - JSON об'єкт з фільтрами (для scope='search')
   * 
   * Фільтри:
   * - system: string - Система гри (D&D, Pathfinder)
   * - dateFrom: string - Початок діапазону дат
   * - dateTo: string - Кінець діапазону дат
   * - searchQuery: string - Текстовий пошук
   */
  async getCalendarStats(req, res, next) {
    try {
      const userId = req.user?.id;
      let { month, scope = 'global', filters } = req.query;

      // Якщо не передано місяць - беремо поточний
      if (!month) {
        const now = new Date();
        month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      }

      // Якщо scope='user', але немає авторизації - змінюємо на 'global'
      if (scope === 'user' && !userId) {
        scope = 'global';
      }

      // Парсимо фільтри, якщо передані
      let parsedFilters = {};
      if (filters) {
        try {
          parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;
        } catch (e) {
          parsedFilters = {};
        }
      }

      const stats = await sessionService.getCalendarStats(userId, {
        month,
        scope,
        filters: parsedFilters,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отримати сесії конкретного дня з фільтрами
   * GET /api/sessions/day-filtered/:date
   * 
   * Query params:
   * @param {string} scope - 'global' | 'user' | 'search'
   * @param {string} filters - JSON об'єкт з фільтрами
   */
  async getSessionsByDayFiltered(req, res, next) {
    try {
      const { date } = req.params;
      const userId = req.user?.id;
      let { scope = 'global', filters } = req.query;

      // Примусово global для гостей, якщо просять user
      if (scope === 'user' && !userId) {
        scope = 'global';
      }

      // Парсимо фільтри
      let parsedFilters = {};
      if (filters) {
        try {
          parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;
        } catch (e) {
          parsedFilters = {};
        }
      }

      const sessions = await sessionService.getSessionsByDayFiltered(
        userId, 
        date, 
        scope, 
        parsedFilters
      );

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Отримати деталі сесії
   * GET /api/sessions/:id
   * 
   * Включає:
   * - Учасники (з ролями та статусами)
   * - Інформація про кампанію
   * - Інформація про GM
   */
  async getSessionById(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user?.id;

      const session = await sessionService.getSessionById(sessionId, userId);

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Оновити сесію (тільки для GM/creator)
   * PATCH /api/sessions/:id
   * 
   * Можна оновлювати:
   * - title, description, date, duration, maxPlayers, price
   * - visibility, status
   */
  async updateSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const creatorId = req.user.id;
      const {
        title,
        description,
        date,
        duration,
        maxPlayers,
        price,
        visibility,
        status,
      } = req.body;

      const session = await sessionService.updateSession(
        sessionId,
        creatorId,
        {
          title,
          description,
          date: date ? new Date(date) : undefined,
          duration,
          maxPlayers,
          price,
          visibility,
          status,
        }
      );

      res.json({
        success: true,
        message: 'Сесія оновлена успішно!',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Видалити сесію (тільки для GM/creator)
   * DELETE /api/sessions/:id
   * 
   * Примітка: Каскадно видаляються:
   * - SessionParticipant записи
   * - ChatMessage записи
   */
  async deleteSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const creatorId = req.user.id;

      await sessionService.deleteSession(sessionId, creatorId);

      res.json({
        success: true,
        message: 'Сесія видалена успішно!',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============== Управління учасниками ==============

  /**
   * Приєднатися до сесії
   * POST /api/sessions/:id/join
   * 
   * Логіка:
   * 1. Перевірити максимум гравців
   * 2. Перевірити вже не учасник
   * 3. Якщо price > 0 — блокувати платіж
   * 4. Встановити статус PENDING для публічних, або лист очікування
   */
  async joinSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user.id;
      const { isGuest = false } = req.body || {};

      const participant = await sessionService.joinSession(
        sessionId,
        userId,
        isGuest
      );

      res.status(201).json({
        success: true,
        message: 'Ви приєдналися до сесії!',
        data: participant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Вийти з сесії
   * POST /api/sessions/:id/leave
   * 
   * Логіка:
   * 1. Видалити SessionParticipant запис
   * 2. Якщо price > 0 — повернути платіж
   * 3. Якщо користувач був GM — заборонити (потребує контролер)
   */
  async leaveSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user.id;

      await sessionService.leaveSession(sessionId, userId);

      res.json({
        success: true,
        message: 'Ви вийшли з сесії!',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отримати всіх учасників сесії
   * GET /api/sessions/:id/participants
   * 
   * Включає:
   * - Дані користувача (username, avatar, тощо)
   * - Роль в сесії (GM | PLAYER)
   * - Статус участі (PENDING | CONFIRMED | DECLINED | ATTENDED | NO_SHOW)
   */
  async getSessionParticipants(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user?.id;

      const participants = await sessionService.getSessionParticipants(
        sessionId,
        userId
      );

      res.json({
        success: true,
        data: participants,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Оновити статус учасника (тільки для GM)
   * PATCH /api/sessions/:id/participants/:participantId
   * 
   * @param {string} status - CONFIRMED | DECLINED | ATTENDED | NO_SHOW
   */
  async updateParticipantStatus(req, res, next) {
    try {
      const { id: sessionId, participantId } = req.params;
      const creatorId = req.user.id;
      const { status } = req.body;

      const participant = await sessionService.updateParticipantStatus(
        sessionId,
        participantId,
        creatorId,
        status
      );

      res.json({
        success: true,
        message: 'Статус учасника оновлено!',
        data: participant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Видалити учасника з сесії (тільки для GM)
   * DELETE /api/sessions/:id/participants/:participantId
   */
  async removeParticipant(req, res, next) {
    try {
      const { id: sessionId, participantId } = req.params;
      const creatorId = req.user.id;

      await sessionService.removeParticipant(
        sessionId,
        participantId,
        creatorId
      );

      res.json({
        success: true,
        message: 'Учасника видалено з сесії!',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============== Додаткові утиліти ==============

  /**
   * Получити сесії з конкретного дня
   * GET /api/sessions/day/:date
   * 
   * @param {string} date - Дата в форматі YYYY-MM-DD
   * @param {string} type - MY | PUBLIC | ALL (default: MY)
   */
  async getSessionsByDay(req, res, next) {
    try {
      const { date } = req.params;
      const userId = req.user?.id;
      let { type = 'MY' } = req.query;

      // Примусово PUBLIC для гостей
      if (!userId) {
        type = 'PUBLIC';
      }

      const sessions = await sessionService.getSessionsByDay(userId, date, type);

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Отримати сесії по кампанії
   * GET /api/campaigns/:campaignId/sessions
   * 
   * Показує всі сесії у межах кампанії
   * Доступно тільки членам кампанії
   */
  async getCampaignSessions(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;
      const { limit = 20, offset = 0 } = req.query;

      const sessions = await sessionService.getCampaignSessions(
        campaignId,
        userId,
        {
          limit: parseInt(limit),
          offset: parseInt(offset),
        }
      );

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Скасувати сесію
   * POST /api/sessions/:id/cancel
   */
  async cancelSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user.id;

      const session = await sessionService.cancelSession(sessionId, userId);

      res.json({
        success: true,
        message: 'Сесію успішно скасовано. Учасників повідомлено.', // Текст на майбутнє
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Позначити сесію як проведену
   * POST /api/sessions/:id/mark-finished
   */
  async markSessionAsFinished(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user.id;

      const session = await sessionService.markSessionAsFinished(sessionId, userId);

      res.json({
        success: true,
        message: 'Сесію позначено як проведену',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SessionController();
