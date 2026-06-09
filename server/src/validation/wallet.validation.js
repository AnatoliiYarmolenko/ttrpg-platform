const Joi = require('joi');

const topUpSchema = Joi.object({
  amount: Joi.number().positive().max(10000).required().messages({
    'number.base': 'Сума має бути числом',
    'number.positive': 'Сума має бути строго позитивною',
    'number.max': 'Максимальна сума поповнення — 10 000',
    'any.required': 'Сума обов\'язкова для заповнення',
  }),
});

module.exports = {
  topUpSchema,
};
