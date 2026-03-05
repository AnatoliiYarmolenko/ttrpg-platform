const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuthenticateToken } = require('../middlewares/auth.middleware');
const {
  loadSessionContext,
  requireConfirmedSessionGm,
  requireSessionOwnerOrGm,
  requireSessionOwnerOrCampaignOwner,
  requireSessionOwnerOrGmOrCampaignOwner,
} = require('../middlewares/session-access.middleware');
const sessionCrudController = require('../controllers/session/session-crud.controller');
const sessionCalendarController = require('../controllers/session/session-calendar.controller');
const sessionParticipantsController = require('../controllers/session/session-participants.controller');
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
  (req, res, next) => sessionCrudController.createSession(req, res, next)
);

// GET /api/sessions - Отримати мої сесії
router.get(
  '/',
  [authenticateToken, ...validateGetMySessions],
  (req, res, next) => sessionCrudController.getMySessions(req, res, next)
);

// GET /api/sessions/calendar - Отримати календар (агрегація по датам)
// Optional auth: працює для анонімів (PUBLIC) та авторизованих (MY/ALL)
router.get(
  '/calendar',
  [optionalAuthenticateToken, ...validateGetCalendar],
  (req, res, next) => sessionCalendarController.getCalendar(req, res, next)
);

// GET /api/sessions/calendar-stats - Отримати статистику календаря з фільтрами
// Використовується для Dashboard views (Home, MyGames, Search)
router.get(
  '/calendar-stats',
  [optionalAuthenticateToken, ...validateGetCalendarStats],
  (req, res, next) => sessionCalendarController.getCalendarStats(req, res, next)
);

// GET /api/sessions/day/:date - Отримати сесії конкретного дня
// Optional auth: працює для анонімів (PUBLIC) та авторизованих (MY/ALL)
router.get(
  '/day/:date',
  [optionalAuthenticateToken, ...validateGetSessionsByDay],
  (req, res, next) => sessionCalendarController.getSessionsByDay(req, res, next)
);

// GET /api/sessions/day-filtered/:date - Отримати сесії дня з фільтрами
// Використовується для Dashboard Search view
router.get(
  '/day-filtered/:date',
  [optionalAuthenticateToken, ...validateGetSessionsByDayFiltered],
  (req, res, next) => sessionCalendarController.getSessionsByDayFiltered(req, res, next)
);

// GET /api/sessions/:id - Отримати деталі сесії
router.get(
  '/:id',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionCrudController.getSessionById(req, res, next)
);

// PATCH /api/sessions/:id - Оновити сесію (тільки для GM)
router.patch(
  '/:id',
  [authenticateToken, ...validateUpdateSession, loadSessionContext, requireSessionOwnerOrGm],
  (req, res, next) => sessionCrudController.updateSession(req, res, next)
);

// DELETE /api/sessions/:id - Видалити сесію (тільки для GM)
router.delete(
  '/:id',
  [authenticateToken, ...validateSessionId, loadSessionContext, requireSessionOwnerOrCampaignOwner],
  (req, res, next) => sessionCrudController.deleteSession(req, res, next)
);

// POST /api/sessions/:id/cancel - Скасувати сесію (Soft Delete)
router.post(
  '/:id/cancel',
  [
    authenticateToken,
    ...validateSessionId,
    loadSessionContext,
    requireSessionOwnerOrGmOrCampaignOwner,
  ], // validateSessionId перевіряє, що ID - це число
  (req, res, next) => sessionCrudController.cancelSession(req, res, next)
);

// POST /api/sessions/:id/mark-finished - Позначити як проведену
router.post(
  '/:id/mark-finished',
  [authenticateToken, ...validateSessionId, loadSessionContext, requireConfirmedSessionGm],
  (req, res, next) => sessionCrudController.markSessionAsFinished(req, res, next)
);

// ============== Управління учасниками ==============

// GET /api/sessions/:id/participants - Отримати всіх учасників
router.get(
  '/:id/participants',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionParticipantsController.getSessionParticipants(req, res, next)
);

// POST /api/sessions/:id/join - Приєднатися до сесії
router.post(
  '/:id/join',
  [authenticateToken, ...validateJoinSession],
  (req, res, next) => sessionParticipantsController.joinSession(req, res, next)
);

// POST /api/sessions/:id/leave - Вийти з сесії
router.post(
  '/:id/leave',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionParticipantsController.leaveSession(req, res, next)
);

// POST /api/sessions/:id/kick-gm - Кікнути підтвердженого GM
router.post(
  '/:id/kick-gm',
  [authenticateToken, ...validateSessionId, loadSessionContext, requireSessionOwnerOrCampaignOwner],
  (req, res, next) => sessionParticipantsController.kickGm(req, res, next)
);

// PATCH /api/sessions/:id/participants/:participantId - Оновити статус учасника (тільки для GM)
router.patch(
  '/:id/participants/:participantId',
  [authenticateToken, ...validateUpdateParticipantStatus, loadSessionContext, requireSessionOwnerOrGm],
  (req, res, next) => sessionParticipantsController.updateParticipantStatus(req, res, next)
);

// DELETE /api/sessions/:id/participants/:participantId - Видалити учасника (тільки для GM)
router.delete(
  '/:id/participants/:participantId',
  [authenticateToken, ...validateRemoveParticipant, loadSessionContext, requireSessionOwnerOrGm],
  (req, res, next) => sessionParticipantsController.removeParticipant(req, res, next)
);

module.exports = router;
