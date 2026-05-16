const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');

const test = require('node:test');
const assert = require('node:assert/strict');
const chatService = require('../../src/services/chat.service');
const { ERROR_CODES } = require('../../src/constants/errors');

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

test('Chat Security: denies access to unauthorized users', async () => {
  await withTestDatabase(async (tx) => {
    const originalPrisma = require('../../src/lib/prisma').prisma;
    require('../../src/lib/prisma').prisma = tx;

    try {
      const owner = await createTestUser(tx);
      const stranger = await createTestUser(tx);
      const campaign = await createTestCampaign(tx, owner.id);
      const chatId = campaign.chat.id;

      // 1. Stranger tries to read chat
      await assert.rejects(
        chatService.getRecentMessages(chatId, stranger.id),
        (err) => {
          assert.equal(err.code, ERROR_CODES.SECURITY_ACCESS_DENIED);
          return true;
        }
      );

      // 2. Stranger tries to send message
      await assert.rejects(
        chatService.createUserMessage(chatId, stranger.id, 'I am a hacker'),
        (err) => {
          assert.equal(err.code, ERROR_CODES.SECURITY_ACCESS_DENIED);
          return true;
        }
      );

      // 3. User in finished campaign cannot write (readonly)
      await tx.campaign.update({
        where: { id: campaign.id },
        data: { status: 'FINISHED' }
      });

      await assert.rejects(
        chatService.createUserMessage(chatId, owner.id, 'Final word'),
        (err) => {
          assert.equal(err.code, ERROR_CODES.CHAT_READONLY);
          return true;
        }
      );

    } finally {
      require('../../src/lib/prisma').prisma = originalPrisma;
    }
  });
});
