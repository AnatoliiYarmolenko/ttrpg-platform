const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');

const test = require('node:test');
const { mock } = require('node:test');
const assert = require('node:assert/strict');
const { SessionService } = require('../../src/services/session.service');
const notificationService = require('../../src/services/notification.service');

async function withTestDatabase(callback) {
  const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

  if (!testDbUrl) {
    test.skip('DATABASE_URL not set, skipping integration test');
    return;
  }

  const testPrisma = new PrismaClient({
    datasources: { db: { url: testDbUrl } },
  });

  try {
    await testPrisma.$connect();
    await testPrisma.$transaction(async (tx) => {
      tx.$transaction = async (queries) => {
        if (typeof queries === 'function') {
          return queries(tx);
        }
        const results = [];
        for (const q of queries) { results.push(await q); }
        return results;
      };
      await callback(tx);
      throw new Error('ROLLBACK');
    }).catch((err) => {
      if (err.message !== 'ROLLBACK') throw err;
    });
  } finally {
    await testPrisma.$disconnect();
  }
}

async function createTestUser(tx, overrides = {}) {
  const timestamp = Date.now();
  return tx.user.create({
    data: {
      username: `user_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      email: `test_${timestamp}@example.com`,
      password: 'password123',
      ...overrides,
    },
  });
}

async function createTestSession(tx, ownerId, overrides = {}) {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tx.session.create({
    data: {
      title: 'Test Session',
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

test('SessionParticipantsService Integration Tests', async (t) => {
  t.beforeEach(() => {
    mock.method(notificationService, 'createNotification', async () => {});
  });

  t.afterEach(() => {
    if (notificationService.createNotification.mock) {
      notificationService.createNotification.mock.restore();
    }
  });

  await t.test('joinSession as GM always creates PENDING request', async () => {
    await withTestDatabase(async (tx) => {
      const service = new SessionService(tx);
      const owner = await createTestUser(tx);
      const gm = await createTestUser(tx);
      const session = await createTestSession(tx, owner.id);

      const participant = await service.joinSession(session.id, gm.id, { role: 'GM' });
      assert.equal(participant.status, 'PENDING');
      assert.equal(participant.role, 'GM');
      assert.equal(participant.userId, gm.id);
    });
  });

  await t.test('updateParticipantStatus - GM gets CONFIRMED and removes other GM requests', async () => {
    await withTestDatabase(async (tx) => {
      const service = new SessionService(tx);
      const owner = await createTestUser(tx);
      const gm1 = await createTestUser(tx);
      const gm2 = await createTestUser(tx);
      const session = await createTestSession(tx, owner.id);

      const p1 = await service.joinSession(session.id, gm1.id, { role: 'GM' });
      const p2 = await service.joinSession(session.id, gm2.id, { role: 'GM' });

      const updated = await service.updateParticipantStatus(session.id, p1.id, owner.id, 'CONFIRMED');
      assert.equal(updated.status, 'CONFIRMED');

      const gm2Db = await tx.sessionParticipant.findUnique({ where: { id: p2.id } });
      assert.equal(gm2Db, null);
    });
  });

  await t.test('leaveSession allows participant to leave PLANNED session', async () => {
    await withTestDatabase(async (tx) => {
      const service = new SessionService(tx);
      const owner = await createTestUser(tx);
      const player = await createTestUser(tx);
      const session = await createTestSession(tx, owner.id);

      const participant = await service.joinSession(session.id, player.id, { role: 'PLAYER' });
      assert.ok(participant);

      await service.leaveSession(session.id, player.id);

      const dbParticipant = await tx.sessionParticipant.findUnique({ where: { id: participant.id } });
      assert.equal(dbParticipant, null);
    });
  });

  await t.test('removeParticipant allows owner to remove player', async () => {
    await withTestDatabase(async (tx) => {
      const service = new SessionService(tx);
      const owner = await createTestUser(tx);
      const player = await createTestUser(tx);
      const session = await createTestSession(tx, owner.id);

      const participant = await service.joinSession(session.id, player.id, { role: 'PLAYER' });
      
      await service.removeParticipant(session.id, participant.id, owner.id);

      const dbParticipant = await tx.sessionParticipant.findUnique({ where: { id: participant.id } });
      assert.equal(dbParticipant, null);
    });
  });

  await t.test('kickGm allows owner to kick CONFIRMED GM from PLANNED session', async () => {
    await withTestDatabase(async (tx) => {
      const service = new SessionService(tx);
      const owner = await createTestUser(tx);
      const gm = await createTestUser(tx);
      const session = await createTestSession(tx, owner.id);

      const p = await service.joinSession(session.id, gm.id, { role: 'GM' });
      await service.updateParticipantStatus(session.id, p.id, owner.id, 'CONFIRMED');

      await service.kickGm(session.id, owner.id);

      const dbParticipant = await tx.sessionParticipant.findUnique({ where: { id: p.id } });
      assert.equal(dbParticipant, null);
    });
  });

  await t.test('joinSession throws error if max players reached', async () => {
    await withTestDatabase(async (tx) => {
      const service = new SessionService(tx);
      const owner = await createTestUser(tx);
      const session = await createTestSession(tx, owner.id, { maxPlayers: 1 });

      const player1 = await createTestUser(tx);
      const player2 = await createTestUser(tx);

      await tx.sessionParticipant.create({
        data: { sessionId: session.id, userId: player1.id, role: 'PLAYER', status: 'CONFIRMED' }
      });

      await assert.rejects(
        service.joinSession(session.id, player2.id, { role: 'PLAYER' }),
        (err) => err.code === 'SESSION_JOIN_NO_FREE_PLAYER_SLOTS'
      );
    });
  });

  await t.test('updateParticipantStatus - DECLINED removes participant from db', async () => {
    await withTestDatabase(async (tx) => {
      const service = new SessionService(tx);
      const owner = await createTestUser(tx);
      const player = await createTestUser(tx);
      const session = await createTestSession(tx, owner.id, { visibility: 'PUBLIC' });

      const p = await service.joinSession(session.id, player.id, { role: 'GM' });
      assert.equal(p.status, 'PENDING');

      const declined = await service.updateParticipantStatus(session.id, p.id, owner.id, 'DECLINED');
      assert.equal(declined.status, 'DECLINED');

      const dbParticipant = await tx.sessionParticipant.findUnique({ where: { id: p.id } });
      assert.equal(dbParticipant, null);
  });
});
});
