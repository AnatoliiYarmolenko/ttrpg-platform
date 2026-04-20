const { prisma } = require('../lib/prisma');

const MIN_SLOT_SCAN_CHUNK = 50;
const MAX_SLOT_SCAN_CHUNK = 200;

function buildCampaignUserFilter(ownerUsername) {
  if (!ownerUsername?.trim()) {
    return null;
  }

  const normalizedUsername = ownerUsername.trim();

  return [
    { owner: { username: { contains: normalizedUsername, mode: 'insensitive' } } },
    { owner: { displayName: { contains: normalizedUsername, mode: 'insensitive' } } },
    {
      members: {
        some: {
          user: {
            username: { contains: normalizedUsername, mode: 'insensitive' },
          },
        },
      },
    },
    {
      members: {
        some: {
          user: {
            displayName: { contains: normalizedUsername, mode: 'insensitive' },
          },
        },
      },
    },
  ];
}

function buildSessionUserFilter(ownerUsername) {
  if (!ownerUsername?.trim()) {
    return null;
  }

  const normalizedUsername = ownerUsername.trim();

  return [
    { owner: { username: { contains: normalizedUsername, mode: 'insensitive' } } },
    { owner: { displayName: { contains: normalizedUsername, mode: 'insensitive' } } },
    {
      participants: {
        some: {
          status: 'CONFIRMED',
          user: {
            username: { contains: normalizedUsername, mode: 'insensitive' },
          },
        },
      },
    },
    {
      participants: {
        some: {
          status: 'CONFIRMED',
          user: {
            displayName: { contains: normalizedUsername, mode: 'insensitive' },
          },
        },
      },
    },
  ];
}

function resolveRangeStart(dateFrom) {
  if (!dateFrom) {
    return null;
  }

  return new Date(dateFrom);
}

function resolveRangeEnd(dateTo) {
  if (!dateTo) {
    return null;
  }

  const resolvedDate = new Date(dateTo);

  if (dateTo.length === 10) {
    resolvedDate.setUTCHours(23, 59, 59, 999);
  }

  return resolvedDate;
}

function buildCampaignSearchWhere({ query, system, ownerUsername }) {
  const where = {
    visibility: 'PUBLIC',
  };

  if (query?.trim()) {
    where.OR = [
      { title: { contains: query.trim(), mode: 'insensitive' } },
      { description: { contains: query.trim(), mode: 'insensitive' } },
    ];
  }

  if (system?.trim()) {
    where.system = { contains: system.trim(), mode: 'insensitive' };
  }

  const userFilter = buildCampaignUserFilter(ownerUsername);
  if (userFilter) {
    where.AND = [...(where.AND || []), { OR: userFilter }];
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
  ownerUsername,
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

  if (query?.trim()) {
    where.OR = [
      { title: { contains: query.trim(), mode: 'insensitive' } },
      { description: { contains: query.trim(), mode: 'insensitive' } },
    ];
  }

  if (system?.trim()) {
    const normalizedSystem = system.trim();
    where.AND = [
      {
        OR: [
          { system: { contains: normalizedSystem, mode: 'insensitive' } },
          { campaign: { system: { contains: normalizedSystem, mode: 'insensitive' } } },
        ],
      },
    ];
  }

  const userFilter = buildSessionUserFilter(ownerUsername);
  if (userFilter) {
    where.AND = [...(where.AND || []), { OR: userFilter }];
  }

  const rangeStart = resolveRangeStart(dateFrom);
  const rangeEnd = resolveRangeEnd(dateTo);

  if (rangeStart || rangeEnd) {
    where.date = {};

    if (rangeStart) {
      where.date.gte = rangeStart;
    }

    if (rangeEnd) {
      where.date.lte = rangeEnd;
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
        where: {
          role: 'PLAYER',
          status: 'CONFIRMED',
        },
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
  const chunkSize = Math.max(MIN_SLOT_SCAN_CHUNK, Math.min(MAX_SLOT_SCAN_CHUNK, limit * 4));
  const pagedSessions = [];
  let scannedOffset = 0;
  let filteredTotal = 0;

  while (true) {
    const sessionsChunk = await prisma.session.findMany({
      ...baseQuery,
      skip: scannedOffset,
      take: chunkSize,
    });

    if (sessionsChunk.length === 0) {
      break;
    }

    for (const session of sessionsChunk) {
      if (!hasAvailablePlayerSlots(session)) {
        continue;
      }

      if (filteredTotal >= offset && pagedSessions.length < limit) {
        pagedSessions.push(session);
      }

      filteredTotal += 1;
    }

    scannedOffset += sessionsChunk.length;

    if (sessionsChunk.length < chunkSize) {
      break;
    }
  }

  return {
    sessions: pagedSessions,
    total: filteredTotal,
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
    system: session.system || session.campaign?.system || null,
    isOneShot: !session.campaignId,
    createdAt: session.createdAt,
  };
}

class SearchService {
  async searchCampaigns({
    query,
    system,
    ownerUsername,
    limit = 20,
    offset = 0,
    sortBy = 'newest',
  }) {
    const where = buildCampaignSearchWhere({ query, system, ownerUsername });
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
    ownerUsername,
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
      ownerUsername,
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
