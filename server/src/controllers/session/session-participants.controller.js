const sessionService = require('../../services/session.service');

const sessionParticipantsController = {
  async joinSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user.id;
      const { role = 'PLAYER' } = req.body || {};

      const participant = await sessionService.joinSession(
        sessionId,
        userId,
        { role }
      );

      const message = participant.status === 'CONFIRMED'
        ? 'Ви приєдналися до сесії!'
        : 'Заявку на участь відправлено!';

      res.status(201).json({
        success: true,
        message,
        data: participant,
      });
    } catch (error) {
      next(error);
    }
  },

  async leaveSession(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user.id;

      await sessionService.leaveSession(sessionId, userId);

      res.json({
        success: true,
        message: 'Ви вийшли з сесії!',
      });
    } catch (error) {
      next(error);
    }
  },

  async getSessionParticipants(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const userId = req.user?.id;

      const participants = await sessionService.getSessionParticipants(
        sessionId,
        userId
      );

      res.json({
        success: true,
        data: participants,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateParticipantStatus(req, res, next) {
    try {
      const { id: sessionId, participantId } = req.params;
      const ownerId = req.user.id;
      const preloadedSession = req.sessionContext || null;
      const { status } = req.body;

      const participant = await sessionService.updateParticipantStatus(
        sessionId,
        participantId,
        ownerId,
        status,
        { preloadedSession }
      );

      res.json({
        success: true,
        message: 'Статус учасника оновлено!',
        data: participant,
      });
    } catch (error) {
      next(error);
    }
  },

  async removeParticipant(req, res, next) {
    try {
      const { id: sessionId, participantId } = req.params;
      const ownerId = req.user.id;
      const preloadedSession = req.sessionContext || null;

      await sessionService.removeParticipant(
        sessionId,
        participantId,
        ownerId,
        { preloadedSession }
      );

      res.json({
        success: true,
        message: 'Учасника видалено з сесії!',
      });
    } catch (error) {
      next(error);
    }
  },

  async kickGm(req, res, next) {
    try {
      const { id: sessionId } = req.params;
      const requesterId = req.user.id;
      const preloadedSession = req.sessionContext || null;

      await sessionService.kickGm(sessionId, requesterId, { preloadedSession });

      res.json({
        success: true,
        message: 'GM успішно видалений із сесії',
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = sessionParticipantsController;