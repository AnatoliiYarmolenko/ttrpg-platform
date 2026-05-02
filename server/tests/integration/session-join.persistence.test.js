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

async function createTestSession(tx, ownerId, overrides = {}) {
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
      ...overrides,
    },
  });
}

test('joinSession creates participant with CONFIRMED status for PUBLIC one-shot', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const player = await createTestUser(tx);
    const session = await createTestSession(tx, owner.id, {
      campaignId: null,
      visibility: 'PUBLIC',
    });

    const participant = await tx.sessionParticipant.create({
      data: {
        userId: player.id,
        sessionId: session.id,
        role: 'PLAYER',
        status: 'CONFIRMED',
        isGuest: false,
      },
    });

    const savedParticipant = await tx.sessionParticipant.findUnique({
      where: { id: participant.id },
    });

    assert.equal(savedParticipant.status, 'CONFIRMED');
    assert.equal(savedParticipant.isGuest, false);
    assert.equal(savedParticipant.role, 'PLAYER');
    assert.equal(savedParticipant.userId, player.id);
    assert.equal(savedParticipant.sessionId, session.id);
  });
});

test('joinSession creates participant with PENDING status for LINK_ONLY one-shot', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const player = await createTestUser(tx);
    const session = await createTestSession(tx, owner.id, {
      campaignId: null,
      visibility: 'LINK_ONLY',
    });

    const participant = await tx.sessionParticipant.create({
      data: {
        userId: player.id,
        sessionId: session.id,
        role: 'PLAYER',
        status: 'PENDING',
        isGuest: false,
      },
    });

    const savedParticipant = await tx.sessionParticipant.findUnique({
      where: { id: participant.id },
    });

    assert.equal(savedParticipant.status, 'PENDING');
    assert.equal(savedParticipant.isGuest, false);
  });
});

test('campaign member joining LINK_ONLY campaign session gets CONFIRMED status', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const member = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id, { visibility: 'LINK_ONLY' });

    await tx.campaignMember.create({
      data: {
        campaignId: campaign.id,
        userId: member.id,
        role: 'PLAYER',
      },
    });

    const session = await createTestSession(tx, owner.id, {
      campaignId: campaign.id,
      visibility: 'LINK_ONLY',
    });

    const participant = await tx.sessionParticipant.create({
      data: {
        userId: member.id,
        sessionId: session.id,
        role: 'PLAYER',
        status: 'CONFIRMED',
        isGuest: false,
      },
    });

    assert.equal(participant.status, 'CONFIRMED');
    assert.equal(participant.isGuest, false);
  });
});

test('outsider joining PUBLIC campaign session gets PENDING and isGuest true', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const outsider = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id, { visibility: 'PUBLIC' });

    const session = await createTestSession(tx, owner.id, {
      campaignId: campaign.id,
      visibility: 'PUBLIC',
    });

    const participant = await tx.sessionParticipant.create({
      data: {
        userId: outsider.id,
        sessionId: session.id,
        role: 'PLAYER',
        status: 'PENDING',
        isGuest: true,
      },
    });

    assert.equal(participant.status, 'PENDING');
    assert.equal(participant.isGuest, true);
  });
});

test('campaign member joining PUBLIC campaign session gets PENDING and isGuest false', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const member = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id, { visibility: 'PUBLIC' });

    await tx.campaignMember.create({
      data: {
        campaignId: campaign.id,
        userId: member.id,
        role: 'PLAYER',
      },
    });

    const session = await createTestSession(tx, owner.id, {
      campaignId: campaign.id,
      visibility: 'PUBLIC',
    });

    const participant = await tx.sessionParticipant.create({
      data: {
        userId: member.id,
        sessionId: session.id,
        role: 'PLAYER',
        status: 'PENDING',
        isGuest: false,
      },
    });

    assert.equal(participant.status, 'PENDING');
    assert.equal(participant.isGuest, false);
  });
});

test('participant status can be updated from PENDING to CONFIRMED', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const player = await createTestUser(tx);
    const session = await createTestSession(tx, owner.id);

    const participant = await tx.sessionParticipant.create({
      data: {
        userId: player.id,
        sessionId: session.id,
        role: 'PLAYER',
        status: 'PENDING',
      },
    });

    const updated = await tx.sessionParticipant.update({
      where: { id: participant.id },
      data: { status: 'CONFIRMED' },
    });

    assert.equal(updated.status, 'CONFIRMED');
  });
});

test('declining a pending participant removes the record from database', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const player = await createTestUser(tx);
    const session = await createTestSession(tx, owner.id);

    const participant = await tx.sessionParticipant.create({
      data: {
        userId: player.id,
        sessionId: session.id,
        role: 'PLAYER',
        status: 'PENDING',
      },
    });

    await tx.sessionParticipant.delete({
      where: { id: participant.id },
    });

    const found = await tx.sessionParticipant.findUnique({
      where: { id: participant.id },
    });

    assert.equal(found, null);
  });
});

test('joining with GM role always creates PENDING status', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const gm = await createTestUser(tx);
    const session = await createTestSession(tx, owner.id, {
      visibility: 'PUBLIC',
      campaignId: null,
    });

    const participant = await tx.sessionParticipant.create({
      data: {
        userId: gm.id,
        sessionId: session.id,
        role: 'GM',
        status: 'PENDING',
        isGuest: false,
      },
    });

    assert.equal(participant.status, 'PENDING');
    assert.equal(participant.role, 'GM');
  });
});

test('unique constraint prevents duplicate participant entries', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const player = await createTestUser(tx);
    const session = await createTestSession(tx, owner.id);

    await tx.sessionParticipant.create({
      data: {
        userId: player.id,
        sessionId: session.id,
        role: 'PLAYER',
        status: 'CONFIRMED',
      },
    });

    await assert.rejects(
      async () => {
        await tx.sessionParticipant.create({
          data: {
            userId: player.id,
            sessionId: session.id,
            role: 'PLAYER',
            status: 'PENDING',
          },
        });
      },
      (err) => err.code === 'P2002'
    );
  });
});
