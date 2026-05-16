const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');

const test = require('node:test');
const assert = require('node:assert/strict');
const chatService = require('../../src/services/chat.service');

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
      await callback(tx);
      throw new Error('ROLLBACK');
    }).catch((err) => {
      if (err.message !== 'ROLLBACK') throw err;
    });
  } finally {
    await testPrisma.$disconnect();
  }
}

async function createTestUser(tx) {
  const timestamp = Date.now();
  return tx.user.create({
    data: {
      username: `user_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      email: `test_${timestamp}@example.com`,
      password: 'password123',
    },
  });
}

async function createTestCampaign(tx, ownerId) {
  const campaign = await tx.campaign.create({
    data: {
      title: 'Test Campaign',
      ownerId,
      members: { create: { userId: ownerId, role: 'OWNER' } }
    }
  });

  const chat = await tx.chat.create({
    data: { campaignId: campaign.id }
  });

  return { ...campaign, chat };
}

test('Messaging lifecycle: creates and retrieves messages with cursors', async () => {
  await withTestDatabase(async (tx) => {
    // We need to swap the global prisma for the transaction one
    const originalPrisma = require('../../src/lib/prisma').prisma;
    require('../../src/lib/prisma').prisma = tx;

    try {
      const user = await createTestUser(tx);
      const campaign = await createTestCampaign(tx, user.id);
      const chatId = campaign.chat.id;

      // 1. Create a message
      const message = await chatService.createUserMessage(chatId, user.id, 'Hello world');
      
      assert.equal(message.content, 'Hello world');
      assert.equal(message.author.id, user.id);
      assert.ok(message.id > 0);

      // Verify it's in DB
      const dbMessage = await tx.chatMessage.findUnique({ where: { id: message.id } });
      assert.ok(dbMessage);
      assert.equal(dbMessage.content, 'Hello world');

      // 2. Test pagination with cursors
      const messages = [];
      for (let i = 0; i < 10; i++) {
        messages.push(await chatService.createUserMessage(chatId, user.id, `Msg ${i}`));
      }

      // Get 5 messages after the 5th message (index 4 of the new messages, but total index 5)
      // Wait, message index 5 is the 5th message created in the loop.
      const cursor = chatService.buildCursor(messages[4]);
      const result = await chatService.getMessagesAfter(chatId, user.id, {
        after: cursor,
        limit: 5
      });

      assert.equal(result.messages.length, 5);
      assert.equal(result.messages[0].content, 'Msg 5');
      assert.equal(result.messages[4].content, 'Msg 9');

    } finally {
      require('../../src/lib/prisma').prisma = originalPrisma;
    }
  });
});
