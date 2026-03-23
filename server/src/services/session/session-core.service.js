function createSessionCoreService({
  prisma,
  AppError,
  ERROR_CODES,
  datetimeHelpers,
  sessionQueryService,
  assertNoSessionTimeConflict,
}) {
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

      if (campaignId) {
        if (visibility === 'LINK_ONLY') {
          throw new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            'Для сесії в кампанії тип "LINK_ONLY" більше не підтримується'
          );
        }

        const campaign = await prisma.campaign.findUnique({
          where: { id: sessionQueryService.parsePositiveInt(campaignId, 'ID кампанії') },
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
          campaignId: campaignId ? sessionQueryService.parsePositiveInt(campaignId, 'ID кампанії') : null,
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
    },

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
          throw new AppError(ERROR_CODES.AUTH_TOKEN_MISSING, 'Необхідна авторизація');
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
      const campaignIdInt = sessionQueryService.parsePositiveInt(campaignId, 'ID кампанії');

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
    },
  };
}

module.exports = createSessionCoreService;