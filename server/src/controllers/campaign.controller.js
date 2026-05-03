const campaignService = require('../services/campaign.service');

class CampaignController {
  async createCampaign(req, res, next) {
    try {
      const { title, description, imageUrl, system, visibility } = req.body;
      const userId = req.user.id;

      const campaign = await campaignService.createCampaign({
        title,
        description,
        imageUrl,
        system,
        visibility,
        ownerId: userId,
      });

      res.status(201).json({
        success: true,
        message: 'Кампанія створена успішно!',
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyCampaigns(req, res, next) {
    try {
      const userId = req.user.id;
      const { role = 'all' } = req.query;

      const campaigns = await campaignService.getMyCampaigns(userId, role);

      res.json({
        success: true,
        data: campaigns,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignById(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user?.id;

      const campaign = await campaignService.getCampaignById(campaignId, userId);

      res.json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignByShareToken(req, res, next) {
    try {
      const { shareToken } = req.params;
      const userId = req.user?.id || null;

      const campaign = await campaignService.getCampaignByShareToken(shareToken, userId);

      res.json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignPageById(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user?.id;

      const pageData = await campaignService.getCampaignPageById(campaignId, userId);

      res.json({
        success: true,
        data: pageData,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignPageByShareToken(req, res, next) {
    try {
      const { shareToken } = req.params;
      const userId = req.user?.id || null;

      const pageData = await campaignService.getCampaignPageByShareToken(shareToken, userId);

      res.json({
        success: true,
        data: pageData,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCampaign(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;
      const { title, description, imageUrl, system, visibility, status } = req.body;

      const campaign = await campaignService.updateCampaign(campaignId, userId, {
        title,
        description,
        imageUrl,
        system,
        visibility,
        status,
      });

      res.json({
        success: true,
        message: 'Кампанія оновлена успішно!',
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async transferCampaignOwnership(req, res, next) {
    try {
      const { campaignId } = req.params;
      const currentOwnerId = req.user.id;
      const { newOwnerId } = req.body;

      const campaign = await campaignService.transferCampaignOwnership(
        campaignId,
        currentOwnerId,
        newOwnerId
      );

      res.json({
        success: true,
        message: 'Права власності кампанії передано успішно!',
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignMembers(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user?.id;

      const members = await campaignService.getCampaignMembers(campaignId, userId);

      res.json({
        success: true,
        data: members,
      });
    } catch (error) {
      next(error);
    }
  }

  async addMemberToCampaign(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;
      const { newMemberId, role = 'PLAYER' } = req.body;

      const member = await campaignService.addMemberToCampaign(
        campaignId,
        userId,
        newMemberId,
        role
      );

      res.status(201).json({
        success: true,
        message: 'Учасник додано успішно!',
        data: member,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeMemberFromCampaign(req, res, next) {
    try {
      const { campaignId, memberId } = req.params;
      const userId = req.user.id;

      await campaignService.removeMemberFromCampaign(campaignId, userId, memberId);

      res.json({
        success: true,
        message: 'Учасник видалений успішно!',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMemberRole(req, res, next) {
    try {
      const { campaignId, memberId } = req.params;
      const userId = req.user.id;
      const { role } = req.body;

      const member = await campaignService.updateMemberRole(
        campaignId,
        userId,
        memberId,
        role
      );

      res.json({
        success: true,
        message: 'Роль учасника оновлена успішно!',
        data: member,
      });
    } catch (error) {
      next(error);
    }
  }

  async regenerateShareToken(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;

      const result = await campaignService.regenerateShareToken(campaignId, userId);

      res.json({
        success: true,
        message: 'Share link regenerated successfully',
        data: {
          shareToken: result.token,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignShareLink(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;

      const result = await campaignService.getCampaignShareLink(campaignId, userId);

      res.json({
        success: true,
        data: {
          shareToken: result.token,
          shareUrl: result.shareUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async submitJoinRequest(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;
      const { message, shareToken = null } = req.body || {};

      const joinRequest = await campaignService.submitJoinRequest(
        campaignId,
        userId,
        message,
        shareToken
      );

      res.status(201).json({
        success: true,
        message: 'Заявка на вступ відправлена!',
        data: joinRequest,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelJoinRequest(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;

      await campaignService.cancelJoinRequest(campaignId, userId);

      res.json({
        success: true,
        message: 'Заявку відкликано!',
      });
    } catch (error) {
      next(error);
    }
  }

  async getJoinRequests(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;

      const joinRequests = await campaignService.getJoinRequests(campaignId, userId);

      res.json({
        success: true,
        data: joinRequests,
      });
    } catch (error) {
      next(error);
    }
  }

  async approveJoinRequest(req, res, next) {
    try {
      const { requestId } = req.params;
      const userId = req.user.id;
      const { role = 'PLAYER' } = req.body || {};

      const member = await campaignService.approveJoinRequest(
        requestId,
        userId,
        role
      );

      res.json({
        success: true,
        message: 'Заявка схвалена!',
        data: member,
      });
    } catch (error) {
      next(error);
    }
  }

  async rejectJoinRequest(req, res, next) {
    try {
      const { requestId } = req.params;
      const userId = req.user.id;

      await campaignService.rejectJoinRequest(requestId, userId);

      res.json({
        success: true,
        message: 'Заявка відхилена.',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CampaignController();
