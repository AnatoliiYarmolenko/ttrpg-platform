const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCallHandler } = require('../../src/ws/ws-call.handler');
const { callService } = require('../../src/call/call.service');
const { callRoomManager } = require('../../src/call/call-room.manager');
const mediasoupLib = require('../../src/lib/mediasoup');

const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

if (!testDbUrl) {
  test.skip('DATABASE_URL not set, skipping integration test');
}

const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

async function cleanupTestData() {
  await testPrisma.sessionParticipant.deleteMany({
    where: {
      user: { username: { startsWith: 'test_call_user_' } },
    },
  });
  await testPrisma.session.deleteMany({
    where: {
      title: 'Test Call Session',
    },
  });
  await testPrisma.user.deleteMany({
    where: {
      username: { startsWith: 'test_call_user_' },
    },
  });
}

test.before(async () => {
  await testPrisma.$connect();
  await cleanupTestData();
});

test.after(async () => {
  await cleanupTestData();
  await testPrisma.$disconnect();
});

async function createTestUser(overrides = {}) {
  const timestamp = Date.now();
  return testPrisma.user.create({
    data: {
      username: `test_call_user_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      email: `test_call_${timestamp}@example.com`,
      password: 'password123',
      displayName: 'Test User',
      ...overrides,
    },
  });
}

async function createTestSession(ownerId, overrides = {}) {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  return testPrisma.session.create({
    data: {
      title: 'Test Call Session',
      description: 'A test session for call',
      date: futureDate,
      duration: 180,
      maxPlayers: 5,
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      ownerId,
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
  });
}

async function addSessionParticipant(userId, sessionId, role = 'PLAYER', status = 'CONFIRMED') {
  return testPrisma.sessionParticipant.create({
    data: {
      userId,
      sessionId,
      role,
      status,
      isGuest: false,
    },
  });
}

class MockSocket {
  constructor(userId, socketId) {
    this.id = socketId;
    this.user = { id: userId };
    this.events = [];
    this.handlers = {};
    this.readyState = 1; // OPEN
  }

  on(event, handler) {
    this.handlers[event] = handler;
  }

  send(data) {
    this.events.push(JSON.parse(data));
  }

  simulateIncomingMessage(data) {
    if (this.handlers['message']) {
      this.handlers['message'](JSON.stringify(data));
    }
  }

  simulateClose() {
    if (this.handlers['close']) {
      this.handlers['close']();
    }
  }

  getEventsByType(type) {
    return this.events.filter(e => e.type === type);
  }
}

async function waitForEvent(socket, type, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const events = socket.getEventsByType(type);
    if (events.length > 0) return events;
    await new Promise(r => setTimeout(r, 10));
  }
  return [];
}

async function waitForSpecificEvent(socket, type, eventName, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const events = socket.getEventsByType(type).filter(e => e.event === eventName);
    if (events.length > 0) return events;
    await new Promise(r => setTimeout(r, 10));
  }
  return [];
}

async function waitForResponse(socket, id, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const events = socket.getEventsByType('call:response').filter(e => e.id === id);
    if (events.length > 0) return events;
    await new Promise(r => setTimeout(r, 10));
  }
  return [];
}

test('Call lifecycle integration: WS Handler + DB Permissions + CallService', async () => {
  // 1. Setup Mock Mediasoup Worker
  const mockRouter = {
    rtpCapabilities: { codecs: [] },
    close: () => {},
    createWebRtcTransport: async () => ({
      id: 'transport-1',
      appData: {},
      iceParameters: {},
      iceCandidates: [],
      dtlsParameters: {},
      sctpParameters: {},
      on: () => {},
      connect: async () => {},
      produce: async () => ({
        id: 'producer-1',
        appData: {},
        on: () => {},
        close: () => {}
      })
    }),
    canConsume: () => true
  };
  
  test.mock.method(mediasoupLib, 'getWorker', () => ({
    createRouter: async () => mockRouter
  }));

  // Reset memory state
  callRoomManager.rooms.clear();

  const handleConnection = createCallHandler();

  // 2. Setup DB Data
  const gm = await createTestUser();
  const player = await createTestUser();
  const outsider = await createTestUser();
  
  const session = await createTestSession(gm.id);
  await addSessionParticipant(player.id, session.id, 'PLAYER', 'CONFIRMED');

  // 3. WS connection logic
  const gmSocket = new MockSocket(gm.id, 'gm-sock');
  handleConnection(gmSocket);
  
  const playerSocket = new MockSocket(player.id, 'player-sock');
  handleConnection(playerSocket);

  // 4. Outsider fails to join
  const outsiderSocket = new MockSocket(outsider.id, 'outsider-sock');
  handleConnection(outsiderSocket);
  outsiderSocket.simulateIncomingMessage({
    type: 'call:join',
    id: 1,
    payload: { sessionId: session.id }
  });
  
  const outsiderErr = await waitForEvent(outsiderSocket, 'call:error');
  assert.ok(outsiderErr.length > 0);
  assert.strictEqual(outsiderErr[0].code, 'CALL_JOIN_FORBIDDEN');

  // 5. GM starts call
  gmSocket.simulateIncomingMessage({
    type: 'call:start',
    id: 2,
    payload: { sessionId: session.id }
  });
  
  const gmStarted = await waitForEvent(gmSocket, 'call:started');
  assert.ok(gmStarted.length > 0);
  assert.strictEqual(gmStarted[0].callState, 'ACTIVE');

  // GM must also join the call to receive events
  gmSocket.simulateIncomingMessage({
    type: 'call:join',
    id: 2.5,
    payload: { sessionId: session.id }
  });
  const gmJoined = await waitForEvent(gmSocket, 'call:joined');
  assert.ok(gmJoined.length > 0);

  // 6. Player joins call
  playerSocket.simulateIncomingMessage({
    type: 'call:join',
    id: 3,
    payload: { sessionId: session.id }
  });
  
  const playerJoined = await waitForEvent(playerSocket, 'call:joined');
  assert.ok(playerJoined.length > 0);
  assert.strictEqual(playerJoined[0].callState, 'ACTIVE');

  // GM should receive participant joined event
  const gmPartJoined = await waitForSpecificEvent(gmSocket, 'call:event', 'call:participant-joined');
  assert.ok(gmPartJoined.length > 0);
  assert.strictEqual(gmPartJoined[0].payload.participant.userId, player.id);

  // 7. Player leaves
  playerSocket.simulateClose();
  
  const gmPartLeft = await waitForSpecificEvent(gmSocket, 'call:event', 'call:participant-left');
  assert.ok(gmPartLeft.length > 0);
  assert.strictEqual(gmPartLeft[0].payload.peerId, 'player-sock');

  // 8. GM ends call
  gmSocket.simulateIncomingMessage({
    type: 'call:end',
    id: 4,
    payload: { sessionId: session.id }
  });
  
  const gmEnded = await waitForSpecificEvent(gmSocket, 'call:event', 'call:ended');
  assert.ok(gmEnded.length > 0);
  assert.strictEqual(gmEnded[0].payload.sessionId, session.id);
  
  // Room should be ended
  const room = callRoomManager.getRoomIfExists(session.id);
  assert.ok(room);
  assert.strictEqual(room.callState, 'ENDED');
});
