const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const { NotificationService } = require('../../src/services/notification.service');

function createMockPrisma(overrides = {}) {
  const notificationRecipient = {
    findFirst: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    update: mock.fn(async ({ data }) => data),
    updateMany: mock.fn(async () => ({ count: 0 })),
    createMany: mock.fn(async () => ({ count: 0 })),
    count: mock.fn(async () => 0),
    ...overrides.notificationRecipient,
  };

  const notification = {
    findFirst: mock.fn(async () => null),
    create: mock.fn(async ({ data }) => ({ id: 1, ...data })),
    ...overrides.notification,
  };

  const user = {
    findMany: mock.fn(async () => []),
    ...overrides.user,
  };

  const outboxEvent = {
    createMany: mock.fn(async () => ({ count: 0 })),
    ...overrides.outboxEvent,
  };

  return {
    notificationRecipient,
    notification,
    user,
    outboxEvent,
    $transaction: mock.fn(async (callback) => callback({
      notificationRecipient,
      notification,
      user,
      outboxEvent,
    })),
    ...overrides,
  };
}

function createMockSseService(overrides = {}) {
  return {
    pushToUsers: mock.fn(() => 0),
    pushToUser: mock.fn(() => false),
    ...overrides,
  };
}

function createMockRecipientResolver(overrides = {}) {
  return {
    resolve: mock.fn(async () => []),
    ...overrides,
  };
}

test('markAsRead throws notification-specific not found error', async () => {
  const mockPrisma = createMockPrisma({
    notificationRecipient: {
      findFirst: mock.fn(async () => null),
    },
  });

  const service = new NotificationService({ prisma: mockPrisma });

  await assert.rejects(
    () => service.markAsRead(12, 34),
    (error) => error?.code === 'NOTIFICATION_NOT_FOUND' && error?.status === 404
  );

  assert.strictEqual(mockPrisma.notificationRecipient.findFirst.mock.callCount(), 1);
  const [call] = mockPrisma.notificationRecipient.findFirst.mock.calls;
  assert.deepStrictEqual(call.arguments[0], {
    where: { userId: 12, notificationId: 34 },
  });
});

test('markAsRead archives active notification and stores timestamps', async () => {
  const activeRecipient = {
    id: 77,
    userId: 12,
    notificationId: 34,
    status: 'ACTIVE',
    readAt: null,
    archivedAt: null,
  };

  const mockPrisma = createMockPrisma({
    notificationRecipient: {
      findFirst: mock.fn(async () => activeRecipient),
      update: mock.fn(async ({ data }) => ({
        ...activeRecipient,
        ...data,
      })),
    },
  });

  const service = new NotificationService({ prisma: mockPrisma });
  const result = await service.markAsRead(12, 34);

  assert.equal(result.status, 'ARCHIVED');
  assert.ok(result.readAt instanceof Date);
  assert.ok(result.archivedAt instanceof Date);
  assert.strictEqual(mockPrisma.notificationRecipient.update.mock.callCount(), 1);
});

test('markAsRead returns already archived notification without updating', async () => {
  const archivedRecipient = {
    id: 77,
    userId: 12,
    notificationId: 34,
    status: 'ARCHIVED',
    readAt: new Date('2026-01-01'),
    archivedAt: new Date('2026-01-01'),
  };

  const mockPrisma = createMockPrisma({
    notificationRecipient: {
      findFirst: mock.fn(async () => archivedRecipient),
      update: mock.fn(async () => { throw new Error('Should not be called'); }),
    },
  });

  const service = new NotificationService({ prisma: mockPrisma });
  const result = await service.markAsRead(12, 34);

  assert.equal(result.status, 'ARCHIVED');
  assert.strictEqual(mockPrisma.notificationRecipient.update.mock.callCount(), 0);
});

