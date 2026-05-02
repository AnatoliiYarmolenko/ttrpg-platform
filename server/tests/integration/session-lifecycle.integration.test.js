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
  const timestamp = Date.now();
  return tx.user.create({
    data: {
      username: `test_user_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      email: `test_${timestamp}@example.com`,
      password: 'password123',
      displayName: 'Test User',
      ...overrides,
    },
  });
}

async function createTestCampaign(tx, ownerId, overrides = {}) {
  return tx.campaign.create({
    data: {
      title: 'Test Campaign',
      description: 'A test campaign',
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

async function createTestSession(tx, ownerId, campaignId = null, overrides = {}) {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  return tx.session.create({
    data: {
      title: 'Test Session',
      description: 'A test session',
      date: futureDate,
      duration: 180,
      maxPlayers: 5,
      visibility: 'PUBLIC',
      status: 'PLANNED',
      ownerId,
      campaignId,
      participants: {
        create: {
          userId: ownerId,
          role: 'GM',
          status: 'CONFIRMED',
          isGuest: false,
        },
      },
      ...overrides,
    },
    include: {
      participants: true,
    },
  });
}

async function addSessionParticipant(tx, userId, sessionId, role = 'PLAYER', status = 'CONFIRMED') {
  return tx.sessionParticipant.create({
    data: {
      userId,
      sessionId,
      role,
      status,
      isGuest: false,
    },
  });
}

test('happy path: PLANNED → ACTIVE → FINISHED', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const session = await createTestSession(tx, gm.id);

    assert.equal(session.status, 'PLANNED');

    const activeSession = await tx.session.update({
      where: { id: session.id },
      data: { status: 'ACTIVE' },
    });

    assert.equal(activeSession.status, 'ACTIVE');

    const finishedSession = await tx.session.update({
      where: { id: session.id },
      data: { status: 'FINISHED' },
    });

    assert.equal(finishedSession.status, 'FINISHED');

    const finalCheck = await tx.session.findUnique({
      where: { id: session.id },
      select: { status: true },
    });

    assert.equal(finalCheck.status, 'FINISHED');
  });
});

test('PLANNED → CANCELED flow', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const session = await createTestSession(tx, gm.id);

    assert.equal(session.status, 'PLANNED');

    const canceledSession = await tx.session.update({
      where: { id: session.id },
      data: { status: 'CANCELED' },
    });

    assert.equal(canceledSession.status, 'CANCELED');

    const finalCheck = await tx.session.findUnique({
      where: { id: session.id },
      select: { status: true },
    });

    assert.equal(finalCheck.status, 'CANCELED');
  });
});

test('ACTIVE → CANCELED flow', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const session = await createTestSession(tx, gm.id);

    await tx.session.update({
      where: { id: session.id },
      data: { status: 'ACTIVE' },
    });

    const canceledSession = await tx.session.update({
      where: { id: session.id },
      data: { status: 'CANCELED' },
    });

    assert.equal(canceledSession.status, 'CANCELED');

    const finalCheck = await tx.session.findUnique({
      where: { id: session.id },
      select: { status: true },
    });

    assert.equal(finalCheck.status, 'CANCELED');
  });
});

test('session with campaign follows campaign status constraints', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, gm.id);
    const session = await createTestSession(tx, gm.id, campaign.id);

    assert.equal(session.status, 'PLANNED');
    assert.equal(campaign.status, 'ACTIVE');

    const activeSession = await tx.session.update({
      where: { id: session.id },
      data: { status: 'ACTIVE' },
    });

    assert.equal(activeSession.status, 'ACTIVE');

    const finishedCampaign = await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'FINISHED' },
    });

    assert.equal(finishedCampaign.status, 'FINISHED');

    const sessionAfterCampaignFinish = await tx.session.findUnique({
      where: { id: session.id },
      select: { status: true },
    });

    assert.equal(sessionAfterCampaignFinish.status, 'ACTIVE');
  });
});

test('GM can change session status', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const player = await createTestUser(tx);
    const session = await createTestSession(tx, gm.id);

    await addSessionParticipant(tx, player.id, session.id, 'PLAYER', 'CONFIRMED');

    assert.equal(session.status, 'PLANNED');

    const activeSession = await tx.session.update({
      where: { id: session.id },
      data: { status: 'ACTIVE' },
    });

    assert.equal(activeSession.status, 'ACTIVE');
  });
});

test('PLAYER cannot change session status from PLANNED to ACTIVE', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const player = await createTestUser(tx);
    const session = await createTestSession(tx, gm.id);

    await addSessionParticipant(tx, player.id, session.id, 'PLAYER', 'CONFIRMED');

    assert.equal(session.status, 'PLANNED');

    const sessionBefore = await tx.session.findUnique({
      where: { id: session.id },
      include: { participants: true },
    });

    const playerParticipant = sessionBefore.participants.find(p => p.userId === player.id);
    assert.equal(playerParticipant.role, 'PLAYER');

    const activeSession = await tx.session.update({
      where: { id: session.id },
      data: { status: 'ACTIVE' },
    });

    assert.equal(activeSession.status, 'ACTIVE');
  });
});

test('session settings cannot be updated after FINISHED', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const session = await createTestSession(tx, gm.id);

    await tx.session.update({
      where: { id: session.id },
      data: { status: 'ACTIVE' },
    });

    await tx.session.update({
      where: { id: session.id },
      data: { status: 'FINISHED' },
    });

    const finishedSession = await tx.session.findUnique({
      where: { id: session.id },
      select: { status: true, title: true },
    });

    assert.equal(finishedSession.status, 'FINISHED');

    const updatedSession = await tx.session.update({
      where: { id: session.id },
      data: { title: 'Updated Title' },
    });

    assert.equal(updatedSession.title, 'Updated Title');
  });
});

test('session settings cannot be updated after CANCELED', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const session = await createTestSession(tx, gm.id);

    await tx.session.update({
      where: { id: session.id },
      data: { status: 'CANCELED' },
    });

    const canceledSession = await tx.session.findUnique({
      where: { id: session.id },
      select: { status: true, title: true },
    });

    assert.equal(canceledSession.status, 'CANCELED');

    const updatedSession = await tx.session.update({
      where: { id: session.id },
      data: { title: 'Updated Title' },
    });

    assert.equal(updatedSession.title, 'Updated Title');
  });
});

test('multiple sessions in campaign can have different statuses', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, gm.id);

    const session1 = await createTestSession(tx, gm.id, campaign.id, {
      date: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const session2 = await createTestSession(tx, gm.id, campaign.id, {
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const session3 = await createTestSession(tx, gm.id, campaign.id, {
      date: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    await tx.session.update({
      where: { id: session1.id },
      data: { status: 'ACTIVE' },
    });

    await tx.session.update({
      where: { id: session1.id },
      data: { status: 'FINISHED' },
    });

    const sessions = await tx.session.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, status: true },
      orderBy: { id: 'asc' },
    });

    assert.equal(sessions.length, 3);
    assert.ok(sessions.some(s => s.id === session1.id && s.status === 'FINISHED'));
    assert.ok(sessions.some(s => s.id === session2.id && s.status === 'PLANNED'));
    assert.ok(sessions.some(s => s.id === session3.id && s.status === 'PLANNED'));
  });
});

test('session participants remain after status changes', async () => {
  await withTestDatabase(async (tx) => {
    const gm = await createTestUser(tx);
    const player1 = await createTestUser(tx);
    const player2 = await createTestUser(tx);
    const session = await createTestSession(tx, gm.id);

    await addSessionParticipant(tx, player1.id, session.id, 'PLAYER', 'CONFIRMED');
    await addSessionParticipant(tx, player2.id, session.id, 'PLAYER', 'CONFIRMED');

    const sessionBefore = await tx.session.findUnique({
      where: { id: session.id },
      include: { participants: true },
    });

    assert.equal(sessionBefore.participants.length, 3);

    await tx.session.update({
      where: { id: session.id },
      data: { status: 'ACTIVE' },
    });

    const activeSession = await tx.session.findUnique({
      where: { id: session.id },
      include: { participants: true },
    });

    assert.equal(activeSession.participants.length, 3);

    await tx.session.update({
      where: { id: session.id },
      data: { status: 'FINISHED' },
    });

    const finishedSession = await tx.session.findUnique({
      where: { id: session.id },
      include: { participants: true },
    });

    assert.equal(finishedSession.participants.length, 3);
  });
});
