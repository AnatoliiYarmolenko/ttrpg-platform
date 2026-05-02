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

async function createTestSession(tx, ownerId, status = 'PLANNED', overrides = {}) {
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
      ownerId,
      ...overrides,
    },
  });
}

async function createSessionParticipant(tx, userId, sessionId, role = 'PLAYER', status = 'CONFIRMED') {
  return tx.sessionParticipant.create({
    data: {
      userId,
      sessionId,
      role,
      status,
    },
  });
}

test('query returns ACTIVE session when available', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    const activeSession = await createTestSession(tx, user.id, 'ACTIVE', {
      date: new Date(Date.now() - 30 * 60 * 1000),
    });
    await createSessionParticipant(tx, user.id, activeSession.id, 'PLAYER', 'CONFIRMED');

    const sessions = await tx.session.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
            status: 'CONFIRMED',
          },
        },
      },
      include: {
        participants: {
          where: {
            userId: user.id,
          },
        },
      },
    });

    const activeSessionResult = sessions.find(s => s.id === activeSession.id);
    assert.ok(activeSessionResult);
    assert.equal(activeSessionResult.status, 'ACTIVE');
    assert.equal(activeSessionResult.participants[0].status, 'CONFIRMED');
  });
});

test('query returns PLANNED session when no ACTIVE exists', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    const plannedSession = await createTestSession(tx, user.id, 'PLANNED', {
      date: new Date(Date.now() + 30 * 60 * 1000),
    });
    await createSessionParticipant(tx, user.id, plannedSession.id, 'PLAYER', 'CONFIRMED');

    const sessions = await tx.session.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
            status: 'CONFIRMED',
          },
        },
      },
      include: {
        participants: {
          where: {
            userId: user.id,
          },
        },
      },
    });

    const plannedSessionResult = sessions.find(s => s.id === plannedSession.id);
    assert.ok(plannedSessionResult);
    assert.equal(plannedSessionResult.status, 'PLANNED');
    assert.equal(plannedSessionResult.participants[0].status, 'CONFIRMED');
  });
});

test('query returns empty when user has no sessions', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);

    const sessions = await tx.session.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
            status: 'CONFIRMED',
          },
        },
      },
    });

    assert.equal(sessions.length, 0);
  });
});

test('query ignores sessions with PENDING status', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    const plannedSession = await createTestSession(tx, user.id, 'PLANNED', {
      date: new Date(Date.now() + 30 * 60 * 1000),
    });
    await createSessionParticipant(tx, user.id, plannedSession.id, 'PLAYER', 'PENDING');

    const sessions = await tx.session.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
            status: 'CONFIRMED',
          },
        },
      },
    });

    assert.equal(sessions.length, 0);
  });
});

test('query ignores FINISHED sessions', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    const finishedSession = await createTestSession(tx, user.id, 'FINISHED', {
      date: new Date(Date.now() - 60 * 60 * 1000),
    });
    await createSessionParticipant(tx, user.id, finishedSession.id, 'PLAYER', 'CONFIRMED');

    const sessions = await tx.session.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
            status: 'CONFIRMED',
          },
        },
        status: {
          in: ['ACTIVE', 'PLANNED'],
        },
      },
    });

    assert.equal(sessions.length, 0);
  });
});

test('query ignores CANCELED sessions', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    const canceledSession = await createTestSession(tx, user.id, 'CANCELED', {
      date: new Date(Date.now() + 30 * 60 * 1000),
    });
    await createSessionParticipant(tx, user.id, canceledSession.id, 'PLAYER', 'CONFIRMED');

    const sessions = await tx.session.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
            status: 'CONFIRMED',
          },
        },
        status: {
          in: ['ACTIVE', 'PLANNED'],
        },
      },
    });

    assert.equal(sessions.length, 0);
  });
});

test('query returns both ACTIVE and PLANNED when both exist', async () => {
  await withTestDatabase(async (tx) => {
    const user = await createTestUser(tx);
    const activeSession = await createTestSession(tx, user.id, 'ACTIVE', {
      date: new Date(Date.now() - 30 * 60 * 1000),
    });
    const plannedSession = await createTestSession(tx, user.id, 'PLANNED', {
      date: new Date(Date.now() + 30 * 60 * 1000),
    });
    await createSessionParticipant(tx, user.id, activeSession.id, 'PLAYER', 'CONFIRMED');
    await createSessionParticipant(tx, user.id, plannedSession.id, 'PLAYER', 'CONFIRMED');

    const sessions = await tx.session.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
            status: 'CONFIRMED',
          },
        },
      },
      include: {
        participants: {
          where: {
            userId: user.id,
          },
        },
      },
    });

    assert.equal(sessions.length, 2);
    assert.ok(sessions.some(s => s.id === activeSession.id && s.status === 'ACTIVE'));
    assert.ok(sessions.some(s => s.id === plannedSession.id && s.status === 'PLANNED'));
  });
});
