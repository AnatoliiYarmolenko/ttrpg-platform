const test = require('node:test');
const assert = require('node:assert/strict');

const sessionService = require('../../src/services/session.service');
const { prisma } = require('../../src/lib/prisma');
const permissionHelpers = require('../../src/services/session/session-permission.helpers');
const notificationService = require('../../src/services/notification.service');
const { createRawEncryptedAndHashedShareToken } = require('../../src/utils/token.helper');

function withMockedPrismaUpdate(mockImpl, callback) {
  const originalUpdate = prisma.session.update;
  prisma.session.update = mockImpl;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      prisma.session.update = originalUpdate;
    });
}

function withMockedCanChangeSessionStatus(mockImpl, callback) {
  const original = permissionHelpers._canChangeSessionStatus;
  permissionHelpers._canChangeSessionStatus = mockImpl;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      permissionHelpers._canChangeSessionStatus = original;
    });
}

function withMockedSessionById(mockImpl, callback) {
  const original = sessionService.queryService.getSessionById;
  sessionService.queryService.getSessionById = mockImpl;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      sessionService.queryService.getSessionById = original;
    });
}

function withMockedPrismaFindUnique(mockImpl, callback) {
  const originalFindUnique = prisma.session.findUnique;
  prisma.session.findUnique = mockImpl;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      prisma.session.findUnique = originalFindUnique;
    });
}

function withMockedNotificationCreate(mockImpl, callback) {
  const originalCreateNotification = notificationService.createNotification;
  notificationService.createNotification = mockImpl;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      notificationService.createNotification = originalCreateNotification;
    });
}

test('campaign owner can cancel foreign PLANNED session in own campaign', async () => {
  const session = {
    id: 300,
    ownerId: 22,
    status: 'PLANNED',
    campaign: { ownerId: 11 },
    participants: [],
  };

  let updateCallCount = 0;

  await withMockedNotificationCreate(async () => null, async () => {
    await withMockedPrismaUpdate(async () => {
      updateCallCount += 1;
      return {
        id: session.id,
        status: 'CANCELED',
        owner: { id: session.ownerId, username: 'gm_foreign' },
        participants: [],
      };
    }, async () => {
      const result = await sessionService.cancelSession(session.id, 11, { preloadedSession: session });

      assert.equal(result.status, 'CANCELED');
      assert.equal(updateCallCount, 1);
    });
  });
});

test('confirmed GM can cancel ACTIVE session', async () => {
  const session = {
    id: 301,
    ownerId: 22,
    status: 'ACTIVE',
    campaign: { ownerId: 99 },
    participants: [
      { id: 1, userId: 33, role: 'GM', status: 'CONFIRMED' },
    ],
  };

  await withMockedNotificationCreate(async () => null, async () => {
    await withMockedCanChangeSessionStatus(
      (targetSession, userId) => targetSession.id === 301 && userId === 33,
      async () => {
        await withMockedPrismaUpdate(async () => ({
          id: session.id,
          status: 'CANCELED',
          owner: { id: session.ownerId, username: 'gm_foreign' },
          participants: [],
        }), async () => {
          const result = await sessionService.cancelSession(session.id, 33, { preloadedSession: session });
          assert.equal(result.status, 'CANCELED');
        });
      }
    );
  });
});

test('confirmed GM cannot cancel PLANNED session', async () => {
  const session = {
    id: 302,
    ownerId: 22,
    status: 'PLANNED',
    campaign: { ownerId: 99 },
    participants: [
      { id: 1, userId: 33, role: 'GM', status: 'CONFIRMED' },
    ],
  };

  await withMockedNotificationCreate(async () => null, async () => {
    await withMockedCanChangeSessionStatus(
      (targetSession, userId) => targetSession.id === 302 && userId === 33,
      async () => {
        await assert.rejects(
          () => sessionService.cancelSession(session.id, 33, { preloadedSession: session }),
          (error) => error?.code === 'SESSION_OWNER_ONLY'
        );
      }
    );
  });
});

test('cannot update session settings when campaign is finished', async () => {
  const preloadedSession = {
    id: 451,
    ownerId: 11,
    status: 'PLANNED',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    duration: 180,
    participants: [
      {
        id: 901,
        userId: 11,
        role: 'GM',
        status: 'CONFIRMED',
      },
    ],
    campaign: {
      id: 88,
      ownerId: 11,
      status: 'FINISHED',
    },
  };

  await assert.rejects(
    () => sessionService.updateSession(preloadedSession.id, 11, { title: 'Updated title' }, { preloadedSession }),
    (error) => error?.code === 'CAMPAIGN_FINISHED'
  );
});

