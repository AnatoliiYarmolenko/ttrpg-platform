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
      system: 'D&D 5e',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      ownerId,
      ...overrides,
    },
  });
}

async function createTestSession(tx, ownerId, campaignId, status = 'PLANNED', overrides = {}) {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tx.session.create({
    data: {
      title: 'Test Session',
      description: 'A test session',
      date: futureDate,
      duration: 180,
      maxPlayers: 5,
      visibility: 'PUBLIC',
      status,
      campaignId,
      ownerId,
      ...overrides,
    },
  });
}

test('finishing campaign transitions ACTIVE sessions to FINISHED', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id, { status: 'ACTIVE' });
    const activeSession = await createTestSession(tx, owner.id, campaign.id, 'ACTIVE');

    await tx.session.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'FINISHED',
      },
    });

    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'FINISHED' },
    });

    const finishedSession = await tx.session.findUnique({
      where: { id: activeSession.id },
    });

    assert.equal(finishedSession.status, 'FINISHED');
  });
});

test('finishing campaign transitions PLANNED sessions to CANCELED', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id, { status: 'ACTIVE' });
    const plannedSession = await createTestSession(tx, owner.id, campaign.id, 'PLANNED');

    await tx.session.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'PLANNED',
      },
      data: {
        status: 'CANCELED',
      },
    });

    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'FINISHED' },
    });

    const canceledSession = await tx.session.findUnique({
      where: { id: plannedSession.id },
    });

    assert.equal(canceledSession.status, 'CANCELED');
  });
});

test('finishing campaign transitions both ACTIVE and PLANNED sessions correctly', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id, { status: 'ACTIVE' });
    const activeSession = await createTestSession(tx, owner.id, campaign.id, 'ACTIVE');
    const plannedSession = await createTestSession(tx, owner.id, campaign.id, 'PLANNED');

    await tx.session.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'FINISHED',
      },
    });

    await tx.session.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'PLANNED',
      },
      data: {
        status: 'CANCELED',
      },
    });

    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'FINISHED' },
    });

    const sessions = await tx.session.findMany({
      where: { campaignId: campaign.id },
    });

    const finishedSession = sessions.find(s => s.id === activeSession.id);
    const canceledSession = sessions.find(s => s.id === plannedSession.id);

    assert.equal(finishedSession.status, 'FINISHED');
    assert.equal(canceledSession.status, 'CANCELED');
  });
});

test('finishing campaign does not affect FINISHED sessions', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id, { status: 'ACTIVE' });
    const finishedSession = await createTestSession(tx, owner.id, campaign.id, 'FINISHED');

    await tx.session.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'FINISHED',
      },
    });

    await tx.session.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'PLANNED',
      },
      data: {
        status: 'CANCELED',
      },
    });

    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'FINISHED' },
    });

    const session = await tx.session.findUnique({
      where: { id: finishedSession.id },
    });

    assert.equal(session.status, 'FINISHED');
  });
});

test('finishing campaign does not affect CANCELED sessions', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id, { status: 'ACTIVE' });
    const canceledSession = await createTestSession(tx, owner.id, campaign.id, 'CANCELED');

    await tx.session.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'FINISHED',
      },
    });

    await tx.session.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'PLANNED',
      },
      data: {
        status: 'CANCELED',
      },
    });

    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'FINISHED' },
    });

    const session = await tx.session.findUnique({
      where: { id: canceledSession.id },
    });

    assert.equal(session.status, 'CANCELED');
  });
});

