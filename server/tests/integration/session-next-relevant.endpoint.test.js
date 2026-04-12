const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createApp } = require('../../src/app');
const { prisma } = require('../../src/lib/prisma');
const config = require('../../src/config/config');

function createAuthToken(userId) {
  return jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: '1h' });
}

function buildSession(overrides = {}) {
  return {
    id: 1,
    title: 'Test Session',
    status: 'PLANNED',
    visibility: 'PRIVATE',
    maxPlayers: 4,
    date: new Date('2026-04-12T12:00:00.000Z'),
    campaign: null,
    participants: [
      {
        userId: 42,
        role: 'PLAYER',
        status: 'CONFIRMED',
      },
    ],
    ...overrides,
  };
}

async function withMockedPrismaSessionFindMany(mockImpl, callback) {
  const originalSessionFindMany = prisma.session.findMany;
  const originalUserFindUnique = prisma.user.findUnique;

  prisma.session.findMany = mockImpl;
  prisma.user.findUnique = async () => ({ isDeleted: false });

  try {
    return await callback();
  } finally {
    prisma.session.findMany = originalSessionFindMany;
    prisma.user.findUnique = originalUserFindUnique;
  }
}

async function withServer(callback) {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    return await callback(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /api/sessions/next-relevant returns 401 for anonymous user', async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/sessions/next-relevant`);

    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.code, 'AUTH_TOKEN_MISSING');
  });
});

test('GET /api/sessions/next-relevant returns ACTIVE session on happy path', async () => {
  await withMockedPrismaSessionFindMany(async (args) => {
    assert.equal(args.where.participants.some.userId, 42);

    return [
      buildSession({
        id: 10,
        status: 'ACTIVE',
        description: 'Опис активної сесії',
        date: new Date(Date.now() - 30 * 60 * 1000),
      }),
      buildSession({
        id: 11,
        status: 'PLANNED',
        date: new Date(Date.now() + 30 * 60 * 1000),
      }),
    ];
  }, async () => {
    await withServer(async (port) => {
      const token = createAuthToken(42);
      const response = await fetch(`http://127.0.0.1:${port}/api/sessions/next-relevant`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const body = await response.json();

      assert.equal(body.success, true);
      assert.equal(body.data.session.id, 10);
      assert.equal(body.data.session.status, 'ACTIVE');
      assert.equal(body.data.session.myStatus, 'CONFIRMED');
      assert.equal(body.data.session.maxPlayers, 4);
      assert.equal(body.data.session.description, 'Опис активної сесії');
      assert.equal(body.data.session.plannedToleranceMinutes, config.homePlannedToleranceMinutes);
    });
  });
});

test('GET /api/sessions/next-relevant falls back to PLANNED when ACTIVE is zombie', async () => {
  const originalHomeActiveMaxAgeHours = config.homeActiveMaxAgeHours;
  config.homeActiveMaxAgeHours = 1;

  try {
    await withMockedPrismaSessionFindMany(async () => {
      return [
        buildSession({
          id: 20,
          status: 'ACTIVE',
          date: new Date(Date.now() - 2 * 60 * 60 * 1000),
        }),
        buildSession({
          id: 21,
          status: 'PLANNED',
          date: new Date(Date.now() + 25 * 60 * 1000),
        }),
      ];
    }, async () => {
      await withServer(async (port) => {
        const token = createAuthToken(42);
        const response = await fetch(`http://127.0.0.1:${port}/api/sessions/next-relevant`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.data.session.id, 21);
        assert.equal(body.data.session.status, 'PLANNED');
      });
    });
  } finally {
    config.homeActiveMaxAgeHours = originalHomeActiveMaxAgeHours;
  }
});

test('GET /api/sessions/next-relevant returns session null when no relevant candidates', async () => {
  await withMockedPrismaSessionFindMany(async () => {
    return [
      buildSession({
        id: 30,
        status: 'FINISHED',
        date: new Date(Date.now() - 60 * 60 * 1000),
      }),
      buildSession({
        id: 31,
        status: 'PLANNED',
        date: new Date(Date.now() + 60 * 60 * 1000),
        participants: [
          {
            userId: 42,
            role: 'PLAYER',
            status: 'PENDING',
          },
        ],
      }),
    ];
  }, async () => {
    await withServer(async (port) => {
      const token = createAuthToken(42);
      const response = await fetch(`http://127.0.0.1:${port}/api/sessions/next-relevant`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.data.session, null);
    });
  });
});