test('cannot create campaign session with LINK_ONLY visibility', async () => {
  const originalAssertNoConflict = sessionService._assertNoSessionTimeConflict;
  sessionService._assertNoSessionTimeConflict = async () => true;

  try {
    await assert.rejects(
      () => sessionService.createSession({
        title: 'Blocked campaign session',
        description: null,
        date: new Date(Date.now() + 86_400_000),
        duration: 180,
        maxPlayers: 4,
        price: 0,
        campaignId: 10,
        ownerId: 1,
        visibility: 'LINK_ONLY',
        system: 'D&D 5e',
        isGm: true,
      }),
      (error) => error?.code === 'VALIDATION_FAILED' && /LINK_ONLY/i.test(error.message)
    );
  } finally {
    sessionService._assertNoSessionTimeConflict = originalAssertNoConflict;
  }
});

test('cannot update campaign session visibility to LINK_ONLY', async () => {
  const preloadedSession = {
    id: 701,
    campaignId: 88,
    ownerId: 11,
    status: 'PLANNED',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    duration: 180,
    participants: [
      {
        id: 1001,
        userId: 11,
        role: 'GM',
        status: 'CONFIRMED',
      },
    ],
    campaign: {
      id: 88,
      ownerId: 11,
      status: 'ACTIVE',
    },
  };

  await assert.rejects(
    () => sessionService.updateSession(
      preloadedSession.id,
      11,
      { visibility: 'LINK_ONLY' },
      { preloadedSession }
    ),
    (error) => error?.code === 'SESSION_LINK_ONLY_ONE_SHOT_ONLY'
  );
});

test('confirmed player can regenerate share link for one-shot LINK_ONLY session without confirmed GM', async () => {
  const session = {
    id: 901,
    ownerId: 10,
    campaignId: null,
    visibility: 'LINK_ONLY',
    campaign: null,
    participants: [
      { id: 1, userId: 10, role: 'PLAYER', status: 'CONFIRMED' },
      { id: 2, userId: 33, role: 'PLAYER', status: 'CONFIRMED' },
    ],
  };

  await withMockedSessionById(
    async () => session,
    async () => {
      await withMockedPrismaUpdate(async () => ({ id: session.id }), async () => {
        const result = await sessionService.regenerateShareToken(session.id, 33);
        assert.equal(result.sessionId, session.id);
        assert.equal(typeof result.token, 'string');
        assert.equal(result.token.length > 0, true);
      });
    }
  );
});

test('confirmed player can read share link for one-shot LINK_ONLY session without confirmed GM', async () => {
  const shareTokenData = createRawEncryptedAndHashedShareToken();
  const session = {
    id: 902,
    ownerId: 10,
    campaignId: null,
    visibility: 'LINK_ONLY',
    campaign: null,
    participants: [
      { id: 1, userId: 10, role: 'PLAYER', status: 'CONFIRMED' },
      { id: 2, userId: 33, role: 'PLAYER', status: 'CONFIRMED' },
    ],
  };

  await withMockedSessionById(
    async () => session,
    async () => {
      await withMockedPrismaFindUnique(
        async () => ({ shareTokenEncrypted: shareTokenData.tokenEncrypted }),
        async () => {
          const result = await sessionService.getSessionShareLink(session.id, 33);
          assert.equal(typeof result.token, 'string');
          assert.equal(result.shareUrl.includes('/session/share/'), true);
        }
      );
    }
  );
});

test('cannot update settings for FINISHED session', async () => {
  const preloadedSession = {
    id: 903,
    ownerId: 11,
    status: 'FINISHED',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    duration: 180,
    participants: [
      {
        id: 1101,
        userId: 11,
        role: 'GM',
        status: 'CONFIRMED',
      },
    ],
    campaign: null,
  };

  await assert.rejects(
    () => sessionService.updateSession(preloadedSession.id, 11, { title: 'Updated title' }, { preloadedSession }),
    (error) => error?.code === 'SESSION_SETTINGS_UPDATE_FORBIDDEN'
  );
});

test('cannot update settings for CANCELED session', async () => {
  const preloadedSession = {
    id: 904,
    ownerId: 11,
    status: 'CANCELED',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    duration: 180,
    participants: [
      {
        id: 1102,
        userId: 11,
        role: 'GM',
        status: 'CONFIRMED',
      },
    ],
    campaign: null,
  };

  await assert.rejects(
    () => sessionService.updateSession(preloadedSession.id, 11, { title: 'Updated title' }, { preloadedSession }),
    (error) => error?.code === 'SESSION_SETTINGS_UPDATE_FORBIDDEN'
  );
});

test('cannot regenerate share link for FINISHED LINK_ONLY session', async () => {
  const session = {
    id: 905,
    ownerId: 10,
    status: 'FINISHED',
    campaignId: null,
    visibility: 'LINK_ONLY',
    campaign: null,
    participants: [
      { id: 1, userId: 10, role: 'PLAYER', status: 'CONFIRMED' },
    ],
  };

  await withMockedSessionById(
    async () => session,
    async () => {
      await assert.rejects(
        () => sessionService.regenerateShareToken(session.id, 10),
        (error) => error?.code === 'SECURITY_ACCESS_DENIED'
      );
    }
  );
});
