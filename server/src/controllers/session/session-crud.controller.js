const sessionService = require('../../services/session.service');

const sessionCrudController = {
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
        isGm = true,
      } = req.body;
      const ownerId = req.user.id;

      const session = await sessionService.createSession({
        title,
        description,
        date: new Date(date),
        duration,
        maxPlayers,
        price,
        campaignId: campaignId || null,
        ownerId,
        visibility,
        system: system || null,
        isGm,
      });

      res.status(201).json({
        success: true,
        message: 'Сесія створена успішно!',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  },

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
  },

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
  },

  async updateSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const ownerId = req.user.id;
      const preloadedSession = req.sessionContext || null;
      const {
        title,
        description,
        date,
        duration,
        maxPlayers,
        price,
        visibility,
        status,
        system,
      } = req.body;

      const session = await sessionService.updateSession(
        sessionId,
        ownerId,
        {
          title,
          description,
          date: date ? new Date(date) : undefined,
          duration,
          maxPlayers,
          price,
          visibility,
          status,
          system,
        },
        { preloadedSession }
      );

      res.json({
        success: true,
        message: 'Сесія оновлена успішно!',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const ownerId = req.user.id;
      const preloadedSession = req.sessionContext || null;

      await sessionService.deleteSession(sessionId, ownerId, { preloadedSession });

      res.json({
        success: true,
        message: 'Сесія видалена успішно!',
      });
    } catch (error) {
      next(error);
    }
  },

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
  },

  async cancelSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user.id;
      const preloadedSession = req.sessionContext || null;

      const session = await sessionService.cancelSession(sessionId, userId, { preloadedSession });

      res.json({
        success: true,
        message: 'Сесію успішно скасовано. Учасників повідомлено.',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  },

  async markSessionAsFinished(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user.id;
      const preloadedSession = req.sessionContext || null;

      const session = await sessionService.markSessionAsFinished(sessionId, userId, { preloadedSession });

      res.json({
        success: true,
        message: 'Сесію позначено як проведену',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = sessionCrudController;