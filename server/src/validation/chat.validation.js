const Joi = require('joi');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validation.middleware');

const campaignIdParamsSchema = Joi.object({
  campaignId: Joi.number().integer().min(1).required().messages({
    'number.base': 'campaignId повинен бути позитивним числом',
    'number.min': 'campaignId повинен бути позитивним числом',
  }),
});

const sessionIdParamsSchema = Joi.object({
  sessionId: Joi.number().integer().min(1).required().messages({
    'number.base': 'sessionId повинен бути позитивним числом',
    'number.min': 'sessionId повинен бути позитивним числом',
  }),
});

const chatIdParamsSchema = Joi.object({
  chatId: Joi.number().integer().min(1).required().messages({
    'number.base': 'chatId повинен бути позитивним числом',
    'number.min': 'chatId повинен бути позитивним числом',
  }),
});

const messagesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional().messages({
    'number.base': 'limit повинен бути позитивним числом',
    'number.min': 'limit повинен бути позитивним числом',
    'number.max': 'limit не повинен перевищувати 100',
  }),
  after: Joi.string().trim().optional().messages({
    'string.base': 'after повинен бути рядком',
    'string.empty': 'after не може бути порожнім',
  }),
  before: Joi.string().trim().optional().messages({
    'string.base': 'before повинен бути рядком',
    'string.empty': 'before не може бути порожнім',
  }),
});

const sendMessageBodySchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'Повідомлення не може бути порожнім',
    'string.min': 'Повідомлення не може бути порожнім',
    'string.max': 'Повідомлення не повинно перевищувати 2000 символів',
    'any.required': 'Повідомлення не може бути порожнім',
  }),
  clientMessageId: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'clientMessageId обов\'язковий',
    'string.min': 'clientMessageId обов\'язковий',
    'string.max': 'clientMessageId не повинен перевищувати 100 символів',
    'any.required': 'clientMessageId обов\'язковий',
  }),
});

const validateChatCampaignId = [validateParams(campaignIdParamsSchema)];
const validateChatSessionId = [validateParams(sessionIdParamsSchema)];
const validateChatId = [validateParams(chatIdParamsSchema)];
const validateChatMessagesQuery = [validateQuery(messagesQuerySchema)];
const validateChatSendMessage = [validateBody(sendMessageBodySchema)];

module.exports = {
  validateChatCampaignId,
  validateChatSessionId,
  validateChatId,
  validateChatMessagesQuery,
  validateChatSendMessage,
};
