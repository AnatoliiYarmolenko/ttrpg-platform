const express = require('express');

const router = express.Router();
const { authenticateToken } = require('../middlewares/auth.middleware');
const chatController = require('../controllers/chat.controller');
const {
  validateChatCampaignId,
  validateChatSessionId,
  validateChatId,
  validateChatMessagesQuery,
  validateChatSendMessage,
} = require('../validation/chat.validation');

router.get(
  '/campaign/:campaignId',
  [authenticateToken, ...validateChatCampaignId],
  (req, res, next) => chatController.getCampaignChatDescriptor(req, res, next)
);

router.get(
  '/session/:sessionId',
  [authenticateToken, ...validateChatSessionId],
  (req, res, next) => chatController.getSessionChatDescriptor(req, res, next)
);

router.get(
  '/:chatId/messages',
  [authenticateToken, ...validateChatId, ...validateChatMessagesQuery],
  (req, res, next) => chatController.getRecentMessages(req, res, next)
);

router.post(
  '/:chatId/messages',
  [authenticateToken, ...validateChatId, ...validateChatSendMessage],
  (req, res, next) => chatController.sendMessage(req, res, next)
);

module.exports = router;
