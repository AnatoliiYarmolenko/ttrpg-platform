const Joi = require('joi');
const { validateParams, validateQuery, validateBody } = require('../middlewares/validation.middleware');

const getNotificationsQuerySchema = Joi.object({
  status: Joi.string().trim().valid('UNREAD', 'READ', 'ARCHIVED').optional().messages({
    'any.only': 'status повинен бути UNREAD, READ або ARCHIVED',
  }),
  limit: Joi.number().integer().min(1).max(100).optional().messages({
    'number.base': 'limit повинен бути числом',
    'number.min': 'limit повинен бути не менше 1',
    'number.max': 'limit не може перевищувати 100',
  }),
  offset: Joi.number().integer().min(0).optional().messages({
    'number.base': 'offset повинен бути числом',
    'number.min': 'offset не може бути від\'ємним',
  }),
});

const notificationIdParamsSchema = Joi.object({
  id: Joi.number().integer().min(1).required().messages({
    'number.base': 'id повинен бути позитивним числом',
    'number.min': 'id повинен бути позитивним числом',
    'any.required': 'id обов\'язковий',
  }),
});

const markManyAsReadBodySchema = Joi.object({
  ids: Joi.array().items(
    Joi.number().integer().min(1).required()
  ).min(1).required().messages({
    'array.base': 'ids повинен бути масивом',
    'array.min': 'ids повинен містити хоча б один елемент',
    'any.required': 'ids обов\'язковий',
    'number.base': 'Кожен id повинен бути позитивним числом',
  }),
});

module.exports = {
  validateGetNotifications: validateQuery(getNotificationsQuerySchema),
  validateNotificationId: validateParams(notificationIdParamsSchema),
  validateMarkManyAsRead: validateBody(markManyAsReadBodySchema),
};
