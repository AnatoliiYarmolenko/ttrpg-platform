function buildEntitledCampaignSessionFilter(userId) {
  return {
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
  };
}

function buildEntitledOneShotLinkOnlyFilter(userId) {
  return {
    OR: [
      {
        ownerId: userId,
      },
      {
        participants: {
          some: { userId },
        },
      },
    ],
  };
}

function buildCalendarVisibilityFilter(userId = null) {
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
      ...buildEntitledOneShotLinkOnlyFilter(userId),
    },
    {
      campaignId: { not: null },
      visibility: 'PUBLIC',
    },
    {
      campaignId: { not: null },
      visibility: 'PRIVATE',
      ...buildEntitledCampaignSessionFilter(userId),
    },
    {
      campaignId: { not: null },
      visibility: 'LINK_ONLY',
      ...buildEntitledCampaignSessionFilter(userId),
    },
  ];
}

function applyCalendarVisibilityFilter(whereCondition, userId = null) {
  whereCondition.AND = whereCondition.AND || [];
  whereCondition.AND.push({ OR: buildCalendarVisibilityFilter(userId) });
}

function isCampaignInfoHiddenForViewer(session, userId = null) {
  if (!session?.campaign) return false;

  const isPublicCampaignSession = Boolean(session.campaignId) && session.visibility === 'PUBLIC';
  const isLinkOnlyCampaign = session.campaign.visibility === 'LINK_ONLY';

  if (!isPublicCampaignSession || !isLinkOnlyCampaign) {
    return false;
  }

  if (!userId) return true;

  const isCampaignOwner = session.campaign.ownerId === userId;
  const isCampaignMember = Array.isArray(session.campaign.members)
    && session.campaign.members.some((member) => member.userId === userId);

  return !isCampaignOwner && !isCampaignMember;
}

function buildCampaignSelectForViewer(userId = null) {
  const campaignSelect = {
    id: true,
    title: true,
    system: true,
    visibility: true,
    ownerId: true,
  };

  if (userId) {
    campaignSelect.members = {
      where: { userId },
      select: { userId: true },
    };
  }

  return campaignSelect;
}

