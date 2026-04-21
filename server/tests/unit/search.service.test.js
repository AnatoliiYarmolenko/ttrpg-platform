const test = require('node:test');
const assert = require('node:assert/strict');

const searchService = require('../../src/services/search.service');
const { prisma } = require('../../src/lib/prisma');

const originalCampaignFindMany = prisma.campaign.findMany;
const originalCampaignCount = prisma.campaign.count;
const originalSessionFindMany = prisma.session.findMany;
const originalSessionCount = prisma.session.count;

function restorePrisma() {
  prisma.campaign.findMany = originalCampaignFindMany;
  prisma.campaign.count = originalCampaignCount;
  prisma.session.findMany = originalSessionFindMany;
  prisma.session.count = originalSessionCount;
}

test.afterEach(() => {
  restorePrisma();
});

test('searchCampaigns applies entitlement visibility and owner/member text filter for authenticated user', async () => {
  let capturedWhere = null;

  prisma.campaign.findMany = async ({ where }) => {
    capturedWhere = where;
    return [];
  };
  prisma.campaign.count = async () => 0;

  const result = await searchService.searchCampaigns({
    userId: 42,
    ownerUsername: 'gm_master',
    limit: 20,
    offset: 0,
  });

  assert.equal(result.total, 0);
  assert.deepEqual(capturedWhere.AND, [
    {
      OR: [
        { visibility: 'PUBLIC' },
        {
          visibility: 'LINK_ONLY',
          OR: [
            { ownerId: 42 },
            { members: { some: { userId: 42 } } },
          ],
        },
      ],
    },
    {
      OR: [
        { owner: { username: { contains: 'gm_master', mode: 'insensitive' } } },
        { owner: { displayName: { contains: 'gm_master', mode: 'insensitive' } } },
      ],
    },
  ]);
});

test('searchCampaigns allows authenticated user to discover entitled LINK_ONLY campaigns', async () => {
  let capturedWhere = null;

  prisma.campaign.findMany = async ({ where }) => {
    capturedWhere = where;
    return [];
  };
  prisma.campaign.count = async () => 0;

  await searchService.searchCampaigns({
    userId: 42,
    limit: 20,
    offset: 0,
  });

  assert.deepEqual(capturedWhere.AND, [
    {
      OR: [
        { visibility: 'PUBLIC' },
        {
          visibility: 'LINK_ONLY',
          OR: [
            { ownerId: 42 },
            { members: { some: { userId: 42 } } },
          ],
        },
      ],
    },
  ]);
});

test('searchSessions supports system filter, owner or participant filter, and inclusive dateTo', async () => {
  let capturedWhere = null;

  prisma.session.findMany = async ({ where }) => {
    capturedWhere = where;
    return [
      {
        id: 7,
        title: 'One-shot',
        description: 'Night session',
        date: new Date('2026-05-01T18:00:00.000Z'),
        duration: 180,
        status: 'PLANNED',
        price: 0,
        maxPlayers: 5,
        visibility: 'PUBLIC',
        ownerId: 3,
        campaignId: null,
        system: 'Call of Cthulhu',
        owner: {
          id: 3,
          username: 'keeper',
          displayName: 'Keeper',
          avatarUrl: null,
        },
        campaign: null,
        participants: [
          { id: 1, role: 'PLAYER', status: 'CONFIRMED' },
          { id: 2, role: 'PLAYER', status: 'PENDING' },
        ],
        _count: {
          participants: 2,
        },
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
      },
    ];
  };
  prisma.session.count = async () => 1;

  const result = await searchService.searchSessions({
    userId: 42,
    system: 'Call of Cthulhu',
    ownerUsername: 'keeper',
    dateTo: '2026-05-01',
    limit: 20,
    offset: 0,
    sortBy: 'date',
  });

  assert.equal(result.total, 1);
  assert.equal(result.sessions[0].system, 'Call of Cthulhu');
  assert.equal(result.sessions[0].currentPlayers, 1);
  assert.equal(result.sessions[0].availableSlots, 4);
  assert.deepEqual(capturedWhere.AND, [
    {
      OR: [
        {
          campaignId: null,
          visibility: { in: ['PUBLIC', 'PRIVATE'] },
        },
        {
          campaignId: null,
          visibility: 'LINK_ONLY',
          OR: [
            { ownerId: 42 },
            { participants: { some: { userId: 42 } } },
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
            { campaign: { ownerId: 42 } },
            { campaign: { members: { some: { userId: 42 } } } },
            { participants: { some: { userId: 42 } } },
            { ownerId: 42 },
          ],
        },
        {
          campaignId: { not: null },
          visibility: 'LINK_ONLY',
          OR: [
            { campaign: { ownerId: 42 } },
            { campaign: { members: { some: { userId: 42 } } } },
            { participants: { some: { userId: 42 } } },
            { ownerId: 42 },
          ],
        },
      ],
    },
    {
      OR: [
        { system: { contains: 'Call of Cthulhu', mode: 'insensitive' } },
        { campaign: { system: { contains: 'Call of Cthulhu', mode: 'insensitive' } } },
      ],
    },
    {
      OR: [
        { owner: { username: { contains: 'keeper', mode: 'insensitive' } } },
        { owner: { displayName: { contains: 'keeper', mode: 'insensitive' } } },
      ],
    },
  ]);
  assert.equal(capturedWhere.date.lte.toISOString(), '2026-05-01T23:59:59.999Z');
});

