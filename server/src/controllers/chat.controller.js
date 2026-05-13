const chatService = require('../services/chat.service');

class ChatController {
  async getCampaignChatDescriptor(req, res, next) {
    try {
      const { campaignId } = req.params;
      const userId = req.user.id;

      const descriptor = await chatService.getCampaignChatDescriptor(campaignId, userId);

      res.json({
        success: true,
        data: descriptor,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSessionChatDescriptor(req, res, next) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const descriptor = await chatService.getSessionChatDescriptor(sessionId, userId);

      res.json({
        success: true,
        data: descriptor,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentMessages(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user.id;
      const { limit } = req.query;

      const result = await chatService.getRecentMessages(chatId, userId, {
        limit,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user.id;
      const { content, clientMessageId } = req.body;

      const message = await chatService.createUserMessage(chatId, userId, content);

      res.status(201).json({
        success: true,
        data: {
          message,
          clientMessageId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();
