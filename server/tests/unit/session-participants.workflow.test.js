const test = require('node:test');
const assert = require('node:assert/strict');

const createSessionParticipantsService = require('../../src/services/session/session-participants.service');

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ERROR_CODES = {
  SESSION_PARTICIPANT_STATUS_INVALID: 'SESSION_PARTICIPANT_STATUS_INVALID',
  SESSION_PARTICIPANT_MANAGEMENT_UNAVAILABLE: 'SESSION_PARTICIPANT_MANAGEMENT_UNAVAILABLE',
  SESSION_PARTICIPANT_DECLINE_PENDING_ONLY: 'SESSION_PARTICIPANT_DECLINE_PENDING_ONLY',
  SESSION_GM_REQUESTS_OWNER_ONLY: 'SESSION_GM_REQUESTS_OWNER_ONLY',
  SESSION_PARTICIPANTS_MANAGE_OWNER_OR_CONFIRMED_GM_ONLY: 'SESSION_PARTICIPANTS_MANAGE_OWNER_OR_CONFIRMED_GM_ONLY',
};

function buildSession() {
  return {
    id: 100,
    ownerId: 1,
    status: 'PLANNED',
    campaign: null,
    participants: [],
  };
}

function buildModerationContext(options = {}) {
  const state = {
    deleteCalls: [],
    deleteManyCalls: [],
    updateCalls: [],
    createCalls: [],
    sessionUpdateCalls: [],
    refundCalls: [],
    reserveCalls: [],
  };

  const session = options.session || buildSession();
  if (options.sessionPrice !== undefined) {
    session.price = options.sessionPrice;
  }
  const participantsById = new Map(
    (options.participants || []).map((participant) => [participant.id, { ...participant }])
  );

  const prisma = {
    session: {
      findUnique: async ({ where }) => {
        if (where?.id !== session.id) {
          return null;
        }

        return {
          id: session.id,
          title: session.title ?? null,
          price: session.price ?? null,
          heldAmount: session.heldAmount ?? 0,
        };
      },
      update: async ({ where, data }) => {
        state.sessionUpdateCalls.push({ where, data });
        if (data.heldAmount?.decrement) {
          session.heldAmount = (session.heldAmount || 0) - Number(data.heldAmount.decrement);
        } else if (data.heldAmount?.increment) {
          session.heldAmount = (session.heldAmount || 0) + Number(data.heldAmount.increment);
        }
        return {
          ...session,
        };
      },
    },
    sessionParticipant: {
      findUnique: async ({ where }) => {
        let p;
        if (where.id) {
          p = participantsById.get(where.id);
        } else if (where.userId_sessionId) {
          const { userId, sessionId } = where.userId_sessionId;
          for (const item of participantsById.values()) {
            if (item.userId === userId && item.sessionId === sessionId) {
              p = item;
              break;
            }
          }
        }
        if (p) {
          return {
            ...p,
            session: {
              id: session.id,
              ownerId: session.ownerId,
              status: session.status,
              date: session.date,
              price: session.price,
              heldAmount: session.heldAmount,
            },
          };
        }
        return null;
      },
      create: async ({ data, include }) => {
        const id = Math.floor(Math.random() * 1000) + 100;
        const participant = { id, status: 'PENDING', ...data };
        participantsById.set(id, participant);
        state.createCalls.push(participant);
        return {
          ...participant,
          user: {
            id: participant.userId,
            username: `user_${participant.userId}`,
            displayName: null,
            avatarUrl: null,
          },
        };
      },
      delete: async ({ where }) => {
        if (where.id) {
          state.deleteCalls.push(where.id);
          participantsById.delete(where.id);
          return { id: where.id };
        }
        if (where.userId_sessionId) {
          const { userId, sessionId } = where.userId_sessionId;
          for (const [id, p] of participantsById.entries()) {
            if (p.userId === userId && p.sessionId === sessionId) {
              state.deleteCalls.push(id);
              participantsById.delete(id);
              return { id };
            }
          }
        }
        return { id: null };
      },
      deleteMany: async ({ where }) => {
        state.deleteManyCalls.push(where);

        let count = 0;
        for (const [id, participant] of participantsById.entries()) {
          const sameSession = participant.sessionId === where.sessionId;
          const sameRole = participant.role === where.role;
          const sameStatus = participant.status === where.status;
          const notTarget = participant.id !== where.NOT?.id;

          if (sameSession && sameRole && sameStatus && notTarget) {
            participantsById.delete(id);
            count += 1;
          }
        }

        return { count };
      },
      update: async ({ where, data }) => {
        const existing = participantsById.get(where.id);
        const updated = {
          ...existing,
          ...data,
        };

        participantsById.set(where.id, updated);
        state.updateCalls.push({ where, data });

        return {
          ...updated,
          user: {
            id: updated.userId,
            username: `user_${updated.userId}`,
            displayName: null,
            avatarUrl: null,
          },
        };
      },
    },
    $transaction: async (arg) => {
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      return Promise.all(arg);
    },
  };

  const walletService = {
    refundFunds: async (userId, sessionId, amount, tx) => {
      state.refundCalls.push({ userId, sessionId, amount });
    },
    reserveFunds: async (userId, sessionId, amount, tx) => {
      state.reserveCalls.push({ userId, sessionId, amount });
    },
  };

  const service = createSessionParticipantsService({
    prisma,
    AppError,
    ERROR_CODES,
    getSessionById: async () => session,
    resolveSessionContext: async () => session,
    assertNoSessionTimeConflict: async () => true,
    permissionHelpers: {
      _getConfirmedGm: () => options.confirmedGm ?? null,
      _isSessionOwner: (_session, userId) => userId === (options.ownerId ?? 1),
      _isCampaignOwnerOverride: () => false,
      _canManageParticipants: (session, userId) => userId === (options.ownerId ?? 1) || (options.canManageParticipants ?? true),
    },
    walletService,
  });

  return { service, state, participantsById, session };
}

