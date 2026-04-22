const {
  applySessionDiscoveryFilter,
  buildNestedCampaignSelectForViewer,
  sanitizeNestedCampaignForSession,
} = require('../../domain/access/discovery.policy');

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIME_ZONE = 'UTC';

function isValidTimeZone(timeZone) {
  if (!timeZone) return false;

  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

async function resolveCalendarTimeZone(prisma, userId = null, requestedTimeZone = null) {
  if (isValidTimeZone(requestedTimeZone)) {
    return requestedTimeZone;
  }

  if (userId && prisma.user?.findUnique) {
    const viewer = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    if (isValidTimeZone(viewer?.timezone)) {
      return viewer.timezone;
    }
  }

  return DEFAULT_TIME_ZONE;
}

function getDateKeyInTimeZone(dateValue, timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateValue));
}

function getMonthKeyFromDateKey(dateKey) {
  return dateKey.slice(0, 7);
}

function createExpandedMonthRange(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const monthStartUtc = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const nextMonthStartUtc = Date.UTC(year, month, 1, 0, 0, 0, 0);

  return {
    startDate: new Date(monthStartUtc - DAY_IN_MS),
    endDate: new Date(nextMonthStartUtc + DAY_IN_MS - 1),
  };
}

function createExpandedDayRange(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayStartUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  return {
    startDate: new Date(dayStartUtc - DAY_IN_MS),
    endDate: new Date(dayStartUtc + DAY_IN_MS * 2 - 1),
  };
}

function appendAndClause(whereCondition, clause) {
  whereCondition.AND = whereCondition.AND || [];
  whereCondition.AND.push(clause);
}

function applySearchFilters(whereCondition, filters = {}) {
  if (!filters) return;

  if (filters.system) {
    appendAndClause(whereCondition, {
      OR: [
        { system: { contains: filters.system, mode: 'insensitive' } },
        {
          campaign: {
            system: { contains: filters.system, mode: 'insensitive' },
          },
        },
      ],
    });
  }

  if (filters.searchQuery) {
    appendAndClause(whereCondition, {
      OR: [
        { title: { contains: filters.searchQuery, mode: 'insensitive' } },
        { description: { contains: filters.searchQuery, mode: 'insensitive' } },
      ],
    });
  }
}

function createSessionCalendarService({ prisma, AppError, ERROR_CODES }) {
  return {
    async getCalendar(userId, options = {}) {
      const { year, month, type = 'MY', timeZone: requestedTimeZone = null } = options;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const { startDate, endDate } = createExpandedMonthRange(monthKey);
      const timeZone = await resolveCalendarTimeZone(prisma, userId, requestedTimeZone);

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
        applySessionDiscoveryFilter(whereCondition, null);
      } else if (type === 'ALL') {
        applySessionDiscoveryFilter(whereCondition, userId);
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
        const dateKey = getDateKeyInTimeZone(session.date, timeZone);
        if (getMonthKeyFromDateKey(dateKey) !== monthKey) {
          return;
        }
        calendar[dateKey] = (calendar[dateKey] || 0) + 1;
      });

      return calendar;
    },

    async getCalendarStats(userId, options = {}) {
      const {
        month,
        scope = 'global',
        filters = {},
        timeZone: requestedTimeZone = null,
      } = options;
      const monthKey = String(month).slice(0, 7);
      const { startDate, endDate } = createExpandedMonthRange(monthKey);
      const timeZone = await resolveCalendarTimeZone(prisma, userId, requestedTimeZone);

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
        applySessionDiscoveryFilter(whereCondition, userId);
      } else if (scope === 'search') {
        applySessionDiscoveryFilter(whereCondition, userId);
      }

      applySearchFilters(whereCondition, filters);

      const sessions = await prisma.session.findMany({
        where: whereCondition,
        select: {
          id: true,
          date: true,
          system: true,
          visibility: true,
          campaignId: true,
          campaign: {
            select: buildNestedCampaignSelectForViewer(userId),
          },
        },
      });

      const stats = {};
      sessions.forEach((session) => {
        const dateKey = getDateKeyInTimeZone(session.date, timeZone);
        if (getMonthKeyFromDateKey(dateKey) !== monthKey) {
          return;
        }
        if (filters.dateFrom && dateKey < filters.dateFrom) {
          return;
        }
        if (filters.dateTo && dateKey > filters.dateTo) {
          return;
        }
        if (!stats[dateKey]) {
          stats[dateKey] = {
            count: 0,
            sessions: [],
          };
        }
        stats[dateKey].count += 1;

        const campaignReference = sanitizeNestedCampaignForSession(session, userId);

        const sessionInfo = {
          system: session.system || session.campaign?.system || null,
          campaignTitle: campaignReference?.title || null,
          campaignId: campaignReference?.id || null,
        };

        stats[dateKey].sessions.push(sessionInfo);
      });

      return stats;
    },

    async getSessionsByDayFiltered(
      userId,
      dateString,
      scope = 'global',
      filters = {},
      requestedTimeZone = null
    ) {
      const { startDate, endDate } = createExpandedDayRange(dateString);
      const timeZone = await resolveCalendarTimeZone(prisma, userId, requestedTimeZone);

      const whereCondition = {
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'CANCELED' },
      };

      if (scope === 'user') {
        if (!userId) {
          throw new AppError(ERROR_CODES.AUTH_TOKEN_MISSING, 'Необхідна авторизація');
        }
        whereCondition.participants = { some: { userId } };
      } else if (scope === 'global' || scope === 'search') {
        applySessionDiscoveryFilter(whereCondition, userId);
      }

      applySearchFilters(whereCondition, filters);

      const sessions = await prisma.session.findMany({
        where: whereCondition,
        include: {
          owner: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          campaign: {
            select: buildNestedCampaignSelectForViewer(userId),
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

      return sessions
        .filter((session) => getDateKeyInTimeZone(session.date, timeZone) === dateString)
        .map((session) => {
        const sanitizedCampaign = sanitizeNestedCampaignForSession(session, userId);
        const myParticipation = userId
          ? session.participants.find((participant) => participant.userId === userId)
          : null;

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
