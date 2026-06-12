const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');

const test = require('node:test');
const assert = require('node:assert/strict');

const { SessionService } = require('../../src/services/session.service');
const { AppError, ERROR_CODES } = require('../../src/constants/errors');
const { redis } = require('../../src/lib/redis');

const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

if (!testDbUrl) {
  test.skip('DATABASE_URL not set, skipping integration test');
}

const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

async function cleanupTestData() {
  await testPrisma.sessionParticipant.deleteMany({
    where: {
      user: { username: { startsWith: 'test_user_' } },
    },
  });
  await testPrisma.session.deleteMany({
    where: {
      title: 'Test Session',
    },
  });
  await testPrisma.campaignMember.deleteMany({
    where: {
      user: { username: { startsWith: 'test_user_' } },
    },
  });
  await testPrisma.campaign.deleteMany({
    where: {
      title: 'Test Campaign',
    },
  });
  await testPrisma.user.deleteMany({
    where: {
      username: { startsWith: 'test_user_' },
    },
  });
}

test.before(async () => {
  await testPrisma.$connect();
  await cleanupTestData();
});

test.after(async () => {
  await cleanupTestData();
  await testPrisma.$disconnect();
  if (redis.status === 'ready' || redis.status === 'connecting') {
    await redis.quit();
  }
});

async function createTestUser(overrides = {}) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 7);
  return testPrisma.user.create({
    data: {
      username: `test_user_${timestamp}_${random}`,
      email: `test_${timestamp}_${random}@example.com`,
      password: 'password123',
      displayName: 'Test User',
      timezone: 'Europe/Kyiv',
      ...overrides,
    },
  });
}

async function createTestCampaign(ownerId, overrides = {}) {
  return testPrisma.campaign.create({
    data: {
      title: 'Test Campaign',
      description: 'A test campaign',
      system: 'D&D 5e',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: 'OWNER',
        },
      },
      ...overrides,
    },
    include: {
      members: true,
    },
  });
}

async function createTestSession(ownerId, campaignId = null, overrides = {}) {
  // Використовуємо поточний момент, щоб гарантувати перевірки в той самий день за часовим поясом користувача.
  const today = new Date();

  return testPrisma.session.create({
    data: {
      title: 'Test Session',
      description: 'A test session',
      date: today,
      duration: 180,
      maxPlayers: 5,
      visibility: 'PUBLIC',
      status: 'PLANNED',
      ownerId,
      campaignId,
      ...overrides,
    },
    include: {
      participants: true,
      campaign: true,
    },
  });
}

async function addSessionParticipant(userId, sessionId, role = 'PLAYER', status = 'CONFIRMED') {
  return testPrisma.sessionParticipant.create({
    data: {
      userId,
      sessionId,
      role,
      status,
      isGuest: false,
    },
  });
}

test('confirmed GM can change session status from PLANNED to ACTIVE', async () => {
  const owner = await createTestUser();
  const gm = await createTestUser();
  const campaign = await createTestCampaign(owner.id);
  const session = await createTestSession(owner.id, campaign.id);

  await addSessionParticipant(gm.id, session.id, 'GM', 'CONFIRMED');

  const sessionService = new SessionService(testPrisma);

  const result = await sessionService.lifecycleService.updateSession(
    session.id,
    gm.id,
    { status: 'ACTIVE' },
    { preloadedSession: null }
  );

  assert.equal(result.status, 'ACTIVE');

  const updatedSession = await testPrisma.session.findUnique({
    where: { id: session.id },
    select: { status: true },
  });

  assert.equal(updatedSession.status, 'ACTIVE');
});

test('PLAYER cannot change session status from PLANNED to ACTIVE', async () => {
  const owner = await createTestUser();
  const player = await createTestUser();
  const campaign = await createTestCampaign(owner.id);
  const session = await createTestSession(owner.id, campaign.id);

  await addSessionParticipant(player.id, session.id, 'PLAYER', 'CONFIRMED');

  const sessionService = new SessionService(testPrisma);

  await assert.rejects(
    () => sessionService.lifecycleService.updateSession(
      session.id,
      player.id,
      { status: 'ACTIVE' },
      { preloadedSession: null }
    ),
    (error) => error instanceof AppError && error.code === ERROR_CODES.SESSION_GM_ONLY
  );

  const unchangedSession = await testPrisma.session.findUnique({
    where: { id: session.id },
    select: { status: true },
  });

  assert.equal(unchangedSession.status, 'PLANNED');
});

test('session owner can change session status from PLANNED to ACTIVE', async () => {
  const owner = await createTestUser();
  const campaign = await createTestCampaign(owner.id);
  const session = await createTestSession(owner.id, campaign.id);

  await addSessionParticipant(owner.id, session.id, 'GM', 'CONFIRMED');

  const sessionService = new SessionService(testPrisma);

  const result = await sessionService.lifecycleService.updateSession(
    session.id,
    owner.id,
    { status: 'ACTIVE' },
    { preloadedSession: null }
  );

  assert.equal(result.status, 'ACTIVE');

  const updatedSession = await testPrisma.session.findUnique({
    where: { id: session.id },
    select: { status: true },
  });

  assert.equal(updatedSession.status, 'ACTIVE');
});

test('campaign owner can change session status from PLANNED to ACTIVE in own campaign', async () => {
  const campaignOwner = await createTestUser();
  const sessionOwner = await createTestUser();
  const campaign = await createTestCampaign(campaignOwner.id);
  const session = await createTestSession(sessionOwner.id, campaign.id);

  await addSessionParticipant(campaignOwner.id, session.id, 'GM', 'CONFIRMED');

  const sessionService = new SessionService(testPrisma);

  const result = await sessionService.lifecycleService.updateSession(
    session.id,
    campaignOwner.id,
    { status: 'ACTIVE' },
    { preloadedSession: null }
  );

  assert.equal(result.status, 'ACTIVE');

  const updatedSession = await testPrisma.session.findUnique({
    where: { id: session.id },
    select: { status: true },
  });

  assert.equal(updatedSession.status, 'ACTIVE');
});

test('outsider cannot change session status from PLANNED to ACTIVE', async () => {
  const owner = await createTestUser();
  const campaign = await createTestCampaign(owner.id);
  const session = await createTestSession(owner.id, campaign.id);
  await addSessionParticipant(owner.id, session.id, 'GM', 'CONFIRMED');

  const outsider = await createTestUser();

  const sessionService = new SessionService(testPrisma);

  await assert.rejects(
    () => sessionService.lifecycleService.updateSession(
      session.id,
      outsider.id,
      { status: 'ACTIVE' },
      { preloadedSession: null }
    ),
    (error) => error instanceof AppError && error.code === ERROR_CODES.SESSION_GM_ONLY
  );

  const unchangedSession = await testPrisma.session.findUnique({
    where: { id: session.id },
    select: { status: true },
  });

  assert.equal(unchangedSession.status, 'PLANNED');
});