test('createNotification only pushes SSE to newly attached recipients for deduped notifications', async () => {
  const existingNotification = {
    id: 55,
    eventKey: 'session.reminder',
    type: 'SESSION_REMINDER',
    severity: 'INFO',
    category: 'session',
    title: 'Нагадування',
    body: 'Сесія скоро почнеться',
    link: '/sessions/55',
    metadata: {},
    createdAt: new Date('2026-05-06T10:00:00.000Z'),
  };

  const mockPrisma = createMockPrisma({
    notification: {
      findFirst: mock.fn(async () => existingNotification),
    },
    notificationRecipient: {
      findMany: mock.fn(async () => [{ userId: 1 }]),
      createMany: mock.fn(async () => ({ count: 1 })),
      findFirst: mock.fn(async () => null),
    },
  });

  const mockSseService = createMockSseService();

  const service = new NotificationService({
    prisma: mockPrisma,
    sseService: mockSseService,
  });

  const result = await service.createNotification({
    eventKey: 'session.reminder',
    type: 'SESSION_REMINDER',
    severity: 'INFO',
    category: 'session',
    title: 'Нагадування',
    body: 'Сесія скоро почнеться',
    dedupeKey: 'session:55:reminder',
    recipientIds: [1, 2],
  });

  assert.equal(result.id, 55);
  assert.strictEqual(mockSseService.pushToUsers.mock.callCount(), 1);

  const [call] = mockSseService.pushToUsers.mock.calls;
  assert.deepStrictEqual(call.arguments[0], [2]);
  assert.equal(call.arguments[1].status, 'ACTIVE');
  assert.equal(call.arguments[1].type, 'SESSION_REMINDER');
});

test('createNotification creates new notification when no dedupeKey match', async () => {
  const newNotification = {
    id: 100,
    eventKey: 'user.invited',
    type: 'USER_INVITED',
    severity: 'INFO',
    category: 'user',
    title: 'Запрошення',
    body: 'Вас запросили до кампанії',
    metadata: {},
    createdAt: new Date(),
  };

  const mockPrisma = createMockPrisma();
  mockPrisma.notification.create = mock.fn(async () => newNotification);

  const mockSseService = createMockSseService();

  const service = new NotificationService({
    prisma: mockPrisma,
    sseService: mockSseService,
  });

  const result = await service.createNotification({
    eventKey: 'user.invited',
    type: 'USER_INVITED',
    severity: 'INFO',
    category: 'user',
    title: 'Запрошення',
    body: 'Вас запросили до кампанії',
    recipientIds: [5, 6],
  });

  assert.equal(result.id, 100);
  assert.strictEqual(mockPrisma.$transaction.mock.callCount(), 1);
  assert.strictEqual(mockSseService.pushToUsers.mock.callCount(), 1);

  const [sseCall] = mockSseService.pushToUsers.mock.calls;
  assert.deepStrictEqual(sseCall.arguments[0], [5, 6]);
});

test('createNotification returns null when no recipients resolved', async () => {
  const mockPrisma = createMockPrisma();
  const mockSseService = createMockSseService();

  const service = new NotificationService({
    prisma: mockPrisma,
    sseService: mockSseService,
  });

  const result = await service.createNotification({
    eventKey: 'test.event',
    type: 'TEST',
    severity: 'INFO',
    category: 'test',
    title: 'Test',
    body: 'Test body',
    recipientIds: [],
  });

  assert.strictEqual(result, null);
  assert.strictEqual(mockPrisma.$transaction.mock.callCount(), 0);
  assert.strictEqual(mockSseService.pushToUsers.mock.callCount(), 0);
});

test('resolveRecipientIds combines explicit IDs and audience resolution', async () => {
  const mockPrisma = createMockPrisma();
  const mockResolver = createMockRecipientResolver({
    resolve: mock.fn(async (audience) => {
      if (audience === 'target_user') return [10];
      if (audience === 'campaign_members') return [20, 21];
      return [];
    }),
  });

  const service = new NotificationService({
    prisma: mockPrisma,
    recipientResolver: mockResolver,
  });

  const result = await service.resolveRecipientIds({
    recipientIds: [1, 2, 3],
    audience: ['target_user', 'campaign_members'],
    context: { userId: 10, campaignId: 5 },
  });

  assert.deepStrictEqual(result.toSorted((a, b) => a - b), [1, 2, 3, 10, 20, 21]);
  assert.strictEqual(mockResolver.resolve.mock.callCount(), 2);
});