test('searchSessions default window keeps ACTIVE sessions and future PLANNED sessions', async () => {
  let capturedWhere = null;

  prisma.session.findMany = async ({ where }) => {
    capturedWhere = where;
    return [];
  };
  prisma.session.count = async () => 0;

  await searchService.searchSessions({
    userId: 42,
    limit: 20,
    offset: 0,
  });

  assert.equal(capturedWhere.status.in.includes('ACTIVE'), true);
  assert.equal(capturedWhere.status.in.includes('PLANNED'), true);
  assert.equal(Array.isArray(capturedWhere.AND), true);
  assert.deepEqual(capturedWhere.AND[0], {
    OR: [
      {
        campaignId: null,
        visibility: { in: ['PUBLIC', 'PRIVATE'] },
      },
      {
        campaignId: null,
        visibility: 'LINK_ONLY',
        OR: [
          { ownerId: 42 },
          { participants: { some: { userId: 42 } } },
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
          { campaign: { ownerId: 42 } },
          { campaign: { members: { some: { userId: 42 } } } },
          { participants: { some: { userId: 42 } } },
          { ownerId: 42 },
        ],
      },
      {
        campaignId: { not: null },
        visibility: 'LINK_ONLY',
        OR: [
          { campaign: { ownerId: 42 } },
          { campaign: { members: { some: { userId: 42 } } } },
          { participants: { some: { userId: 42 } } },
          { ownerId: 42 },
        ],
      },
    ],
  });
  assert.equal(capturedWhere.AND[1].OR[0].status, 'ACTIVE');
  assert.equal(capturedWhere.AND[1].OR[1].status, 'PLANNED');
  assert.equal(capturedWhere.AND[1].OR[1].date.gte instanceof Date, true);
});

test('searchSessions keeps LINK_ONLY campaign title but strips campaign id for outsider', async () => {
  prisma.session.findMany = async () => [
    {
      id: 9,
      title: 'Guest Session',
      description: 'Visible session',
      date: new Date('2026-05-03T18:00:00.000Z'),
      duration: 180,
      status: 'PLANNED',
      price: 0,
      maxPlayers: 5,
      visibility: 'PUBLIC',
      ownerId: 3,
      campaignId: 700,
      system: null,
      owner: {
        id: 3,
        username: 'gm',
        displayName: 'GM',
        avatarUrl: null,
      },
      campaign: {
        id: 700,
        title: 'Hidden Campaign',
        system: 'D&D 5e',
        visibility: 'LINK_ONLY',
        ownerId: 77,
        members: [],
      },
      participants: [],
      _count: {
        participants: 0,
      },
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
    },
  ];
  prisma.session.count = async () => 1;

  const result = await searchService.searchSessions({
    userId: 42,
    limit: 20,
    offset: 0,
  });

  assert.equal(result.total, 1);
  assert.equal(result.sessions[0].campaign?.title, 'Hidden Campaign');
  assert.equal(result.sessions[0].campaign?.id, null);
  assert.equal(result.sessions[0].campaign?.canOpenDirectly, false);
  assert.equal(result.sessions[0].system, 'D&D 5e');
});
