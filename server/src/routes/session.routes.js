const express = require('express');

const router = express.Router();
const { authenticateToken, optionalAuthenticateToken } = require('../middlewares/auth.middleware');
const { shareTokenLimiter } = require('../middlewares/rate-limit.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const {
  loadSessionContext,
  requireConfirmedSessionGm,
  requireSessionOwnerOrGm,
  requireSessionOwnerOrGmOrCampaignOwner,
  requireSessionOwnerOrCampaignOwner,
} = require('../middlewares/session-access.middleware');
const { mapUploadMiddleware, handleMulterError } = require('../services/upload.service');
const sessionCrudController = require('../controllers/session/session-crud.controller');
const sessionCalendarController = require('../controllers/session/session-calendar.controller');
const sessionParticipantsController = require('../controllers/session/session-participants.controller');
const sessionCallController = require('../controllers/session/session-call.controller');
const vttController = require('../controllers/vtt.controller');
const {
  validateCreateSession,
  validateUpdateSession,
  validateSessionId,
  validateSessionShareToken,
  validateGetMySessions,
  validateGetCalendar,
  validateGetCalendarStats,
  validateGetSessionsByDayFiltered,
  validateJoinSession,
  validateUpdateParticipantStatus,
  validateRemoveParticipant,
  validateGetSessionsByDay,
} = require('../validation/session.validation');

router.post(
  '/',
  [authenticateToken, verifyCSRFToken, ...validateCreateSession],
  (req, res, next) => sessionCrudController.createSession(req, res, next)
);

router.get(
  '/',
  [authenticateToken, ...validateGetMySessions],
  (req, res, next) => sessionCrudController.getMySessions(req, res, next)
);

router.get(
  '/next-relevant',
  [authenticateToken],
  (req, res, next) => sessionCrudController.getNextRelevantSession(req, res, next)
);

router.get(
  '/calendar',
  [optionalAuthenticateToken, ...validateGetCalendar],
  (req, res, next) => sessionCalendarController.getCalendar(req, res, next)
);

router.get(
  '/calendar-stats',
  [authenticateToken, ...validateGetCalendarStats],
  (req, res, next) => sessionCalendarController.getCalendarStats(req, res, next)
);

router.get(
  '/day/:date',
  [optionalAuthenticateToken, ...validateGetSessionsByDay],
  (req, res, next) => sessionCalendarController.getSessionsByDay(req, res, next)
);

router.get(
  '/day-filtered/:date',
  [authenticateToken, ...validateGetSessionsByDayFiltered],
  (req, res, next) => sessionCalendarController.getSessionsByDayFiltered(req, res, next)
);

router.get(
  '/share/:shareToken',
  [shareTokenLimiter, optionalAuthenticateToken, ...validateSessionShareToken],
  (req, res, next) => sessionCrudController.getSessionByShareToken(req, res, next)
);

router.get(
  '/share/:shareToken/page',
  [shareTokenLimiter, optionalAuthenticateToken, ...validateSessionShareToken],
  (req, res, next) => sessionCrudController.getSessionPageByShareToken(req, res, next)
);

router.get(
  '/:id',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionCrudController.getSessionById(req, res, next)
);

router.get(
  '/:id/page',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionCrudController.getSessionPageById(req, res, next)
);

router.post(
  '/:id/share/regenerate',
  [authenticateToken, verifyCSRFToken, ...validateSessionId],
  (req, res, next) => sessionCrudController.regenerateShareToken(req, res, next)
);

router.get(
  '/:id/share-link',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionCrudController.getSessionShareLink(req, res, next)
);

router.patch(
  '/:id',
  [authenticateToken, verifyCSRFToken, ...validateUpdateSession, loadSessionContext, requireSessionOwnerOrGm],
  (req, res, next) => sessionCrudController.updateSession(req, res, next)
);

router.delete(
  '/:id',
  [authenticateToken, verifyCSRFToken, ...validateSessionId, loadSessionContext, requireSessionOwnerOrCampaignOwner],
  (req, res, next) => sessionCrudController.deleteSession(req, res, next)
);

router.post(
  '/:id/cancel',
  [
    authenticateToken,
    verifyCSRFToken,
    ...validateSessionId,
    loadSessionContext,
    requireSessionOwnerOrGmOrCampaignOwner,
  ],
  (req, res, next) => sessionCrudController.cancelSession(req, res, next)
);

