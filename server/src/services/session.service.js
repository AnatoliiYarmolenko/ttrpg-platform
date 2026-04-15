const { prisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');
const {
  createRawEncryptedAndHashedShareToken,
  decryptShareToken,
} = require('../utils/token.helper');
const config = require('../config/config');
const { selectNextRelevantSession } = require('./session/session-next-relevant.selector');

const datetimeHelpers = require('./session/session-datetime.helpers');
const permissionHelpers = require('./session/session-permission.helpers');
const createSessionCoreService = require('./session/session-core.service');
const createSessionQueryService = require('./session/session-query.service');
const createSessionCalendarService = require('./session/session-calendar.service');
const createSessionLifecycleService = require('./session/session-lifecycle.service');
const createSessionParticipantsService = require('./session/session-participants.service');
const createSessionPageService = require('./session/session-page.service');

class SessionService {
  constructor() {
    this.sessionDeps = {
      prisma,
      AppError,
      ERROR_CODES,
      datetimeHelpers,
      permissionHelpers,
    };

    this.queryService = createSessionQueryService(this.sessionDeps);
    this.coreService = createSessionCoreService({
      ...this.sessionDeps,
      sessionQueryService: this.queryService,
      config,
      selectNextRelevantSession,
      createRawEncryptedAndHashedShareToken,
      assertNoSessionTimeConflict: (userId, targetStart, targetDuration, options = {}) => {
        return this._assertNoSessionTimeConflict(userId, targetStart, targetDuration, options);
      },
    });
    this.calendarService = createSessionCalendarService(this.sessionDeps);
    this.lifecycleService = createSessionLifecycleService({
      ...this.sessionDeps,
      sessionQueryService: this.queryService,
      createRawEncryptedAndHashedShareToken,
    });
    this.participantsService = createSessionParticipantsService({
      ...this.sessionDeps,
      sessionQueryService: this.queryService,
      assertNoSessionTimeConflict: (userId, targetStart, targetDuration, options = {}) => {
        return this._assertNoSessionTimeConflict(userId, targetStart, targetDuration, options);
      },
    });
    this.pageService = createSessionPageService({
      sessionQueryService: this.queryService,
    });
  }

  _parsePositiveInt(value, label = 'ID') {
    return this.queryService.parsePositiveInt(value, label);
  }

  async _resolveSessionContext(sessionId, userId, preloadedSession = null) {
    return this.queryService.resolveSessionContext(sessionId, userId, preloadedSession);
  }

  _requireSessionOwner(session, userId, message = 'Тільки власник сесії може виконати цю дію') {
    return permissionHelpers._requireSessionOwner(
      { AppError, ERROR_CODES },
      session,
      userId,
      message
    );
  }

  _getConfirmedGm(session) {
    return permissionHelpers._getConfirmedGm(session);
  }

  _isSessionOwner(session, userId) {
    return permissionHelpers._isSessionOwner(session, userId);
  }

  _isCampaignOwnerOverride(session, userId) {
    return permissionHelpers._isCampaignOwnerOverride(session, userId);
  }

  _canManageParticipants(session, userId) {
    return permissionHelpers._canManageParticipants(session, userId);
  }

  _canChangeSessionStatus(session, userId) {
    return permissionHelpers._canChangeSessionStatus(session, userId);
  }

  _canEditSessionSettings(session, userId) {
    return permissionHelpers._canEditSessionSettings(session, userId);
  }

  _getDateKeyInTimeZone(dateValue, timeZone) {
    return datetimeHelpers._getDateKeyInTimeZone(dateValue, timeZone);
  }

  _isSameDayInTimeZone(firstDate, secondDate, timeZone = 'UTC') {
    return datetimeHelpers._isSameDayInTimeZone(firstDate, secondDate, timeZone);
  }

  _getSessionEndWithGrace(sessionDateValue, durationMinutes = 0, graceHours = 2) {
    return datetimeHelpers._getSessionEndWithGrace(sessionDateValue, durationMinutes, graceHours);
  }

  _getSessionEnd(sessionDateValue, durationMinutes = 0) {
    return datetimeHelpers._getSessionEnd(sessionDateValue, durationMinutes);
  }

  _isIntervalsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
    return datetimeHelpers._isIntervalsOverlap(firstStart, firstEnd, secondStart, secondEnd);
  }

  async _assertNoSessionTimeConflict(userId, targetStart, targetDuration, options = {}) {
    return datetimeHelpers._assertNoSessionTimeConflict(
      { prisma, AppError, ERROR_CODES },
      userId,
      targetStart,
      targetDuration,
      options
    );
  }

  _buildPublicCalendarVisibilityFilter() {
    return this._buildPublicCalendarVisibilityFilterForUser(null);
  }

  _buildPublicCalendarVisibilityFilterForUser(userId = null) {
    if (!userId) {
      return [
        {
          campaignId: null,
          visibility: 'PUBLIC',
        },
        {
          campaignId: { not: null },
          visibility: 'PUBLIC',
        },
      ];
    }

    return [
      {
        campaignId: null,
        visibility: { in: ['PUBLIC', 'PRIVATE'] },
      },
      {
        campaignId: null,
        visibility: 'LINK_ONLY',
        participants: {
          some: { userId },
        },
      },
      {
        campaignId: { not: null },
        visibility: 'PUBLIC',
      },
      {
        campaignId: { not: null },
        visibility: 'PRIVATE',
        OR: [
          {
            campaign: {
              ownerId: userId,
            },
          },
          {
            campaign: {
              members: {
                some: { userId },
              },
            },
          },
          {
            participants: {
              some: { userId },
            },
          },
        ],
      },
      {
        campaignId: { not: null },
        visibility: 'LINK_ONLY',
        participants: {
          some: { userId },
        },
      },
    ];
  }

  async createSession(data) {
    return this.coreService.createSession(data);
  }

  async getMySessions(userId, options = {}) {
    return this.coreService.getMySessions(userId, options);
  }

  async getNextRelevantSessionForUser(userId, options = {}) {
    return this.coreService.getNextRelevantSessionForUser(userId, options);
  }

  async getCalendar(userId, options = {}) {
    return this.calendarService.getCalendar(userId, options);
  }

  async getCalendarStats(userId, options = {}) {
    return this.calendarService.getCalendarStats(userId, options);
  }

  async getSessionsByDayFiltered(userId, dateString, scope = 'global', filters = {}, timeZone = null) {
    return this.calendarService.getSessionsByDayFiltered(userId, dateString, scope, filters, timeZone);
  }

  async getSessionById(sessionId, userId = null, options = {}) {
    return this.queryService.getSessionById(sessionId, userId, options);
  }

  async getSessionByShareToken(rawToken, userId = null) {
    return this.queryService.getSessionByShareToken(rawToken, userId);
  }

  async getSessionPageById(sessionId, userId = null, options = {}) {
    return this.pageService.getSessionPageById(sessionId, userId, options);
  }

  async getSessionPageByShareToken(rawToken, userId = null) {
    return this.pageService.getSessionPageByShareToken(rawToken, userId);
  }

  async updateSession(sessionId, requesterId, updateData, options = {}) {
    return this.lifecycleService.updateSession(sessionId, requesterId, updateData, options);
  }

  async deleteSession(sessionId, requesterId, options = {}) {
    return this.lifecycleService.deleteSession(sessionId, requesterId, options);
  }

  async joinSession(sessionId, userId, options = {}) {
    return this.participantsService.joinSession(sessionId, userId, options);
  }

  async leaveSession(sessionId, userId) {
    return this.participantsService.leaveSession(sessionId, userId);
  }

  async getSessionParticipants(sessionId, userId = null) {
    return this.participantsService.getSessionParticipants(sessionId, userId);
  }

  async updateParticipantStatus(sessionId, participantId, requesterId, status, options = {}) {
    return this.participantsService.updateParticipantStatus(
      sessionId,
      participantId,
      requesterId,
      status,
      options
    );
  }

  async removeParticipant(sessionId, participantId, requesterId, options = {}) {
    return this.participantsService.removeParticipant(sessionId, participantId, requesterId, options);
  }

  async kickGm(sessionId, requesterId, options = {}) {
    return this.participantsService.kickGm(sessionId, requesterId, options);
  }

  async getSessionsByDay(userId, dateString, type = 'MY') {
    return this.coreService.getSessionsByDay(userId, dateString, type);
  }

  async getCampaignSessions(campaignId, userId, options = {}) {
    return this.coreService.getCampaignSessions(campaignId, userId, options);
  }

  async cancelSession(sessionId, userId, options = {}) {
    return this.lifecycleService.cancelSession(sessionId, userId, options);
  }

  async markSessionAsFinished(sessionId, userId, options = {}) {
    return this.lifecycleService.markSessionAsFinished(sessionId, userId, options);
  }

  async regenerateShareToken(sessionId, userId) {
    const session = await this.queryService.getSessionById(sessionId, userId);

    if (session.visibility !== 'LINK_ONLY') {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'Посилання доступу доступне тільки для LINK_ONLY сесій'
      );
    }

    if (!this._isSessionOwner(session, userId)) {
      throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY);
    }

    const { rawToken, tokenHash, tokenEncrypted } = createRawEncryptedAndHashedShareToken();
    const sessionIdInt = this._parsePositiveInt(sessionId, 'ID сесії');

    await prisma.session.update({
      where: { id: sessionIdInt },
      data: {
        shareTokenHash: tokenHash,
        shareTokenEncrypted: tokenEncrypted,
        shareTokenCreatedAt: new Date(),
      },
    });

    return {
      token: rawToken,
      sessionId: sessionIdInt,
    };
  }

  async getSessionShareLink(sessionId, userId) {
    const session = await this.queryService.getSessionById(sessionId, userId);

    if (session.visibility !== 'LINK_ONLY') {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'Share link is available only for LINK_ONLY sessions'
      );
    }

    if (!this._isSessionOwner(session, userId)) {
      throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY);
    }

    const stored = await prisma.session.findUnique({
      where: { id: this._parsePositiveInt(sessionId, 'ID СЃРµСЃС–С—') },
      select: { shareTokenEncrypted: true },
    });

    if (!stored?.shareTokenEncrypted) {
      return {
        token: null,
        shareUrl: null,
      };
    }

    const token = decryptShareToken(stored.shareTokenEncrypted);

    return {
      token,
      shareUrl: `${config.frontendUrl}/session/share/${token}`,
    };
  }
}

module.exports = new SessionService();
