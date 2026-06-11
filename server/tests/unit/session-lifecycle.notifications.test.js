const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const createSessionLifecycleService = require('../../src/services/session/session-lifecycle.service');

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ERROR_CODES = {
  SESSION_OWNER_ONLY: 'SESSION_OWNER_ONLY',
  SESSION_SETTINGS_UPDATE_FORBIDDEN: 'SESSION_SETTINGS_UPDATE_FORBIDDEN',
  CAMPAIGN_FINISHED: 'CAMPAIGN_FINISHED',
  SESSION_GM_ONLY: 'SESSION_GM_ONLY',
  SESSION_UPDATE_PAST_SETTINGS_FORBIDDEN: 'SESSION_UPDATE_PAST_SETTINGS_FORBIDDEN',
  SESSION_TIME_CONFLICT_OWNER: 'SESSION_TIME_CONFLICT_OWNER',
  SESSION_TIME_CONFLICT_PLAYER: 'SESSION_TIME_CONFLICT_PLAYER',
  SESSION_STATUS_TRANSITION_INVALID: 'SESSION_STATUS_TRANSITION_INVALID',
  SESSION_START_ONLY_ON_SCHEDULED_DAY: 'SESSION_START_ONLY_ON_SCHEDULED_DAY',
  SESSION_MARK_FINISHED_TOO_EARLY: 'SESSION_MARK_FINISHED_TOO_EARLY',
  SESSION_LINK_ONLY_ONE_SHOT_ONLY: 'SESSION_LINK_ONLY_ONE_SHOT_ONLY',
  SESSION_CANCEL_FINISHED_FORBIDDEN: 'SESSION_CANCEL_FINISHED_FORBIDDEN',
  SESSION_ALREADY_CANCELED: 'SESSION_ALREADY_CANCELED',
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
};

function createLifecycleService(overrides = {}) {
  const notificationService = overrides.notificationService || {
    createNotification: mock.fn(async () => null),
  };

  const sessionUpdateMock = mock.fn(async ({ data } = {}) => ({
    id: 101,
    title: 'Test Session',
    date: new Date('2026-05-10T10:00:00.000Z'),
    duration: 180,
    ownerId: 1,
    campaign: null,
    participants: [],
    status: data?.status || 'PLANNED',
    ...data,
  }));

  const prisma = overrides.prisma || {
    $transaction: mock.fn(async (callback) => callback({
      $queryRaw: mock.fn(async () => [{ visibility: 'LINK_ONLY', shareTokenHash: 'mocked' }]),
      session: {
        update: sessionUpdateMock,
      },
      sessionParticipant: {
        updateMany: mock.fn(async () => ({ count: 0 })),
      },
      userStats: {
        upsert: mock.fn(async () => null),
      },
    })),
    session: {
      update: sessionUpdateMock,
      delete: mock.fn(async () => null),
    },
    user: {
      findUnique: mock.fn(async () => ({ timezone: 'Europe/Kyiv' })),
    },
  };

  return {
    service: createSessionLifecycleService({
      prisma,
      AppError,
      ERROR_CODES,
      permissionHelpers: {
        _canEditSessionSettings: mock.fn(() => true),
        _canChangeSessionStatus: mock.fn(() => true),
        _isSessionOwner: mock.fn((session, userId) => session?.ownerId === userId),
        _isCampaignOwnerOverride: mock.fn(() => false),
      },
      datetimeHelpers: {
        _assertNoSessionTimeConflict: mock.fn(async (_deps, userId) => {
          if (userId === 3) {
            throw new AppError(ERROR_CODES.SESSION_TIME_CONFLICT_PLAYER);
          }

          return true;
        }),
        _isSameDayInTimeZone: mock.fn(() => true),
        _getSessionEndWithGrace: mock.fn(() => new Date('2026-05-11T00:00:00.000Z')),
      },
      sessionQueryService: {
        resolveSessionContext: mock.fn(async () => overrides.session || {
          id: 101,
          title: 'Test Session',
          date: new Date('2027-01-01T10:00:00.000Z'),
          duration: 180,
          status: 'PLANNED',
          ownerId: 1,
          campaign: null,
          participants: [
            { id: 11, userId: 1, role: 'GM', status: 'CONFIRMED' },
            { id: 12, userId: 2, role: 'PLAYER', status: 'CONFIRMED' },
            { id: 13, userId: 3, role: 'PLAYER', status: 'CONFIRMED' },
          ],
        }),
        parsePositiveInt: mock.fn((value) => Number.parseInt(value, 10)),
      },
      createRawEncryptedAndHashedShareToken: mock.fn(() => ({
        rawToken: 'token',
        tokenHash: 'hash',
        tokenEncrypted: 'encrypted',
      })),
      notificationService,
    }),
    prisma,
    notificationService,
  };
}

test('updateSession sends reschedule and conflict notifications on date changes', async () => {
  const { service, prisma, notificationService } = createLifecycleService();

  const result = await service.updateSession(101, 1, {
    date: new Date('2027-01-02T10:00:00.000Z'),
  });

  assert.equal(result.id, 101);
  assert.equal(notificationService.createNotification.mock.callCount(), 2);

  const payloads = notificationService.createNotification.mock.calls.map((call) => call.arguments[0]);
  assert.deepStrictEqual(payloads.map((payload) => payload.type), [
    'SESSION_RESCHEDULED',
    'SESSION_TIME_CONFLICT',
  ]);
  assert.deepStrictEqual(payloads[0].audience, [
    'session_confirmed_participants',
    'session_pending_participants',
    'session_owner',
  ]);
  assert.deepStrictEqual(payloads[1].recipientIds, [3]);

  assert.equal(prisma.$transaction.mock.callCount(), 1);
});

test('cancelSession sends cancel notification to participants', async () => {
  const { service, prisma, notificationService } = createLifecycleService({
    session: {
      id: 101,
      title: 'Test Session',
      date: new Date('2026-05-08T10:00:00.000Z'),
      duration: 180,
      status: 'PLANNED',
      ownerId: 1,
      campaign: null,
      participants: [
        { id: 11, userId: 1, role: 'GM', status: 'CONFIRMED' },
        { id: 12, userId: 2, role: 'PLAYER', status: 'CONFIRMED' },
        { id: 13, userId: 3, role: 'PLAYER', status: 'PENDING' },
      ],
    },
  });

  const result = await service.cancelSession(101, 1);

  assert.equal(result.status, 'CANCELED');
  assert.equal(notificationService.createNotification.mock.callCount(), 1);

  const [payload] = notificationService.createNotification.mock.calls.map((call) => call.arguments[0]);
  assert.equal(payload.type, 'SESSION_CANCELLED');
  assert.deepStrictEqual(payload.audience, ['session_confirmed_participants', 'session_pending_participants']);
  assert.equal(prisma.session.update.mock.callCount(), 1);
});