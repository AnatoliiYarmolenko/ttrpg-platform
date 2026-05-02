const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');

const test = require('node:test');
const assert = require('node:assert/strict');

async function withTestDatabase(callback) {
  const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

  if (!testDbUrl) {
    test.skip('DATABASE_URL not set, skipping integration test');
    return;
  }

  const testPrisma = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });

  try {
    await testPrisma.$connect();

    await testPrisma.$transaction(async (tx) => {
      await callback(tx);
      throw new Error('ROLLBACK');
    }).catch((err) => {
      if (err.message !== 'ROLLBACK') {
        throw err;
      }
    });
  } finally {
    await testPrisma.$disconnect();
  }
}

async function createTestUser(tx, overrides = {}) {
  const user = await tx.user.create({
    data: {
      username: `test_user_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'password123',
      displayName: 'Test User',
      ...overrides,
    },
  });
  return user;
}

async function createTestCampaign(tx, ownerId, overrides = {}) {
  const campaign = await tx.campaign.create({
    data: {
      title: 'Test Campaign',
      description: 'A test campaign',
      system: 'D&D 5e',
      visibility: 'PUBLIC',
      ownerId,
      status: 'ACTIVE',
      ...overrides,
    },
  });
  return campaign;
}

async function createTestSession(tx, ownerId, overrides = {}) {
  const session = await tx.session.create({
    data: {
      title: 'Test Session',
      description: 'A test session',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      duration: 180,
      maxPlayers: 5,
      visibility: 'PUBLIC',
      status: 'PLANNED',
      ownerId,
      ...overrides,
    },
  });
  return session;
}

test('searchCampaigns returns campaigns matching query', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    await createTestCampaign(tx, user.id, { title: 'Dragon Quest' });
    await createTestCampaign(tx, user.id, { title: 'Space Adventure' });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const result = await searchService.searchCampaigns({
      query: 'Dragon',
      limit: 10,
      offset: 0,
    });

    assert.ok(result.campaigns.length >= 1);
    assert.ok(result.campaigns.some(c => c.title.includes('Dragon')));
  });
});

test('searchCampaigns filters by system', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    await createTestCampaign(tx, user.id, { system: 'D&D 5e' });
    await createTestCampaign(tx, user.id, { system: 'Pathfinder' });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const result = await searchService.searchCampaigns({
      system: 'D&D',
      limit: 10,
      offset: 0,
    });

    assert.ok(result.campaigns.length >= 1);
    assert.ok(result.campaigns.every(c => c.system?.includes('D&D')));
  });
});

test('searchCampaigns filters by owner username', async () => {
  await withTestDatabase(async (tx) => {
    const owner1 = await createTestUser(tx, { username: 'gm_dragon', displayName: 'Dragon GM' });
    const owner2 = await createTestUser(tx, { username: 'gm_space', displayName: 'Space GM' });
    await createTestCampaign(tx, owner1.id, { title: 'Dragon Campaign' });
    await createTestCampaign(tx, owner2.id, { title: 'Space Campaign' });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const result = await searchService.searchCampaigns({
      ownerUsername: 'dragon',
      limit: 10,
      offset: 0,
    });

    assert.ok(result.campaigns.length >= 1);
  });
});

test('searchCampaigns returns only entitled campaigns for authenticated user', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const member = await createTestUser(tx);
    const outsider = await createTestUser(tx);

    await createTestCampaign(tx, owner.id, {
      visibility: 'PUBLIC',
      title: 'Public Campaign',
    });
    const linkOnlyCampaign = await createTestCampaign(tx, owner.id, {
      visibility: 'LINK_ONLY',
      title: 'Link Only Campaign',
    });
    await tx.campaignMember.create({
      data: {
        campaignId: linkOnlyCampaign.id,
        userId: member.id,
        role: 'PLAYER',
      },
    });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const publicResults = await searchService.searchCampaigns({ limit: 20, offset: 0 });
    const memberResults = await searchService.searchCampaigns({ userId: member.id, limit: 20, offset: 0 });
    const outsiderResults = await searchService.searchCampaigns({ userId: outsider.id, limit: 20, offset: 0 });

    assert.ok(publicResults.campaigns.some(c => c.title === 'Public Campaign'));
    assert.ok(memberResults.campaigns.some(c => c.title === 'Link Only Campaign'));
    assert.ok(!outsiderResults.campaigns.some(c => c.title === 'Link Only Campaign'));
  });
});

test('searchSessions returns sessions matching query', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    await createTestSession(tx, user.id, { title: 'Dragon Hunt' });
    await createTestSession(tx, user.id, { title: 'Space Mission' });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const result = await searchService.searchSessions({
      query: 'Dragon',
      limit: 10,
      offset: 0,
    });

    assert.ok(result.sessions.length >= 1);
    assert.ok(result.sessions.some(s => s.title.includes('Dragon')));
  });
});

test('searchSessions filters by system', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    await createTestSession(tx, user.id, { system: 'D&D 5e' });
    await createTestSession(tx, user.id, { system: 'Pathfinder' });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const result = await searchService.searchSessions({
      system: 'D&D',
      limit: 10,
      offset: 0,
    });

    assert.ok(result.sessions.length >= 1);
    assert.ok(result.sessions.every(s => s.system?.includes('D&D')));
  });
});

test('searchSessions filters one-shot sessions', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, user.id);

    await createTestSession(tx, user.id, { campaignId: null, title: 'One-shot Session' });
    await createTestSession(tx, user.id, { campaignId: campaign.id, title: 'Campaign Session' });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const result = await searchService.searchSessions({
      oneShot: true,
      limit: 10,
      offset: 0,
    });

    assert.ok(result.sessions.every(s => s.isOneShot === true));
    assert.ok(result.sessions.some(s => s.title === 'One-shot Session'));
    assert.ok(!result.sessions.some(s => s.title === 'Campaign Session'));
  });
});

test('searchSessions calculates available slots correctly', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    const player1 = await createTestUser(tx);
    const player2 = await createTestUser(tx);

    const session = await createTestSession(tx, user.id, { maxPlayers: 5 });

    await tx.sessionParticipant.create({
      data: { userId: player1.id, sessionId: session.id, role: 'PLAYER', status: 'CONFIRMED' },
    });
    await tx.sessionParticipant.create({
      data: { userId: player2.id, sessionId: session.id, role: 'PLAYER', status: 'CONFIRMED' },
    });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const result = await searchService.searchSessions({ limit: 10, offset: 0 });

    const foundSession = result.sessions.find(s => s.id === session.id);
    assert.ok(foundSession);
    assert.equal(foundSession.currentPlayers, 2);
    assert.equal(foundSession.availableSlots, 3);
  });
});

test('searchSessions filters by date range', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const farFutureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await createTestSession(tx, user.id, { date: futureDate });
    await createTestSession(tx, user.id, { date: farFutureDate });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const result = await searchService.searchSessions({
      dateFrom: futureDate.toISOString().split('T')[0],
      dateTo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limit: 10,
      offset: 0,
    });

    assert.ok(result.sessions.length >= 1);
  });
});

test('searchSessions returns campaign data with sanitized fields for LINK_ONLY campaign', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const member = await createTestUser(tx);

    const campaign = await createTestCampaign(tx, owner.id, { visibility: 'LINK_ONLY' });
    const session = await createTestSession(tx, owner.id, { campaignId: campaign.id, visibility: 'PUBLIC' });

    await tx.campaignMember.create({
      data: { campaignId: campaign.id, userId: member.id, role: 'PLAYER' },
    });

    const { SearchService } = require('../../src/services/search.service');
    const searchService = new SearchService(tx);

    const outsiderResult = await searchService.searchSessions({ limit: 10, offset: 0 });
    const memberResult = await searchService.searchSessions({ userId: member.id, limit: 10, offset: 0 });

    const outsiderSession = outsiderResult.sessions.find(s => s.id === session.id);
    const memberSession = memberResult.sessions.find(s => s.id === session.id);

    assert.ok(outsiderSession);
    assert.ok(memberSession);
    assert.ok(outsiderSession.campaign);
    assert.equal(outsiderSession.campaign.id, null);
    assert.ok(memberSession.campaign);
    assert.ok(memberSession.campaign.id);
  });
});