test('declining a pending player application removes participant record', async () => {
  const { service, state, participantsById } = buildModerationContext({
    participants: [
      { id: 11, sessionId: 100, userId: 22, role: 'PLAYER', status: 'PENDING' },
    ],
    canManageParticipants: true,
  });

  const result = await service.updateParticipantStatus(100, 11, 5, 'DECLINED');

  assert.equal(result.id, 11);
  assert.equal(result.status, 'DECLINED');
  assert.equal(state.deleteCalls.length, 1);
  assert.equal(state.deleteCalls[0], 11);
  assert.equal(state.updateCalls.length, 0);
  assert.equal(participantsById.has(11), false);
});

test('declining non-pending participant is rejected', async () => {
  const { service, state } = buildModerationContext({
    participants: [
      { id: 12, sessionId: 100, userId: 23, role: 'PLAYER', status: 'CONFIRMED' },
    ],
    canManageParticipants: true,
  });

  await assert.rejects(
    () => service.updateParticipantStatus(100, 12, 5, 'DECLINED'),
    (error) => error instanceof AppError && error.code === ERROR_CODES.SESSION_PARTICIPANT_DECLINE_PENDING_ONLY
  );

  assert.equal(state.deleteCalls.length, 0);
  assert.equal(state.updateCalls.length, 0);
});

test('confirming one GM application removes other pending GM applications', async () => {
  const { service, state, participantsById } = buildModerationContext({
    ownerId: 1,
    participants: [
      { id: 21, sessionId: 100, userId: 31, role: 'GM', status: 'PENDING' },
      { id: 22, sessionId: 100, userId: 32, role: 'GM', status: 'PENDING' },
      { id: 23, sessionId: 100, userId: 33, role: 'PLAYER', status: 'PENDING' },
    ],
  });

  const result = await service.updateParticipantStatus(100, 21, 1, 'CONFIRMED');

  assert.equal(result.id, 21);
  assert.equal(result.status, 'CONFIRMED');
  assert.equal(state.updateCalls.length, 1);
  assert.equal(state.deleteManyCalls.length, 1);
  assert.equal(participantsById.has(21), true);
  assert.equal(participantsById.has(22), false);
  assert.equal(participantsById.has(23), true);
});
