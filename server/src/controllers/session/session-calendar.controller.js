const sessionService = require('../../services/session.service');

const sessionCalendarController = {
  async getCalendar(req, res, next) {
    try {
      const userId = req.user?.id;
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
  },

  async getCalendarStats(req, res, next) {
    try {
      const userId = req.user?.id;
      let { month, scope = 'global', filters } = req.query;

      if (!month) {
        const now = new Date();
        month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      }

      if (scope === 'user' && !userId) {
        scope = 'global';
      }

      let parsedFilters = {};
      if (filters) {
        try {
          parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;
        } catch {
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
  },

  async getSessionsByDayFiltered(req, res, next) {
    try {
      const { date } = req.params;
      const userId = req.user?.id;
      let { scope = 'global', filters } = req.query;

      if (scope === 'user' && !userId) {
        scope = 'global';
      }

      let parsedFilters = {};
      if (filters) {
        try {
          parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;
        } catch {
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
  },

  async getSessionsByDay(req, res, next) {
    try {
      const { date } = req.params;
      const userId = req.user?.id;
      let { type = 'MY' } = req.query;

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
  },
};

module.exports = sessionCalendarController;