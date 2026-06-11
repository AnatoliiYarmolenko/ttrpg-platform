const Joi = require('joi');

const topUpSchema = Joi.object({
  amount: Joi.number().positive().precision(2).max(10000).required().messages({
    'number.base': 'Сума має бути числом',
    'number.positive': 'Сума має бути строго позитивною',
    'number.precision': 'Сума не може мати більше 2 знаків після коми',
    'number.max': 'Максимальна сума поповнення — 10 000',
    'any.required': 'Сума обов\'язкова для заповнення',
  }),
});

const transactionsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

module.exports = {
  topUpSchema,
  transactionsQuerySchema,
};
