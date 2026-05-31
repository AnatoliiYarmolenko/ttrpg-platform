const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatHandler } = require('../../src/ws/ws-chat.handler');
const { createRoomManager } = require('../../src/ws/ws-room.manager');

const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

if (!testDbUrl) {
  test.skip('DATABASE_URL not set, skipping integration test');
}

const testPrisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
});

async function cleanupTestData() {
  await testPrisma.chatMessage.deleteMany({
    where: { author: { username: { startsWith: 'test_ws_chat_user_' } } },
  });
  await testPrisma.chat.deleteMany({
    where: { campaign: { owner: { username: { startsWith: 'test_ws_chat_user_' } } } },
  });
  await testPrisma.campaign.deleteMany({
    where: { owner: { username: { startsWith: 'test_ws_chat_user_' } } },
  });
  await testPrisma.user.deleteMany({
    where: { username: { startsWith: 'test_ws_chat_user_' } },
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
      username: `test_ws_chat_user_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      email: `test_ws_chat_${timestamp}@example.com`,
      password: 'password123',
      displayName: 'WS Chat Test User',
      ...overrides,
    },
  });
}

async function createTestCampaignWithChat(ownerId) {
  const campaign = await testPrisma.campaign.create({
    data: {
      title: 'WS Test Campaign',
      description: 'A test campaign for chat',
      system: 'D&D 5e',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: 'OWNER',
        },
      },
    },
  });

  const chat = await testPrisma.chat.create({
    data: {
      campaignId: campaign.id,
    },
  });

  return { campaign, chat };
}

class MockSocket {
  constructor(userId, socketId) {
    this.id = socketId;
    this.user = { id: userId };
    this.events = [];
    this.handlers = {};
    this.readyState = 1;
    this.OPEN = 1;
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

test('WS Chat lifecycle: joining, sending messages, and broadcasting', async () => {
  const chatRoomManager = createRoomManager();
  const handleConnection = createChatHandler({ roomManager: chatRoomManager });

  const owner = await createTestUser();
  const player = await createTestUser();
  
  const { chat } = await createTestCampaignWithChat(owner.id);
  
  await testPrisma.campaignMember.create({
    data: { campaignId: chat.campaignId, userId: player.id, role: 'PLAYER' }
  });

  const ownerSocket = new MockSocket(owner.id, 'owner-sock');
  handleConnection(ownerSocket);
  
  const playerSocket = new MockSocket(player.id, 'player-sock');
  handleConnection(playerSocket);

  ownerSocket.simulateIncomingMessage({
    type: 'chat:join',
    payload: { chatId: chat.id }
  });
  
  const ownerJoined = await waitForEvent(ownerSocket, 'chat:joined');
  assert.ok(ownerJoined.length > 0, 'Owner should receive chat:joined event');
  assert.strictEqual(ownerJoined[0].chatId, chat.id);
  assert.strictEqual(ownerJoined[0].readonly, false);

  playerSocket.simulateIncomingMessage({
    type: 'chat:join',
    payload: { chatId: chat.id }
  });

  const playerJoined = await waitForEvent(playerSocket, 'chat:joined');
  assert.ok(playerJoined.length > 0, 'Player should receive chat:joined event');

  const testClientMessageId = 'client-id-123';
  ownerSocket.simulateIncomingMessage({
    type: 'chat:message:send',
    payload: {
      chatId: chat.id,
      content: 'Hello everyone!',
      clientMessageId: testClientMessageId,
    }
  });

  const ownerConfirm = await waitForEvent(ownerSocket, 'chat:message:new');
  assert.ok(ownerConfirm.length > 0);
  assert.strictEqual(ownerConfirm[0].clientMessageId, testClientMessageId);
  assert.strictEqual(ownerConfirm[0].message.content, 'Hello everyone!');

  const playerBroadcast = await waitForEvent(playerSocket, 'chat:message:new');
  assert.ok(playerBroadcast.length > 0);
  assert.strictEqual(playerBroadcast[0].message.content, 'Hello everyone!');
  assert.strictEqual(playerBroadcast[0].message.author.id, owner.id);

  ownerSocket.simulateIncomingMessage({
    type: 'invalid:type',
    payload: {}
  });

  const errorEvent = await waitForEvent(ownerSocket, 'chat:error');
  assert.ok(errorEvent.length > 0);
  assert.strictEqual(errorEvent[0].code, 'VALIDATION_FAILED');
  assert.strictEqual(errorEvent[0].message, 'Невідомий тип повідомлення');

  playerSocket.simulateIncomingMessage({
    type: 'chat:leave',
    payload: { chatId: chat.id }
  });
  
  ownerSocket.events = [];
  playerSocket.events = [];
  
  ownerSocket.simulateIncomingMessage({
    type: 'chat:message:send',
    payload: {
      chatId: chat.id,
      content: 'Did player leave?',
    }
  });

  const ownerConfirm2 = await waitForEvent(ownerSocket, 'chat:message:new');
  assert.ok(ownerConfirm2.length > 0);
  
  await new Promise(r => setTimeout(r, 200));
  const playerBroadcast2 = playerSocket.getEventsByType('chat:message:new');
  assert.strictEqual(playerBroadcast2.length, 0, 'Player should not receive message after leaving');

  ownerSocket.simulateClose();
  assert.strictEqual(chatRoomManager.roomSize(chat.id), 0);
});