test('listNotificationsForUser returns mapped notifications with pagination', async () => {
  const recipients = [
    {
      id: 1,
      status: 'ACTIVE',
      readAt: null,
      notification: {
        id: 101,
        eventKey: 'test.event',
        type: 'TEST',
        severity: 'INFO',
        category: 'test',
        title: 'Test Title',
        body: 'Test Body',
        link: '/test',
        metadata: { key: 'value' },
        createdAt: new Date('2026-05-01'),
      },
    },
  ];

  const mockPrisma = createMockPrisma({
    notificationRecipient: {
      findMany: mock.fn(async () => recipients),
      count: mock.fn(async () => 5),
    },
  });

  const service = new NotificationService({ prisma: mockPrisma });
  const result = await service.listNotificationsForUser(1, { limit: 10, offset: 0 });

  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, 'Test Title');
  assert.equal(result.notifications[0].status, 'ACTIVE');
  assert.equal(result.pagination.total, 5);
  assert.equal(result.pagination.limit, 10);
  assert.equal(result.pagination.hasMore, true);
});

test('getUnreadCount returns count of ACTIVE recipients', async () => {
  const mockPrisma = createMockPrisma({
    notificationRecipient: {
      count: mock.fn(async () => 7),
    },
  });

  const service = new NotificationService({ prisma: mockPrisma });
  const result = await service.getUnreadCount(42);

  assert.equal(result, 7);
  assert.strictEqual(mockPrisma.notificationRecipient.count.mock.callCount(), 1);

  const [call] = mockPrisma.notificationRecipient.count.mock.calls;
  assert.deepStrictEqual(call.arguments[0], {
    where: { userId: 42, status: 'ACTIVE' },
  });
});

test('markManyAsRead updates all active recipients', async () => {
  const recipients = [
    { id: 1, notificationId: 10 },
    { id: 2, notificationId: 11 },
  ];

  const mockPrisma = createMockPrisma({
    notificationRecipient: {
      findMany: mock.fn(async () => recipients),
      updateMany: mock.fn(async () => ({ count: 2 })),
    },
  });

  const service = new NotificationService({ prisma: mockPrisma });
  const result = await service.markManyAsRead(1, [10, 11, 12]);

  assert.equal(result, 2);
  assert.strictEqual(mockPrisma.notificationRecipient.updateMany.mock.callCount(), 1);

  const [call] = mockPrisma.notificationRecipient.updateMany.mock.calls;
  assert.deepStrictEqual(call.arguments[0].where.id.in, [1, 2]);
});

test('pushToConnectedUsers does nothing when no recipients', async () => {
  const mockPrisma = createMockPrisma();
  const mockSseService = createMockSseService();

  const service = new NotificationService({
    prisma: mockPrisma,
    sseService: mockSseService,
  });

  service.pushToConnectedUsers({ id: 1, title: 'Test' }, []);

  assert.strictEqual(mockSseService.pushToUsers.mock.callCount(), 0);
});

test('pushToConnectedUsers sends to all recipients', async () => {
  const mockPrisma = createMockPrisma();
  const mockSseService = createMockSseService();

  const service = new NotificationService({
    prisma: mockPrisma,
    sseService: mockSseService,
  });

  const notification = {
    id: 1,
    eventKey: 'test',
    type: 'TEST',
    severity: 'INFO',
    category: 'test',
    title: 'Title',
    body: 'Body',
    link: '/link',
    metadata: {},
    createdAt: new Date(),
  };

  service.pushToConnectedUsers(notification, [1, 2, 3]);

  assert.strictEqual(mockSseService.pushToUsers.mock.callCount(), 1);

  const [call] = mockSseService.pushToUsers.mock.calls;
  assert.deepStrictEqual(call.arguments[0], [1, 2, 3]);
  assert.equal(call.arguments[1].title, 'Title');
  assert.equal(call.arguments[1].status, 'ACTIVE');
});
