const adminService = require('../services/admin.service');
const { AppError, ERROR_CODES } = require('../constants/errors');

class AdminController {
  async getStats(req, res, next) {
    try {
      const stats = await adminService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const result = await adminService.getUsers({
        page: Number.parseInt(page),
        limit: Math.min(Number.parseInt(limit) || 20, 100),
        search: search.trim(),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getCampaigns(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '', visibility = '' } = req.query;
      const result = await adminService.getCampaigns({
        page: Number.parseInt(page),
        limit: Math.min(Number.parseInt(limit) || 20, 100),
        search: search.trim(),
        visibility,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
  async deleteCampaign(req, res, next) {
    try {
      const result = await adminService.deleteCampaign(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getSessions(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '', status = '' } = req.query;
      const result = await adminService.getSessions({
        page: Number.parseInt(page),
        limit: Math.min(Number.parseInt(limit) || 20, 100),
        search: search.trim(),
        status,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deleteSession(req, res, next) {
    try {
      const result = await adminService.deleteSession(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async banUser(req, res, next) {
    try {
      const result = await adminService.banUser(req.params.id, req.user.id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async unbanUser(req, res, next) {
    try {
      const result = await adminService.unbanUser(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