router.post(
  '/:id/mark-finished',
  [authenticateToken, verifyCSRFToken, ...validateSessionId, loadSessionContext, requireConfirmedSessionGm],
  (req, res, next) => sessionCrudController.markSessionAsFinished(req, res, next)
);

router.get(
  '/:id/participants',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionParticipantsController.getSessionParticipants(req, res, next)
);

router.get(
  '/:id/call-config',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionCallController.getCallConfig(req, res, next)
);

router.post(
  '/:id/join',
  [authenticateToken, verifyCSRFToken, ...validateJoinSession],
  (req, res, next) => sessionParticipantsController.joinSession(req, res, next)
);

router.post(
  '/:id/leave',
  [authenticateToken, verifyCSRFToken, ...validateSessionId],
  (req, res, next) => sessionParticipantsController.leaveSession(req, res, next)
);

router.patch(
  '/:id/participants/:participantId',
  [authenticateToken, verifyCSRFToken, ...validateUpdateParticipantStatus, loadSessionContext, requireSessionOwnerOrGm],
  (req, res, next) => sessionParticipantsController.updateParticipantStatus(req, res, next)
);

router.delete(
  '/:id/participants/:participantId',
  [authenticateToken, verifyCSRFToken, ...validateRemoveParticipant, loadSessionContext, requireSessionOwnerOrGm],
  (req, res, next) => sessionParticipantsController.removeParticipant(req, res, next)
);

router.post(
  '/:id/vtt/map',
  [
    authenticateToken,
    verifyCSRFToken,
    ...validateSessionId,
    loadSessionContext,
    requireSessionOwnerOrGm,
    mapUploadMiddleware,
    handleMulterError,
  ],
  (req, res, next) => sessionCrudController.uploadVttMap(req, res, next)
);

// ─── VTT: Character Sheet ───────────────────────────────────────────────────────────

// GET  /sessions/:id/vtt/character  — отримати аркуш персонажа поточного гравця
router.get(
  '/:id/vtt/character',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => vttController.getCharacterSheet(req, res, next)
);

// PUT  /sessions/:id/vtt/character  — зберегти/оновити аркуш персонажа
router.put(
  '/:id/vtt/character',
  [authenticateToken, verifyCSRFToken, ...validateSessionId],
  (req, res, next) => vttController.upsertCharacterSheet(req, res, next)
);

// ─── VTT: GM Creatures (Bestiary) ──────────────────────────────────────────────────

// GET  /sessions/:id/vtt/creatures  — список GM-істот
router.get(
  '/:id/vtt/creatures',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => vttController.getCreatures(req, res, next)
);

// POST /sessions/:id/vtt/creatures  — додати нову істоту { type }
router.post(
  '/:id/vtt/creatures',
  [authenticateToken, verifyCSRFToken, ...validateSessionId],
  (req, res, next) => vttController.addCreature(req, res, next)
);

// POST /sessions/:id/vtt/creatures/sync  — bulk-синхронізація всього бестіарію зі store
router.post(
  '/:id/vtt/creatures/sync',
  [authenticateToken, verifyCSRFToken, ...validateSessionId],
  (req, res, next) => vttController.syncCreatures(req, res, next)
);

// PUT  /sessions/:id/vtt/creatures/:creatureId  — оновити окрему істоту
router.put(
  '/:id/vtt/creatures/:creatureId',
  [authenticateToken, verifyCSRFToken, ...validateSessionId],
  (req, res, next) => vttController.updateCreature(req, res, next)
);

// DELETE /sessions/:id/vtt/creatures/:creatureId  — видалити істоту
router.delete(
  '/:id/vtt/creatures/:creatureId',
  [authenticateToken, verifyCSRFToken, ...validateSessionId],
  (req, res, next) => vttController.removeCreature(req, res, next)
);

// ─── VTT: Dice Log ─────────────────────────────────────────────────────────────────

// GET /sessions/:id/vtt/dice-log  — історія кидків кубиків з БД (?limit=50)
router.get(
  '/:id/vtt/dice-log',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => vttController.getDiceLog(req, res, next)
);

module.exports = router;
