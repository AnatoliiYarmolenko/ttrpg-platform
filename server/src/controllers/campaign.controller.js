const campaignService = require('../services/campaign.service');

class CampaignController {
  // === CRUD Кампанії ===

  // Створити нову кампанію
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
        data: campaign 
      });
    } catch (error) {
      next(error);
    }
  }

  // Отримати список моїх кампаній (як власник та як учасник)
  async getMyCampaigns(req, res, next) {
    try {
      const userId = req.user.id;
      const { role = 'all' } = req.query; // all, owner, member

      const campaigns = await campaignService.getMyCampaigns(userId, role);

      res.json({ 
        success: true, 
        data: campaigns 
      });
    } catch (error) {
      next(error);
    }
  }

  // Отримати деталі кампанії
  async getCampaignById(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user?.id;

      const campaign = await campaignService.getCampaignById(campaignId, userId);

      res.json({ 
        success: true, 
        data: campaign 
      });
    } catch (error) {
      next(error);
    }
  }

  // Оновити кампанію (тільки для власника)
  async updateCampaign(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;
      const { title, description, imageUrl, system, visibility } = req.body;

      const campaign = await campaignService.updateCampaign(campaignId, userId, {
        title,
        description,
        imageUrl,
        system,
        visibility,
      });

      res.json({ 
        success: true, 
        message: 'Кампанія оновлена успішно!',
        data: campaign 
      });
    } catch (error) {
      next(error);
    }
  }

  // Видалити кампанію (тільки для власника)
  async deleteCampaign(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;

      await campaignService.deleteCampaign(campaignId, userId);

      res.json({ 
        success: true, 
        message: 'Кампанія видалена успішно!' 
      });
    } catch (error) {
      next(error);
    }
  }

  // Передати власність кампанії іншому учаснику
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

  // === Управління учасниками ===

  // Отримати список учасників кампанії
  async getCampaignMembers(req, res, next) {
    try {
      const { campaignId } = req.params;
      // Беремо ID користувача (якщо він залогінений)
      const userId = req.user?.id;

      const members = await campaignService.getCampaignMembers(campaignId, userId);

      res.json({ 
        success: true, 
        data: members 
      });
    } catch (error) {
      next(error);
    }
  }
  // Додати учасника в кампанію
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
        data: member 
      });
    } catch (error) {
      next(error);
    }
  }

  // Видалити учасника з кампанії
  async removeMemberFromCampaign(req, res, next) {
    try {
      const { campaignId, memberId } = req.params;
      const userId = req.user.id;

      await campaignService.removeMemberFromCampaign(campaignId, userId, memberId);

      res.json({ 
        success: true, 
        message: 'Учасник видалений успішно!' 
      });
    } catch (error) {
      next(error);
    }
  }

  // Змінити роль учасника
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
        data: member 
      });
    } catch (error) {
      next(error);
    }
  }

  // === Invite коди ===

  // Регенерувати invite код
  async regenerateInviteCode(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;

      const campaign = await campaignService.regenerateInviteCode(campaignId, userId);

      res.json({ 
        success: true, 
        message: 'Invite код змінено успішно!',
        data: { inviteCode: campaign.inviteCode } 
      });
    } catch (error) {
      next(error);
    }
  }

  // Приєднатися до кампанії за invite кодом
  async joinByInviteCode(req, res, next) {
    try {
      const { inviteCode } = req.params;
      const userId = req.user.id;

      const member = await campaignService.joinByInviteCode(inviteCode, userId);

      res.json({ 
        success: true, 
        message: 'Ви успішно приєдналися до кампанії!',
        data: member 
      });
    } catch (error) {
      next(error);
    }
  }

  // === Заявки на вступ ===

  // Подати заявку на вступ (для приватних/защищённых кампаній)
  async submitJoinRequest(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;
      const { message } = req.body || {};

      const joinRequest = await campaignService.submitJoinRequest(
        campaignId,
        userId,
        message
      );

      res.status(201).json({ 
        success: true, 
        message: 'Заявка на вступ відправлена!',
        data: joinRequest 
      });
    } catch (error) {
      next(error);
    }
  }

  // Отримати заявки на вступ (для власника/GM)
  async getJoinRequests(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;

      const joinRequests = await campaignService.getJoinRequests(campaignId, userId);

      res.json({ 
        success: true, 
        data: joinRequests 
      });
    } catch (error) {
      next(error);
    }
  }

  // Схвалити заявку на вступ
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
        data: member 
      });
    } catch (error) {
      next(error);
    }
  }

  // Відхилити заявку на вступ
  async rejectJoinRequest(req, res, next) {
    try {
      const { requestId } = req.params;
      const userId = req.user.id;

      await campaignService.rejectJoinRequest(requestId, userId);

      res.json({ 
        success: true, 
        message: 'Заявка відхилена.' 
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CampaignController();