function createSessionCalendarService({ prisma, AppError, ERROR_CODES }) {
  return {
    async getCalendar(userId, options = {}) {
      const { year, month, type = 'MY' } = options;

      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const endDate = new Date(Date.UTC(year, month - 1, lastDayOfMonth, 23, 59, 59, 999));

      const whereCondition = {
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'CANCELED' },
      };

      if (type === 'MY') {
        if (!userId) {
          throw new AppError(
            ERROR_CODES.AUTH_TOKEN_MISSING,
            'Необхідна авторизація для перегляду особистого календаря'
          );
        }
        whereCondition.participants = { some: { userId } };
      } else if (type === 'PUBLIC') {
        applyCalendarVisibilityFilter(whereCondition, null);
      } else if (type === 'ALL') {
        applyCalendarVisibilityFilter(whereCondition, userId);
      }

      const sessions = await prisma.session.findMany({
        where: whereCondition,
        select: {
          id: true,
          date: true,
        },
      });

      const calendar = {};
      sessions.forEach((session) => {
        const dateKey = session.date.toISOString().split('T')[0];
        calendar[dateKey] = (calendar[dateKey] || 0) + 1;
      });

      return calendar;
    },

    async getCalendarStats(userId, options = {}) {
      const { month, scope = 'global', filters = {} } = options;

      const monthDate = new Date(month);
      const year = monthDate.getUTCFullYear();
      const monthNum = monthDate.getUTCMonth();

      const startDate = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0, 0));
      const lastDayOfMonth = new Date(Date.UTC(year, monthNum + 1, 0)).getUTCDate();
      const endDate = new Date(Date.UTC(year, monthNum, lastDayOfMonth, 23, 59, 59, 999));

      const whereCondition = {
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'CANCELED' },
      };

      if (scope === 'user') {
        if (!userId) {
          throw new AppError(
            ERROR_CODES.AUTH_TOKEN_MISSING,
            'Необхідна авторизація для перегляду особистого календаря'
          );
        }
        whereCondition.participants = { some: { userId } };
      } else if (scope === 'global') {
        applyCalendarVisibilityFilter(whereCondition, userId);
      } else if (scope === 'search') {
        applyCalendarVisibilityFilter(whereCondition, userId);
      }

      if (filters) {
        if (filters.system) {
          whereCondition.OR = whereCondition.OR || [];
          whereCondition.OR.push(
            { system: { contains: filters.system, mode: 'insensitive' } },
            {
              campaign: {
                system: { contains: filters.system, mode: 'insensitive' },
              },
            }
          );
        }

        if (filters.dateFrom) {
          whereCondition.date = {
            ...whereCondition.date,
            gte: new Date(filters.dateFrom),
          };
        }

        if (filters.dateTo) {
          whereCondition.date = {
            ...whereCondition.date,
            lte: new Date(filters.dateTo),
          };
        }

        if (filters.searchQuery) {
          const existingOr = whereCondition.OR || [];
          whereCondition.OR = [
            ...existingOr,
            { title: { contains: filters.searchQuery, mode: 'insensitive' } },
            { description: { contains: filters.searchQuery, mode: 'insensitive' } },
          ];
        }
      }

      const sessions = await prisma.session.findMany({
        where: whereCondition,
        select: {
          id: true,
          date: true,
          system: true,
          visibility: true,
          campaignId: true,
          campaign: {
            select: buildCampaignSelectForViewer(userId),
          },
        },
      });

      const stats = {};
      sessions.forEach((session) => {
        const dateKey = session.date.toISOString().split('T')[0];
        if (!stats[dateKey]) {
          stats[dateKey] = {
            count: 0,
            sessions: [],
          };
        }
        stats[dateKey].count += 1;

        const hideCampaignInfo = isCampaignInfoHiddenForViewer(session, userId);

        const sessionInfo = {
          system: session.system || session.campaign?.system || null,
          campaignTitle: hideCampaignInfo ? null : (session.campaign?.title || null),
          campaignId: hideCampaignInfo ? null : (session.campaign?.id || null),
        };

        stats[dateKey].sessions.push(sessionInfo);
      });

      return stats;
    },

    async getSessionsByDayFiltered(userId, dateString, scope = 'global', filters = {}) {
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

      if (scope === 'user') {
        if (!userId) {
          throw new AppError(ERROR_CODES.AUTH_TOKEN_MISSING, 'Необхідна авторизація');
        }
        whereCondition.participants = { some: { userId } };
      } else if (scope === 'global' || scope === 'search') {
        applyCalendarVisibilityFilter(whereCondition, userId);
      }

      if (filters) {
        if (filters.system) {
          whereCondition.OR = whereCondition.OR || [];
          whereCondition.OR.push(
            { system: { contains: filters.system, mode: 'insensitive' } },
            {
              campaign: {
                system: { contains: filters.system, mode: 'insensitive' },
              },
            }
          );
        }

        if (filters.searchQuery) {
          const existingOr = whereCondition.OR || [];
          whereCondition.OR = [
            ...existingOr,
            { title: { contains: filters.searchQuery, mode: 'insensitive' } },
            { description: { contains: filters.searchQuery, mode: 'insensitive' } },
          ];
        }
      }

      const sessions = await prisma.session.findMany({
        where: whereCondition,
        include: {
          owner: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          campaign: {
            select: buildCampaignSelectForViewer(userId),
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

      return sessions.map((session) => {
        const hideCampaignInfo = isCampaignInfoHiddenForViewer(session, userId);
        const myParticipation = userId
          ? session.participants.find((participant) => participant.userId === userId)
          : null;

        const sanitizedCampaign = hideCampaignInfo
          ? null
          : (session.campaign
            ? {
              id: session.campaign.id,
              title: session.campaign.title,
              system: session.campaign.system,
              visibility: session.campaign.visibility,
            }
            : null);

        return {
          ...session,
          campaign: sanitizedCampaign,
          myRole: myParticipation?.role || null,
          myStatus: myParticipation?.status || null,
          currentPlayers: session.participants.filter((participant) => participant.role === 'PLAYER').length,
        };
      });
    },
  };
}

module.exports = createSessionCalendarService;
