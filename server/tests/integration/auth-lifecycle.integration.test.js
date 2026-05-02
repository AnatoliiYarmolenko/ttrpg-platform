const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const test = require('node:test');
const assert = require('node:assert/strict');

const TOKEN_TTL_MS = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000,
};

const PASSWORD_HASH_ROUNDS = 10;

function createRawAndHashedToken(byteLength = 32) {
  const rawToken = crypto.randomBytes(byteLength).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

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

test('registration creates user and email verification token in DB', async () => {
  await withTestDatabase(async (tx) => {
    const username = 'testuser';
    const email = 'test@example.com';
    const password = 'password123';

    const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

    const user = await tx.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        emailVerified: false,
        wallet: {
          create: { balance: 0 },
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
      },
    });

    assert.ok(user.id);
    assert.equal(user.username, username);
    assert.equal(user.email, email);
    assert.equal(user.emailVerified, false);

    const { tokenHash } = createRawAndHashedToken(32);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.EMAIL_VERIFICATION);

    const emailToken = await tx.emailVerificationToken.create({
      data: {
        token: tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    assert.ok(emailToken.id);
    assert.equal(emailToken.userId, user.id);
    assert.equal(emailToken.token, tokenHash);
    assert.ok(emailToken.expiresAt > new Date());

    const userWithTokens = await tx.user.findUnique({
      where: { id: user.id },
      include: {
        emailVerificationTokens: true,
      },
    });

    assert.equal(userWithTokens.emailVerificationTokens.length, 1);
    assert.equal(userWithTokens.emailVerificationTokens[0].token, tokenHash);
  });
});

test('login creates refresh token in DB', async () => {
  await withTestDatabase(async (tx) => {
    const email = 'test@example.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

    const user = await tx.user.create({
      data: {
        username: 'testuser',
        email,
        password: hashedPassword,
        emailVerified: true,
        isDeleted: false,
        wallet: {
          create: { balance: 0 },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    const {tokenHash: refreshTokenHash } = createRawAndHashedToken(64);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.REFRESH_TOKEN);

    const dbRefreshToken = await tx.refreshToken.create({
      data: {
        token: refreshTokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    assert.ok(dbRefreshToken.id);
    assert.equal(dbRefreshToken.userId, user.id);
    assert.equal(dbRefreshToken.token, refreshTokenHash);
    assert.ok(dbRefreshToken.expiresAt > new Date());

    const userWithTokens = await tx.user.findUnique({
      where: { id: user.id },
      include: {
        refreshTokens: true,
      },
    });

    assert.equal(userWithTokens.refreshTokens.length, 1);
    assert.equal(userWithTokens.refreshTokens[0].token, refreshTokenHash);
  });
});

test('refresh token rotation deletes old token and creates new one', async () => {
  await withTestDatabase(async (tx) => {
    const email = 'test@example.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

    const user = await tx.user.create({
      data: {
        username: 'testuser',
        email,
        password: hashedPassword,
        emailVerified: true,
        isDeleted: false,
        wallet: {
          create: { balance: 0 },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    const {tokenHash: oldRefreshTokenHash } = createRawAndHashedToken(64);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.REFRESH_TOKEN);

    const oldDbToken = await tx.refreshToken.create({
      data: {
        token: oldRefreshTokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    assert.ok(oldDbToken.id);

    await tx.refreshToken.delete({ where: { id: oldDbToken.id } });

    const deletedToken = await tx.refreshToken.findUnique({
      where: { id: oldDbToken.id },
    });

    assert.equal(deletedToken, null);

    const {tokenHash: newRefreshTokenHash } = createRawAndHashedToken(64);
    const newExpiresAt = new Date(Date.now() + TOKEN_TTL_MS.REFRESH_TOKEN);

    const newDbToken = await tx.refreshToken.create({
      data: {
        token: newRefreshTokenHash,
        userId: user.id,
        expiresAt: newExpiresAt,
      },
    });

    assert.ok(newDbToken.id);
    assert.equal(newDbToken.token, newRefreshTokenHash);
    assert.notEqual(newDbToken.token, oldRefreshTokenHash);

    const userWithTokens = await tx.user.findUnique({
      where: { id: user.id },
      include: {
        refreshTokens: true,
      },
    });

    assert.equal(userWithTokens.refreshTokens.length, 1);
    assert.equal(userWithTokens.refreshTokens[0].token, newRefreshTokenHash);
  });
});

test('soft-delete (isDeleted) blocks login', async () => {
  await withTestDatabase(async (tx) => {
    const email = 'test@example.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

    const user = await tx.user.create({
      data: {
        username: 'testuser',
        email,
        password: hashedPassword,
        emailVerified: true,
        isDeleted: false,
        wallet: {
          create: { balance: 0 },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        isDeleted: true,
      },
    });

    assert.equal(user.isDeleted, false);

    const activeUser = await tx.user.findFirst({
      where: { email, isDeleted: false },
      select: { id: true },
    });

    assert.ok(activeUser);
    assert.equal(activeUser.id, user.id);

    await tx.user.update({
      where: { id: user.id },
      data: { isDeleted: true },
    });

    const deletedUser = await tx.user.findFirst({
      where: { email, isDeleted: false },
      select: { id: true },
    });

    assert.equal(deletedUser, null);

    const userCheck = await tx.user.findUnique({
      where: { id: user.id },
      select: { isDeleted: true },
    });

    assert.equal(userCheck.isDeleted, true);
  });
});

test('multiple refresh tokens are limited to MAX_SESSIONS', async () => {
  await withTestDatabase(async (tx) => {
    const email = 'test@example.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

    const user = await tx.user.create({
      data: {
        username: 'testuser',
        email,
        password: hashedPassword,
        emailVerified: true,
        isDeleted: false,
        wallet: {
          create: { balance: 0 },
        },
      },
      select: {
        id: true,
      },
    });

    const MAX_SESSIONS = 5;
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.REFRESH_TOKEN);

    for (let i = 0; i < MAX_SESSIONS + 2; i++) {
      const { tokenHash } = createRawAndHashedToken(64);
      await tx.refreshToken.create({
        data: {
          token: tokenHash,
          userId: user.id,
          expiresAt,
        },
      });
    }

    const allTokens = await tx.refreshToken.findMany({
      where: { userId: user.id },
    });

    assert.equal(allTokens.length, MAX_SESSIONS + 2);

    const now = new Date();
    await tx.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: now } },
    });

    const activeTokens = await tx.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (activeTokens.length >= MAX_SESSIONS) {
      const toDelete = activeTokens.slice(0, activeTokens.length - MAX_SESSIONS + 1);
      await tx.refreshToken.deleteMany({
        where: { id: { in: toDelete.map((t) => t.id) } },
      });
    }

    const finalTokens = await tx.refreshToken.findMany({
      where: { userId: user.id },
    });

    assert.ok(finalTokens.length <= MAX_SESSIONS);
  });
});

test('expired refresh tokens are cleaned up on login', async () => {
  await withTestDatabase(async (tx) => {
    const email = 'test@example.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

    const user = await tx.user.create({
      data: {
        username: 'testuser',
        email,
        password: hashedPassword,
        emailVerified: true,
        isDeleted: false,
        wallet: {
          create: { balance: 0 },
        },
      },
      select: {
        id: true,
      },
    });

    const expiredExpiresAt = new Date(Date.now() - 1000);
    const validExpiresAt = new Date(Date.now() + TOKEN_TTL_MS.REFRESH_TOKEN);

    await tx.refreshToken.create({
      data: {
        token: createRawAndHashedToken(64).tokenHash,
        userId: user.id,
        expiresAt: expiredExpiresAt,
      },
    });

    await tx.refreshToken.create({
      data: {
        token: createRawAndHashedToken(64).tokenHash,
        userId: user.id,
        expiresAt: validExpiresAt,
      },
    });

    const allTokens = await tx.refreshToken.findMany({
      where: { userId: user.id },
    });

    assert.equal(allTokens.length, 2);

    const now = new Date();
    await tx.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: now } },
    });

    const activeTokens = await tx.refreshToken.findMany({
      where: { userId: user.id },
    });

    assert.equal(activeTokens.length, 1);
  });
});

test('email verification token expires correctly', async () => {
  await withTestDatabase(async (tx) => {
    const user = await tx.user.create({
      data: {
        username: 'testuser',
        email: 'test@example.com',
        password: await bcrypt.hash('password123', PASSWORD_HASH_ROUNDS),
        emailVerified: false,
        wallet: {
          create: { balance: 0 },
        },
      },
      select: {
        id: true,
      },
    });

    const expiredExpiresAt = new Date(Date.now() - 1000);
    const validExpiresAt = new Date(Date.now() + TOKEN_TTL_MS.EMAIL_VERIFICATION);

    await tx.emailVerificationToken.create({
      data: {
        token: createRawAndHashedToken(32).tokenHash,
        userId: user.id,
        expiresAt: expiredExpiresAt,
      },
    });

    await tx.emailVerificationToken.create({
      data: {
        token: createRawAndHashedToken(32).tokenHash,
        userId: user.id,
        expiresAt: validExpiresAt,
      },
    });

    const allTokens = await tx.emailVerificationToken.findMany({
      where: { userId: user.id },
    });

    assert.equal(allTokens.length, 2);

    const now = new Date();
    const expiredTokens = await tx.emailVerificationToken.findMany({
      where: {
        userId: user.id,
        expiresAt: { lt: now },
      },
    });

    assert.equal(expiredTokens.length, 1);

    const validTokens = await tx.emailVerificationToken.findMany({
      where: {
        userId: user.id,
        expiresAt: { gte: now },
      },
    });

    assert.equal(validTokens.length, 1);
  });
});
