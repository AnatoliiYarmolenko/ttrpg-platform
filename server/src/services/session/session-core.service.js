function createSessionCoreService({
  prisma,
  AppError,
  ERROR_CODES,
  config,
  selectNextRelevantSession,
  datetimeHelpers,
  sessionQueryService,
  assertNoSessionTimeConflict,
  createRawEncryptedAndHashedShareToken,
}) {
  const assertSessionVisibilityForCreation = ({ campaignId, visibility }) => {
    if (campaignId && visibility === 'LINK_ONLY') {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'LINK_ONLY is allowed only for one-shot sessions'
      );
    }
  };

  const buildPublicCalendarVisibilityFilterForUser = (userId = null) => {
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
        OR: [
          { ownerId: userId },
          { participants: { some: { userId } } },
        ],
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
          {
            ownerId: userId,
          },
        ],
      },
      {
        campaignId: { not: null },
        visibility: 'LINK_ONLY',
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
          {
            ownerId: userId,
          },
        ],
      },
    ];
  };

  const assertNoSessionTimeConflictFn = assertNoSessionTimeConflict || (async (userId, targetStart, targetDuration, options = {}) => {
    return datetimeHelpers._assertNoSessionTimeConflict(
      { prisma, AppError, ERROR_CODES },
      userId,
      targetStart,
      targetDuration,
      options
    );
  });

  return {
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

      await assertNoSessionTimeConflictFn(ownerId, date, duration, {
        conflictErrorCode: ERROR_CODES.SESSION_TIME_CONFLICT_OWNER,
      });

      assertSessionVisibilityForCreation({ campaignId, visibility });

      if (campaignId) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: sessionQueryService.parsePositiveInt(campaignId, 'Campaign ID') },
          include: {
            members: {
              where: { userId: ownerId },
              select: { role: true },
            },
          },
        });

        if (!campaign) {
          throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND);
        }

        if (campaign.status === 'FINISHED') {
          throw new AppError(ERROR_CODES.CAMPAIGN_FINISHED);
        }

        const memberRole = campaign.members[0]?.role;
        if (!memberRole || !['OWNER', 'GM'].includes(memberRole)) {
          throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED);
        }

        if (!sessionSystem && campaign.system) {
          sessionSystem = campaign.system;
        }
      }

      const shareTokenData = visibility === 'LINK_ONLY'
        ? createRawEncryptedAndHashedShareToken()
        : null;

      const session = await prisma.session.create({
        data: {
          title,
          description: description || null,
          date,
          duration,
          maxPlayers,
          price,
          system: sessionSystem || null,
          campaignId: campaignId ? sessionQueryService.parsePositiveInt(campaignId, 'Campaign ID') : null,
          ownerId,
          visibility,
          shareTokenHash: shareTokenData?.tokenHash || null,
          shareTokenEncrypted: shareTokenData?.tokenEncrypted || null,
          shareTokenCreatedAt: shareTokenData ? new Date() : null,
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

      if (shareTokenData) {
        session.shareToken = shareTokenData.rawToken;
      }

      delete session.shareTokenHash;
      delete session.shareTokenEncrypted;
      delete session.shareTokenCreatedAt;

      return session;
    },

    async getMySessions(userId, options = {}) {
      const { status, role = 'ALL', limit, offset = 0 } = options;

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

      const queryOptions = {
        orderBy: { date: 'asc' },
      };

      if (Number.isInteger(offset) && offset > 0) {
        queryOptions.skip = offset;
      }

      if (Number.isInteger(limit) && limit > 0) {
        queryOptions.take = limit;
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
        ...queryOptions,
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
    },

    async getNextRelevantSessionForUser(userId, options = {}) {
      if (!userId) {
        throw new AppError(ERROR_CODES.AUTH_TOKEN_MISSING);
      }

      const sessions = await prisma.session.findMany({
        where: {
          participants: {
            some: {
              userId,
            },
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          date: true,
          status: true,
          visibility: true,
          maxPlayers: true,
          system: true,
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          campaign: {
            select: { id: true, title: true, description: true, status: true, system: true },
          },
          participants: {
            select: {
              userId: true,
              role: true,
              status: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: [
          { date: 'asc' },
          { id: 'asc' },
        ],
      });

      const hydratedSessions = sessions.map((session) => {
        const myParticipation = session.participants.find((participant) => participant.userId === userId);

        return {
          ...session,
          startAt: session.date,
          maxPlayers: session.maxPlayers,
          myRole: myParticipation?.role || null,
          myStatus: myParticipation?.status || null,
          participantsCount: session.participants.length,
          currentPlayers: session.participants.filter((participant) => participant.role === 'PLAYER').length,
        };
      });

      const plannedToleranceMinutes = options.plannedToleranceMinutes ?? config?.homePlannedToleranceMinutes;

      const selected = selectNextRelevantSession(hydratedSessions, {
        now: options.now,
        activeMaxAgeHours: options.activeMaxAgeHours ?? config?.homeActiveMaxAgeHours,
        plannedToleranceMinutes,
      });

      if (!selected) {
        return null;
      }

      const confirmedGm = selected.participants?.find(
        (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
      );

      return {
        id: selected.id,
        title: selected.title,
        description: selected.description ?? selected.campaign?.description ?? null,
        startAt: selected.startAt ? new Date(selected.startAt).toISOString() : null,
        status: selected.status,
        visibility: selected.visibility,
        system: selected.system ?? selected.campaign?.system ?? null,
        myRole: selected.myRole,
        myStatus: selected.myStatus,
        plannedToleranceMinutes,
        organizerName: selected.owner?.displayName || selected.owner?.username || null,
        confirmedGmName: confirmedGm?.user?.displayName || confirmedGm?.user?.username || null,
        campaign: selected.campaign
          ? {
            id: selected.campaign.id,
            title: selected.campaign.title,
            status: selected.campaign.status,
            system: selected.campaign.system ?? null,
          }
          : null,
        maxPlayers: selected.maxPlayers,
        participantsCount: selected.participantsCount,
        currentPlayers: selected.currentPlayers,
      };
    },

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
          throw new AppError(ERROR_CODES.AUTH_TOKEN_MISSING);
        }
        whereCondition.participants = { some: { userId } };
      } else if (type === 'PUBLIC') {
        whereCondition.OR = buildPublicCalendarVisibilityFilterForUser(userId);
      } else if (type === 'ALL') {
        const publicVisibilityFilter = buildPublicCalendarVisibilityFilterForUser(userId);
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
    },

    async getCampaignSessions(campaignId, userId, options = {}) {
      const { limit = 20, offset = 0 } = options;
      const campaignIdInt = sessionQueryService.parsePositiveInt(campaignId, 'Campaign ID');

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
        throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND);
      }

      if (!campaign.members.length && campaign.ownerId !== userId) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED);
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
    },
  };
}

module.exports = createSessionCoreService;
