const { prisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');

const datetimeHelpers = require('./session/session-datetime.helpers');
const permissionHelpers = require('./session/session-permission.helpers');
const createSessionCalendarService = require('./session/session-calendar.service');
const createSessionParticipantsService = require('./session/session-participants.service');

class SessionService {
  constructor() {
    this.calendarService = createSessionCalendarService({ prisma, AppError, ERROR_CODES });
    this.participantsService = createSessionParticipantsService({
      prisma,
      AppError,
      ERROR_CODES,
      getSessionById: this.getSessionById.bind(this),
      resolveSessionContext: this._resolveSessionContext.bind(this),
      assertNoSessionTimeConflict: this._assertNoSessionTimeConflict.bind(this),
      permissionHelpers,
    });
  }

  _parsePositiveInt(value, label = 'ID') {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, `${label} повинен бути позитивним числом`);
    }

    return parsed;
  }

  async _resolveSessionContext(sessionId, userId, preloadedSession = null) {
    const sessionIdInt = this._parsePositiveInt(sessionId, 'ID сесії');

    if (preloadedSession && preloadedSession.id === sessionIdInt) {
      return preloadedSession;
    }

    return this.getSessionById(sessionIdInt, userId);
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
    const {
      title,
      description,
      date,
      duration,
      maxPlayers,
      price,
      campaignId,
      ownerId,
      isGm = true,
      visibility,
      system,
    } = data;

    let sessionSystem = system;

    await this._assertNoSessionTimeConflict(ownerId, date, duration, {
      conflictErrorCode: ERROR_CODES.SESSION_TIME_CONFLICT_OWNER,
    });

    if (campaignId) {
      if (visibility === 'LINK_ONLY') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Для сесії в кампанії тип "LINK_ONLY" більше не підтримується'
        );
      }

      const campaign = await prisma.campaign.findUnique({
        where: { id: this._parsePositiveInt(campaignId, 'ID кампанії') },
        include: {
          members: {
            where: { userId: ownerId },
            select: { role: true },
          },
        },
      });

      if (!campaign) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Кампанія не знайдена');
      }

      if (campaign.status === 'FINISHED') {
        throw new AppError(
          ERROR_CODES.CAMPAIGN_FINISHED,
          'Не можна створювати сесії в завершеній кампанії'
        );
      }

      const memberRole = campaign.members[0]?.role;
      if (!memberRole || !['OWNER', 'GM'].includes(memberRole)) {
        throw new AppError(
          ERROR_CODES.SECURITY_ACCESS_DENIED,
          'Ви не маєте права створювати сесії в цій кампанії'
        );
      }

      if (!sessionSystem && campaign.system) {
        sessionSystem = campaign.system;
      }
    }

    const session = await prisma.session.create({
      data: {
        title,
        description: description || null,
        date,
        duration,
        maxPlayers,
        price,
        system: sessionSystem || null,
        campaignId: campaignId ? this._parsePositiveInt(campaignId, 'ID кампанії') : null,
        ownerId,
        visibility,
        participants: {
          create: {
            userId: ownerId,
            role: isGm ? 'GM' : 'PLAYER',
            status: 'CONFIRMED',
            isGuest: false,
          },
        },
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        campaign: {
          select: { id: true, title: true, status: true, system: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return session;
  }

  async getMySessions(userId, options = {}) {
    const { status, role = 'ALL', limit = 20, offset = 0 } = options;

    const whereCondition = {
      participants: {
        some: {
          userId,
        },
      },
    };

    if (status) {
      whereCondition.status = status;
    }

    if (role !== 'ALL') {
      whereCondition.participants = {
        some: {
          userId,
          role,
        },
      };
    }

    const sessions = await prisma.session.findMany({
      where: whereCondition,
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        campaign: {
          select: { id: true, title: true, status: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
      skip: offset,
      take: limit,
    });

    return sessions.map((session) => {
      const myParticipation = session.participants.find((participant) => participant.userId === userId);
      return {
        ...session,
        myRole: myParticipation?.role || null,
        myStatus: myParticipation?.status || null,
        currentPlayers: session.participants.filter((participant) => participant.role === 'PLAYER').length,
      };
    });
  }

  async getCalendar(userId, options = {}) {
    return this.calendarService.getCalendar(userId, options);
  }

  async getCalendarStats(userId, options = {}) {
    return this.calendarService.getCalendarStats(userId, options);
  }

  async getSessionsByDayFiltered(userId, dateString, scope = 'global', filters = {}) {
    return this.calendarService.getSessionsByDayFiltered(userId, dateString, scope, filters);
  }

  async getSessionById(sessionId, userId = null) {
    const sessionIdInt = this._parsePositiveInt(sessionId, 'ID сесії');

    const session = await prisma.session.findUnique({
      where: { id: sessionIdInt },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        campaign: {
          select: { id: true, title: true, visibility: true, ownerId: true, status: true, system: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
          orderBy: { role: 'asc' },
        },
      },
    });

    if (!session) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Сесія не знайдена');
    }

    const isCampaignSession = Boolean(session.campaignId);
    const isParticipant = Boolean(
      userId && session.participants.some((participant) => participant.userId === userId)
    );
    const isOwner = Boolean(userId && session.ownerId === userId);
    const isCampaignOwner = Boolean(userId && session.campaign?.ownerId === userId);

    let isCampaignMember = false;
    if (isCampaignSession && userId) {
      const campaignMembership = await prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: session.campaignId,
          },
        },
        select: { userId: true },
      });

      isCampaignMember = Boolean(campaignMembership) || isCampaignOwner;
    }

    if (session.visibility === 'PRIVATE') {
      if (!userId) {
        throw new AppError(
          ERROR_CODES.SECURITY_ACCESS_DENIED,
          'У вас немає доступу до цієї сесії'
        );
      }

      const canAccessPrivateSession = !isCampaignSession
        || isParticipant
        || isOwner
        || isCampaignOwner
        || isCampaignMember;

      if (!canAccessPrivateSession) {
        throw new AppError(
          ERROR_CODES.SECURITY_ACCESS_DENIED,
          'У вас немає доступу до цієї сесії'
        );
      }
    }

    session.viewer = {
      isParticipant,
      isCampaignMember,
      isSessionOwner: isOwner,
      isCampaignOwner,
    };

    return session;
  }

  async updateSession(sessionId, requesterId, updateData, options = {}) {
    const { preloadedSession = null } = options;
    const session = await this._resolveSessionContext(sessionId, requesterId, preloadedSession);
    const normalizedUpdateData = { ...updateData };

    const sessionDate = new Date(session.date);
    const isSessionInPast =
      !Number.isNaN(sessionDate.getTime()) && sessionDate.getTime() < Date.now();
    const settingsFields = [
      'title',
      'description',
      'date',
      'duration',
      'maxPlayers',
      'price',
      'visibility',
      'system',
    ];
    const hasSettingsUpdate = settingsFields.some((field) =>
      Object.prototype.hasOwnProperty.call(normalizedUpdateData, field)
    );
    const hasStatusUpdate = Object.prototype.hasOwnProperty.call(
      normalizedUpdateData,
      'status'
    );

    if (hasSettingsUpdate && !this._canEditSessionSettings(session, requesterId)) {
      throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY);
    }

    if (
      session.campaignId
      && normalizedUpdateData.visibility === 'LINK_ONLY'
    ) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'Для сесії в кампанії тип "LINK_ONLY" більше не підтримується'
      );
    }

    if (hasSettingsUpdate && session.campaign?.status === 'FINISHED') {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_FINISHED,
        'Неможливо змінювати налаштування сесії в завершеній кампанії'
      );
    }

    if (hasStatusUpdate && !this._canChangeSessionStatus(session, requesterId)) {
      throw new AppError(ERROR_CODES.SESSION_GM_ONLY);
    }

    if (isSessionInPast && hasSettingsUpdate) {
      if (!hasStatusUpdate) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Неможливо змінювати налаштування сесії, яка вже відбулася'
        );
      }

      settingsFields.forEach((field) => {
        delete normalizedUpdateData[field];
      });
    }

    const hasDateChange = normalizedUpdateData.date !== undefined;
    const hasDurationChange = normalizedUpdateData.duration !== undefined;
    if (hasDateChange || hasDurationChange) {
      const targetDate = hasDateChange ? normalizedUpdateData.date : session.date;
      const targetDuration = hasDurationChange ? normalizedUpdateData.duration : session.duration;

      await this._assertNoSessionTimeConflict(session.ownerId, targetDate, targetDuration, {
        excludeSessionId: session.id,
        conflictErrorCode: ERROR_CODES.SESSION_TIME_CONFLICT_OWNER,
      });
    }

    const nextStatus = normalizedUpdateData.status;
    const isPlannedToActiveTransition = session.status === 'PLANNED' && nextStatus === 'ACTIVE';
    const isPlannedToFinishedTransition = session.status === 'PLANNED' && nextStatus === 'FINISHED';

    if (nextStatus && nextStatus !== session.status) {
      const allowedStatusTransitions = {
        PLANNED: ['ACTIVE', 'FINISHED', 'CANCELED'],
        ACTIVE: ['FINISHED', 'CANCELED'],
        FINISHED: [],
        CANCELED: [],
      };

      const allowedNextStatuses = allowedStatusTransitions[session.status] || [];
      if (!allowedNextStatuses.includes(nextStatus)) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Невалідний перехід статусу: ${session.status} → ${nextStatus}`
        );
      }
    }

    if (isPlannedToActiveTransition) {
      const now = new Date();
      const requester = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { timezone: true },
      });
      const userTimeZone = requester?.timezone || 'Europe/Kyiv';

      if (!this._isSameDayInTimeZone(now, sessionDate, userTimeZone)) {
        throw new AppError(ERROR_CODES.SESSION_START_ONLY_ON_SCHEDULED_DAY);
      }
    }

    if (isPlannedToFinishedTransition) {
      const now = new Date();
      const finishAllowedAt = this._getSessionEndWithGrace(session.date, session.duration, 2);

      if (now < finishAllowedAt) {
        throw new AppError(ERROR_CODES.SESSION_MARK_FINISHED_TOO_EARLY);
      }
    }

    const hasField = (field) =>
      Object.prototype.hasOwnProperty.call(normalizedUpdateData, field);

    const updated = await prisma.session.update({
      where: { id: this._parsePositiveInt(sessionId, 'ID сесії') },
      data: {
        title: hasField('title') ? normalizedUpdateData.title : undefined,
        description: hasField('description') ? normalizedUpdateData.description : undefined,
        date: hasField('date') ? normalizedUpdateData.date : undefined,
        duration: hasField('duration') ? normalizedUpdateData.duration : undefined,
        maxPlayers: hasField('maxPlayers') ? normalizedUpdateData.maxPlayers : undefined,
        price: hasField('price') ? normalizedUpdateData.price : undefined,
        visibility: hasField('visibility') ? normalizedUpdateData.visibility : undefined,
        status: hasField('status') ? normalizedUpdateData.status : undefined,
        system: hasField('system') ? normalizedUpdateData.system : undefined,
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        campaign: {
          select: { id: true, title: true, status: true, system: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return updated;
  }

  async deleteSession(sessionId, requesterId, options = {}) {
    const { preloadedSession = null } = options;
    const session = await this._resolveSessionContext(sessionId, requesterId, preloadedSession);

    const canDelete = this._isSessionOwner(session, requesterId)
      || this._isCampaignOwnerOverride(session, requesterId);

    if (!canDelete) {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'У вас немає прав на видалення сесії');
    }

    await prisma.session.delete({
      where: { id: this._parsePositiveInt(sessionId, 'ID сесії') },
    });
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
    const [year, month, day] = dateString.split('-').map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const whereCondition = {
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: { not: 'CANCELED' },
    };

    if (type === 'MY') {
      if (!userId) {
        throw new AppError(ERROR_CODES.AUTH_TOKEN_MISSING, 'Необхідна авторизація');
      }
      whereCondition.participants = { some: { userId } };
    } else if (type === 'PUBLIC') {
      whereCondition.OR = this._buildPublicCalendarVisibilityFilterForUser(userId);
    } else if (type === 'ALL') {
      const publicVisibilityFilter = this._buildPublicCalendarVisibilityFilterForUser(userId);
      if (userId) {
        whereCondition.OR = [
          ...publicVisibilityFilter,
          { participants: { some: { userId } } },
        ];
      } else {
        whereCondition.OR = publicVisibilityFilter;
      }
    }

    const sessions = await prisma.session.findMany({
      where: whereCondition,
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        campaign: {
          select: { id: true, title: true, status: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    return sessions;
  }

  async getCampaignSessions(campaignId, userId, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const campaignIdInt = this._parsePositiveInt(campaignId, 'ID кампанії');

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignIdInt },
      include: {
        members: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Кампанія не знайдена');
    }

    if (!campaign.members.length && campaign.ownerId !== userId) {
      throw new AppError(
        ERROR_CODES.SECURITY_ACCESS_DENIED,
        'У вас немає доступу до цієї кампанії'
      );
    }

    const sessions = await prisma.session.findMany({
      where: { campaignId: campaignIdInt },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
      skip: offset,
      take: limit,
    });

    return sessions;
  }

  async cancelSession(sessionId, userId, options = {}) {
    const { preloadedSession = null } = options;
    const session = await this._resolveSessionContext(sessionId, userId, preloadedSession);

    const isOwner = this._isSessionOwner(session, userId);
    const isCampaignOwner = this._isCampaignOwnerOverride(session, userId);
    const isConfirmedGm = this._canChangeSessionStatus(session, userId);
    const canCancel = isOwner || isCampaignOwner || (session.status === 'ACTIVE' && isConfirmedGm);

    if (!canCancel) {
      const errorCode = session.status === 'ACTIVE'
        ? ERROR_CODES.SESSION_GM_ONLY
        : ERROR_CODES.SESSION_OWNER_ONLY;
      const message = session.status === 'ACTIVE'
        ? 'Скасувати ACTIVE сесію може тільки підтверджений GM, власник сесії або власник кампанії'
        : 'Скасувати сесію може тільки власник сесії або власник кампанії';
      throw new AppError(errorCode, message);
    }

    if (session.status === 'FINISHED') {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'Не можна скасувати вже завершену сесію'
      );
    }

    if (session.status === 'CANCELED') {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'Сесія вже скасована'
      );
    }

    const updatedSession = await prisma.session.update({
      where: { id: this._parsePositiveInt(sessionId, 'ID сесії') },
      data: {
        status: 'CANCELED',
      },
      include: {
        owner: { select: { id: true, username: true } },
        participants: {
          include: {
            user: { select: { id: true, email: true, username: true } },
          },
        },
      },
    });

    return updatedSession;
  }

  async markSessionAsFinished(sessionId, userId, options = {}) {
    return this.updateSession(sessionId, userId, { status: 'FINISHED' }, options);
  }
}

module.exports = new SessionService();