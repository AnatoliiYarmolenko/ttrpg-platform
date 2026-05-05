const { prisma } = require('../lib/prisma');
const {
  applyCampaignDiscoveryFilter,
  applySessionDiscoveryFilter,
  buildNestedCampaignSelectForViewer,
  sanitizeNestedCampaignForSession,
} = require('../domain/access/discovery.policy');

const MIN_SLOT_SCAN_CHUNK = 50;
const MAX_SLOT_SCAN_CHUNK = 200;

function appendAndClause(whereCondition, clause) {
  whereCondition.AND = whereCondition.AND || [];
  whereCondition.AND.push(clause);
}

function buildOwnerUserFilter(ownerUsername) {
  if (!ownerUsername?.trim()) {
    return null;
  }

  const normalizedUsername = ownerUsername.trim();

  return [
    { owner: { username: { contains: normalizedUsername, mode: 'insensitive' } } },
    { owner: { displayName: { contains: normalizedUsername, mode: 'insensitive' } } },
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

function applySessionOwnerFilter(where, ownerUsername) {
  const userFilter = buildOwnerUserFilter(ownerUsername);
  if (userFilter) {
    appendAndClause(where, { OR: userFilter });
  }
}

function applySessionParticipationFilter(where, userId, onlyMyParticipation) {
  if (onlyMyParticipation !== true || !userId) {
    return;
  }

  appendAndClause(where, {
    OR: [
      { ownerId: userId },
      {
        participants: {
          some: {
            userId,
            status: 'CONFIRMED',
          },
        },
      },
    ],
  });
}

function applySessionDateRange(where, dateFrom, dateTo) {
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

    return;
  }

  appendAndClause(where, {
    OR: [
      { status: 'ACTIVE' },
      {
        status: 'PLANNED',
        date: { gte: new Date() },
      },
    ],
  });
}

function applySessionPriceRange(where, minPrice, maxPrice) {
  if (minPrice === undefined && maxPrice === undefined) {
    return;
  }

  where.price = {};

  if (minPrice !== undefined) {
    where.price.gte = minPrice;
  }

  if (maxPrice !== undefined) {
    where.price.lte = maxPrice;
  }
}

function buildCampaignSearchWhere({ userId, query, system, ownerUsername, onlyMyParticipation }) {
  const where = {};

  where.status = 'ACTIVE';

  applyCampaignDiscoveryFilter(where, userId);

  if (query?.trim()) {
    where.OR = [
      { title: { contains: query.trim(), mode: 'insensitive' } },
      { description: { contains: query.trim(), mode: 'insensitive' } },
    ];
  }

  if (system?.trim()) {
    where.system = { contains: system.trim(), mode: 'insensitive' };
  }

  const userFilter = buildOwnerUserFilter(ownerUsername);
  if (userFilter) {
    where.AND = [...(where.AND || []), { OR: userFilter }];
  }

  if (onlyMyParticipation === true && userId) {
    appendAndClause(where, {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
            },
          },
        },
      ],
    });
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
  userId,
  query,
  system,
  ownerUsername,
  onlyMyParticipation,
  dateFrom,
  dateTo,
  minPrice,
  maxPrice,
  oneShot,
}) {
  const where = {
    status: { in: ['PLANNED', 'ACTIVE'] },
  };

  applySessionDiscoveryFilter(where, userId);

  if (query?.trim()) {
    where.OR = [
      { title: { contains: query.trim(), mode: 'insensitive' } },
      { description: { contains: query.trim(), mode: 'insensitive' } },
    ];
  }

  if (system?.trim()) {
    const normalizedSystem = system.trim();
    appendAndClause(where, {
      OR: [
        { system: { contains: normalizedSystem, mode: 'insensitive' } },
        { campaign: { system: { contains: normalizedSystem, mode: 'insensitive' } } },
      ],
    });
  }

  applySessionOwnerFilter(where, ownerUsername);
  applySessionParticipationFilter(where, userId, onlyMyParticipation);
  applySessionDateRange(where, dateFrom, dateTo);
  applySessionPriceRange(where, minPrice, maxPrice);

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

function buildSessionSearchQuery(where, orderBy, userId = null) {
  return {
    where,
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
            select: { id: true },
          },
        },
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

async function findSessionsWithAvailableSlots({ prismaClient, baseQuery, offset, limit }) {
  const chunkSize = Math.max(MIN_SLOT_SCAN_CHUNK, Math.min(MAX_SLOT_SCAN_CHUNK, limit * 4));
  const pagedSessions = [];
  let scannedOffset = 0;
  let filteredTotal = 0;

  while (true) {
    const sessionsChunk = await prismaClient.session.findMany({
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

async function findPagedSessions({ prismaClient, baseQuery, where, offset, limit }) {
  const [pagedSessions, countedTotal] = await Promise.all([
    prismaClient.session.findMany({
      ...baseQuery,
      take: limit,
      skip: offset,
    }),
    prismaClient.session.count({ where }),
  ]);

  return {
    sessions: pagedSessions,
    total: countedTotal,
  };
}

function formatSessionSearchResult(session, userId = null) {
  const confirmedPlayers = countConfirmedPlayers(session);
  const campaign = sanitizeNestedCampaignForSession(session, userId);
  const myParticipation = userId
    ? session.participants?.find((p) => p.userId === userId) || null
    : null;

  return {
    id: session.id,
    title: session.title,
    description: session.description,
    startAt: session.date,
    duration: session.duration,
    status: session.status,
    price: session.price,
    maxPlayers: session.maxPlayers,
    currentPlayers: confirmedPlayers,
    availableSlots: session.maxPlayers - confirmedPlayers,
    visibility: session.visibility,
    owner: session.owner,
    ownerId: session.ownerId,
    campaign,
    system: session.system || campaign?.system || null,
    isOneShot: !session.campaignId,
    createdAt: session.createdAt,
    myRole: myParticipation?.role || null,
    myStatus: myParticipation?.status || null,
  };
}

class SearchService {
  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  async searchCampaigns({
    userId = null,
    query,
    system,
    ownerUsername,
    onlyMyParticipation,
    limit = 20,
    offset = 0,
    sortBy = 'newest',
  }) {
    const where = buildCampaignSearchWhere({
      userId,
      query,
      system,
      ownerUsername,
      onlyMyParticipation,
    });
    const orderBy = resolveCampaignOrderBy(sortBy);

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
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
      this.prisma.campaign.count({ where }),
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
    userId = null,
    query,
    system,
    ownerUsername,
    onlyMyParticipation,
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
      userId,
      query,
      system,
      ownerUsername,
      onlyMyParticipation,
      dateFrom,
      dateTo,
      minPrice,
      maxPrice,
      oneShot,
    });
    const orderBy = resolveSessionOrderBy(sortBy);
    const baseQuery = buildSessionSearchQuery(where, orderBy, userId);

    const { sessions, total } = hasAvailableSlots === true
      ? await findSessionsWithAvailableSlots({ prismaClient: this.prisma, baseQuery, offset, limit })
      : await findPagedSessions({ prismaClient: this.prisma, baseQuery, where, offset, limit });

    const formattedSessions = sessions.map((session) => formatSessionSearchResult(session, userId));

    return {
      sessions: formattedSessions,
      total,
      hasMore: offset + formattedSessions.length < total,
      limit,
      offset,
    };
  }
}

const searchServiceInstance = new SearchService();

module.exports = searchServiceInstance;
module.exports.SearchService = SearchService;

module.exports.appendAndClause = appendAndClause;
module.exports.buildOwnerUserFilter = buildOwnerUserFilter;
module.exports.resolveRangeStart = resolveRangeStart;
module.exports.resolveRangeEnd = resolveRangeEnd;
module.exports.applySessionOwnerFilter = applySessionOwnerFilter;
module.exports.applySessionParticipationFilter = applySessionParticipationFilter;
module.exports.applySessionDateRange = applySessionDateRange;
module.exports.applySessionPriceRange = applySessionPriceRange;
module.exports.buildCampaignSearchWhere = buildCampaignSearchWhere;
module.exports.buildSessionSearchWhere = buildSessionSearchWhere;
module.exports.resolveCampaignOrderBy = resolveCampaignOrderBy;
module.exports.resolveSessionOrderBy = resolveSessionOrderBy;
module.exports.formatCampaignSearchResult = formatCampaignSearchResult;
module.exports.formatSessionSearchResult = formatSessionSearchResult;
module.exports.countConfirmedPlayers = countConfirmedPlayers;
module.exports.hasAvailablePlayerSlots = hasAvailablePlayerSlots;
