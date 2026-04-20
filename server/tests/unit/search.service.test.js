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

test('searchCampaigns filters by owner and campaign members without changing public visibility policy', async () => {
  let capturedWhere = null;

  prisma.campaign.findMany = async ({ where }) => {
    capturedWhere = where;
    return [];
  };
  prisma.campaign.count = async () => 0;

  const result = await searchService.searchCampaigns({
    ownerUsername: 'gm_master',
    limit: 20,
    offset: 0,
  });

  assert.equal(result.total, 0);
  assert.equal(capturedWhere.visibility, 'PUBLIC');
  assert.deepEqual(capturedWhere.AND, [
    {
      OR: [
        { owner: { username: { contains: 'gm_master', mode: 'insensitive' } } },
        { owner: { displayName: { contains: 'gm_master', mode: 'insensitive' } } },
        {
          members: {
            some: {
              user: {
                username: { contains: 'gm_master', mode: 'insensitive' },
              },
            },
          },
        },
        {
          members: {
            some: {
              user: {
                displayName: { contains: 'gm_master', mode: 'insensitive' },
              },
            },
          },
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
        { system: { contains: 'Call of Cthulhu', mode: 'insensitive' } },
        { campaign: { system: { contains: 'Call of Cthulhu', mode: 'insensitive' } } },
      ],
    },
    {
      OR: [
        { owner: { username: { contains: 'keeper', mode: 'insensitive' } } },
        { owner: { displayName: { contains: 'keeper', mode: 'insensitive' } } },
        {
          participants: {
            some: {
              status: 'CONFIRMED',
              user: {
                username: { contains: 'keeper', mode: 'insensitive' },
              },
            },
          },
        },
        {
          participants: {
            some: {
              status: 'CONFIRMED',
              user: {
                displayName: { contains: 'keeper', mode: 'insensitive' },
              },
            },
          },
        },
      ],
    },
  ]);
  assert.equal(capturedWhere.date.lte.toISOString(), '2026-05-01T23:59:59.999Z');
});
