const { prisma } = require('../lib/prisma');

function buildCampaignSearchWhere({ query, system }) {
  const where = {
    visibility: 'PUBLIC',
  };

  if (query && query.trim()) {
    where.OR = [
      { title: { contains: query.trim(), mode: 'insensitive' } },
      { description: { contains: query.trim(), mode: 'insensitive' } },
    ];
  }

  if (system && system.trim()) {
    where.system = { contains: system.trim(), mode: 'insensitive' };
  }

  return where;
}

function resolveCampaignOrderBy(sortBy) {
  switch (sortBy) {
    case 'popular':
      return { members: { _count: 'desc' } };
    case 'title':
      return { title: 'asc' };
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
}

function formatCampaignSearchResult(campaign) {
  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    imageUrl: campaign.imageUrl,
    system: campaign.system,
    visibility: campaign.visibility,
    owner: campaign.owner,
    membersCount: campaign._count.members,
    sessionsCount: campaign._count.sessions,
    createdAt: campaign.createdAt,
  };
}

function buildSessionSearchWhere({
  query,
  system,
  dateFrom,
  dateTo,
  minPrice,
  maxPrice,
  oneShot,
}) {
  const where = {
    visibility: 'PUBLIC',
    status: { in: ['PLANNED', 'ACTIVE'] },
  };

  if (query && query.trim()) {
    where.OR = [
      { title: { contains: query.trim(), mode: 'insensitive' } },
      { description: { contains: query.trim(), mode: 'insensitive' } },
    ];
  }

  if (system && system.trim()) {
    where.campaign = {
      system: { contains: system.trim(), mode: 'insensitive' },
    };
  }

  if (dateFrom || dateTo) {
    where.date = {};

    if (dateFrom) {
      where.date.gte = new Date(dateFrom);
    }

    if (dateTo) {
      where.date.lte = new Date(dateTo);
    }
  } else {
    where.date = { gte: new Date() };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};

    if (minPrice !== undefined) {
      where.price.gte = minPrice;
    }

    if (maxPrice !== undefined) {
      where.price.lte = maxPrice;
    }
  }

  if (oneShot === true) {
    where.campaignId = null;
  }

  return where;
}

function resolveSessionOrderBy(sortBy) {
  switch (sortBy) {
    case 'price':
      return { price: 'asc' };
    case 'newest':
      return { createdAt: 'desc' };
    case 'date':
    default:
      return { date: 'asc' };
  }
}

function buildSessionSearchQuery(where, orderBy) {
  return {
    where,
    include: {
      owner: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      campaign: {
        select: { id: true, title: true, system: true },
      },
      participants: {
        select: { id: true, role: true, status: true },
      },
      _count: {
        select: { participants: true },
      },
    },
    orderBy,
  };
}

function countConfirmedPlayers(session) {
  return session.participants.filter(
    (participant) => participant.status === 'CONFIRMED' && participant.role === 'PLAYER'
  ).length;
}

function hasAvailablePlayerSlots(session) {
  return countConfirmedPlayers(session) < session.maxPlayers;
}

async function findSessionsWithAvailableSlots({ baseQuery, offset, limit }) {
  const allMatchingSessions = await prisma.session.findMany(baseQuery);
  const filteredBySlots = allMatchingSessions.filter(hasAvailablePlayerSlots);

  return {
    sessions: filteredBySlots.slice(offset, offset + limit),
    total: filteredBySlots.length,
  };
}

async function findPagedSessions({ baseQuery, where, offset, limit }) {
  const [pagedSessions, countedTotal] = await Promise.all([
    prisma.session.findMany({
      ...baseQuery,
      take: limit,
      skip: offset,
    }),
    prisma.session.count({ where }),
  ]);

  return {
    sessions: pagedSessions,
    total: countedTotal,
  };
}

function formatSessionSearchResult(session) {
  const confirmedPlayers = countConfirmedPlayers(session);

  return {
    id: session.id,
    title: session.title,
    description: session.description,
    date: session.date,
    duration: session.duration,
    status: session.status,
    price: session.price,
    maxPlayers: session.maxPlayers,
    currentPlayers: confirmedPlayers,
    availableSlots: session.maxPlayers - confirmedPlayers,
    visibility: session.visibility,
    owner: session.owner,
    ownerId: session.ownerId,
    campaign: session.campaign,
    isOneShot: !session.campaignId,
    createdAt: session.createdAt,
  };
}

class SearchService {
  async searchCampaigns({ query, system, limit = 20, offset = 0, sortBy = 'newest' }) {
    const where = buildCampaignSearchWhere({ query, system });
    const orderBy = resolveCampaignOrderBy(sortBy);

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          owner: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          _count: {
            select: { sessions: true, members: true },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.campaign.count({ where }),
    ]);

    return {
      campaigns: campaigns.map(formatCampaignSearchResult),
      total,
      hasMore: offset + campaigns.length < total,
      limit,
      offset,
    };
  }

  async searchSessions({
    query,
    system,
    dateFrom,
    dateTo,
    minPrice,
    maxPrice,
    hasAvailableSlots,
    oneShot,
    limit = 20,
    offset = 0,
    sortBy = 'date',
  }) {
    const where = buildSessionSearchWhere({
      query,
      system,
      dateFrom,
      dateTo,
      minPrice,
      maxPrice,
      oneShot,
    });
    const orderBy = resolveSessionOrderBy(sortBy);
    const baseQuery = buildSessionSearchQuery(where, orderBy);

    const { sessions, total } = hasAvailableSlots === true
      ? await findSessionsWithAvailableSlots({ baseQuery, offset, limit })
      : await findPagedSessions({ baseQuery, where, offset, limit });

    const formattedSessions = sessions.map(formatSessionSearchResult);

    return {
      sessions: formattedSessions,
      total,
      hasMore: offset + formattedSessions.length < total,
      limit,
      offset,
    };
  }
}

module.exports = new SearchService();
