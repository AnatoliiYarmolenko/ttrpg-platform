const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuthenticateToken } = require('../middlewares/auth.middleware');
const sessionController = require('../controllers/session.controller');
const {
  validateCreateSession,
  validateUpdateSession,
  validateSessionId,
  validateGetMySessions,
  validateGetCalendar,
  validateGetCalendarStats,
  validateGetSessionsByDayFiltered,
  validateJoinSession,
  validateUpdateParticipantStatus,
  validateRemoveParticipant,
  validateGetSessionsByDay,
} = require('../validation/session.validation');

// ============== CRUD Сесій ==============

// POST /api/sessions - Створити нову сесію
router.post(
  '/',
  [authenticateToken, ...validateCreateSession],
  (req, res, next) => sessionController.createSession(req, res, next)
);

// GET /api/sessions - Отримати мої сесії
router.get(
  '/',
  [authenticateToken, ...validateGetMySessions],
  (req, res, next) => sessionController.getMySessions(req, res, next)
);

// GET /api/sessions/calendar - Отримати календар (агрегація по датам)
// Optional auth: працює для анонімів (PUBLIC) та авторизованих (MY/ALL)
router.get(
  '/calendar',
  [optionalAuthenticateToken, ...validateGetCalendar],
  (req, res, next) => sessionController.getCalendar(req, res, next)
);

// GET /api/sessions/calendar-stats - Отримати статистику календаря з фільтрами
// Використовується для Dashboard views (Home, MyGames, Search)
router.get(
  '/calendar-stats',
  [optionalAuthenticateToken, ...validateGetCalendarStats],
  (req, res, next) => sessionController.getCalendarStats(req, res, next)
);

// GET /api/sessions/day/:date - Отримати сесії конкретного дня
// Optional auth: працює для анонімів (PUBLIC) та авторизованих (MY/ALL)
router.get(
  '/day/:date',
  [optionalAuthenticateToken, ...validateGetSessionsByDay],
  (req, res, next) => sessionController.getSessionsByDay(req, res, next)
);

// GET /api/sessions/day-filtered/:date - Отримати сесії дня з фільтрами
// Використовується для Dashboard Search view
router.get(
  '/day-filtered/:date',
  [optionalAuthenticateToken, ...validateGetSessionsByDayFiltered],
  (req, res, next) => sessionController.getSessionsByDayFiltered(req, res, next)
);

// GET /api/sessions/:id - Отримати деталі сесії
router.get(
  '/:id',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionController.getSessionById(req, res, next)
);

// PATCH /api/sessions/:id - Оновити сесію (тільки для GM)
router.patch(
  '/:id',
  [authenticateToken, ...validateUpdateSession],
  (req, res, next) => sessionController.updateSession(req, res, next)
);

// DELETE /api/sessions/:id - Видалити сесію (тільки для GM)
router.delete(
  '/:id',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionController.deleteSession(req, res, next)
);

// POST /api/sessions/:id/cancel - Скасувати сесію (Soft Delete)
router.post(
  '/:id/cancel',
  [authenticateToken, ...validateSessionId], // validateSessionId перевіряє, що ID - це число
  (req, res, next) => sessionController.cancelSession(req, res, next)
);

// POST /api/sessions/:id/mark-finished - Позначити як проведену
router.post(
  '/:id/mark-finished',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionController.markSessionAsFinished(req, res, next)
);

// ============== Управління учасниками ==============

// GET /api/sessions/:id/participants - Отримати всіх учасників
router.get(
  '/:id/participants',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionController.getSessionParticipants(req, res, next)
);

// POST /api/sessions/:id/join - Приєднатися до сесії
router.post(
  '/:id/join',
  [authenticateToken, ...validateJoinSession],
  (req, res, next) => sessionController.joinSession(req, res, next)
);

// POST /api/sessions/:id/leave - Вийти з сесії
router.post(
  '/:id/leave',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionController.leaveSession(req, res, next)
);

// PATCH /api/sessions/:id/participants/:participantId - Оновити статус учасника (тільки для GM)
router.patch(
  '/:id/participants/:participantId',
  [authenticateToken, ...validateUpdateParticipantStatus],
  (req, res, next) => sessionController.updateParticipantStatus(req, res, next)
);

// DELETE /api/sessions/:id/participants/:participantId - Видалити учасника (тільки для GM)
router.delete(
  '/:id/participants/:participantId',
  [authenticateToken, ...validateRemoveParticipant],
  (req, res, next) => sessionController.removeParticipant(req, res, next)
);

module.exports = router;
