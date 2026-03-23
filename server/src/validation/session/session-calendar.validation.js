const Joi = require('joi');
const { validateParams, validateQuery } = require('../../middlewares/validation.middleware');

const sessionDateParamSchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
    'string.pattern.base': 'Дата повинна бути в форматі YYYY-MM-DD',
  }),
});

const getCalendarQuerySchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional().messages({
    'number.base': 'Рік повинен бути від 2000 до 2100',
    'number.min': 'Рік повинен бути від 2000 до 2100',
    'number.max': 'Рік повинен бути від 2000 до 2100',
  }),
  month: Joi.number().integer().min(1).max(12).optional().messages({
    'number.base': 'Місяць повинен бути від 1 до 12',
    'number.min': 'Місяць повинен бути від 1 до 12',
    'number.max': 'Місяць повинен бути від 1 до 12',
  }),
  type: Joi.string().trim().valid('MY', 'PUBLIC', 'ALL').optional().messages({
    'any.only': 'Невірний тип фільтра',
  }),
});

const jsonFiltersRule = Joi.alternatives().try(
  Joi.object(),
  Joi.string().custom((value, helpers) => {
    try {
      JSON.parse(value);
      return value;
    } catch (error) {
      return helpers.error('any.invalid', { message: 'Невірний формат JSON для фільтрів' });
    }
  })
).messages({
  'any.invalid': '{{#message}}',
});

const getCalendarStatsQuerySchema = Joi.object({
  month: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'Місяць повинен бути в форматі ISO8601 (YYYY-MM-DD)',
  }),
  scope: Joi.string().trim().valid('global', 'user', 'search').optional().messages({
    'any.only': 'Невірний scope (global | user | search)',
  }),
  filters: jsonFiltersRule.optional(),
});

const getSessionsByDayFilteredQuerySchema = Joi.object({
  scope: Joi.string().trim().valid('global', 'user', 'search').optional().messages({
    'any.only': 'Невірний scope (global | user | search)',
  }),
  filters: jsonFiltersRule.optional(),
});

const getSessionsByDayQuerySchema = Joi.object({
  type: Joi.string().trim().valid('MY', 'PUBLIC', 'ALL').optional().messages({
    'any.only': 'Невірний тип фільтра',
  }),
});

const validateGetCalendar = [validateQuery(getCalendarQuerySchema)];
const validateGetCalendarStats = [validateQuery(getCalendarStatsQuerySchema)];
const validateGetSessionsByDayFiltered = [
  validateParams(sessionDateParamSchema),
  validateQuery(getSessionsByDayFilteredQuerySchema),
];
const validateGetSessionsByDay = [validateParams(sessionDateParamSchema), validateQuery(getSessionsByDayQuerySchema)];

module.exports = {
  validateGetCalendar,
  validateGetCalendarStats,
  validateGetSessionsByDayFiltered,
  validateGetSessionsByDay,
};
