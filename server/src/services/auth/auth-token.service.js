function findStoredRefreshToken(prisma, tokenHash) {
  return prisma.refreshToken.findFirst({
    where: { token: tokenHash },
    select: { id: true, userId: true, expiresAt: true },
  });
}

function assertRefreshTokenPresence({ prisma, logger, createError, oldRefreshToken }) {
  if (!prisma?.refreshToken) {
    logger.error('Prisma client or refreshToken model is unavailable');
    throw createError.serverError();
  }

  if (!oldRefreshToken) {
    throw createError.refreshTokenMissing();
  }
}

function assertTokenHash(tokenHash, createError) {
  if (!tokenHash) {
    throw createError.refreshTokenInvalid();
  }
}

function assertStoredToken(storedToken, createError) {
  if (!storedToken) {
    throw createError.refreshTokenInvalid();
  }

  if (new Date() > storedToken.expiresAt) {
    throw createError.refreshTokenExpired();
  }
}

async function acquireUserRefreshLock({
  acquireRefreshLock,
  createError,
  logger,
  userId,
}) {
  try {
    const lockValue = await acquireRefreshLock(userId, 5000);

    if (!lockValue) {
      throw createError.rateLimitExceeded(5);
    }

    return lockValue;
  } catch (err) {
    if (err?.status === 429) {
      throw err;
    }

    logger.error({ err, userId }, '[Auth] Redis lock is unavailable');
    return null;
  }
}

async function loadRefreshUser({ prisma, createError, isUserDeleted, userId }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, role: true, isBanned: true },
  });

  if (!user || await isUserDeleted(user.id)) {
    throw createError.userNotFound();
  }

  if (user.isBanned) {
    throw createError.userBanned();
  }

  return user;
}

function createAccessToken({ jwt, jwtSecret, user }) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    jwtSecret,
    { expiresIn: '15m' }
  );
}

function createSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: new Date(),
  };
}

async function releaseUserRefreshLock({
  releaseRefreshLock,
  logger,
  userId,
  lockValue,
}) {
  if (!lockValue) {
    return;
  }

  try {
    await releaseRefreshLock(userId, lockValue);
  } catch (err) {
    logger.error({ err, userId }, '[Auth] Failed to release Redis lock');
  }
}

function createAuthTokenService({
  prisma,
  jwt,
  jwtSecret,
  logger,
  createError,
  hashToken,
  createRawAndHashedToken,
  TOKEN_TTL_MS,
  checkRefreshRateLimit,
  isUserDeleted,
  acquireRefreshLock,
  releaseRefreshLock,
}) {
  return {
    async refreshTokens(oldRefreshToken) {
      assertRefreshTokenPresence({ prisma, logger, createError, oldRefreshToken });

      const tokenHash = hashToken(oldRefreshToken);
      assertTokenHash(tokenHash, createError);

      let stored = await findStoredRefreshToken(prisma, tokenHash);
      assertStoredToken(stored, createError);

      await checkRefreshRateLimit(stored.userId);

      const lockValue = await acquireUserRefreshLock({
        acquireRefreshLock,
        createError,
        logger,
        userId: stored.userId,
      });

      try {
        stored = await findStoredRefreshToken(prisma, tokenHash);
        assertStoredToken(stored, createError);

        const now = new Date();
        await prisma.refreshToken.deleteMany({
          where: { userId: stored.userId, expiresAt: { lt: now } },
        });

        const user = await loadRefreshUser({
          prisma,
          createError,
          isUserDeleted,
          userId: stored.userId,
        });

        await prisma.refreshToken.delete({ where: { id: stored.id } });

        const accessToken = createAccessToken({ jwt, jwtSecret, user });
        const { rawToken: newRefreshToken, tokenHash: newRefreshTokenHash } =
          createRawAndHashedToken(64);
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.REFRESH_TOKEN);

        await prisma.refreshToken.create({
          data: { token: newRefreshTokenHash, userId: user.id, expiresAt },
        });

        return {
          accessToken,
          refreshToken: newRefreshToken,
          user: createSafeUser(user),
        };
      } finally {
        await releaseUserRefreshLock({
          releaseRefreshLock,
          logger,
          userId: stored.userId,
          lockValue,
        });
      }
    },

    async revokeRefreshToken(refreshToken) {
      if (!refreshToken || !prisma?.refreshToken) {
        return;
      }

      const tokenHash = hashToken(refreshToken);
      if (!tokenHash) {
        return;
      }

      try {
        await prisma.refreshToken.deleteMany({
          where: {
            token: tokenHash,
          },
        });
      } catch (error) {
        logger.error({ error }, '[Auth] Failed to revoke refresh token');
      }
    },
  };
}

module.exports = createAuthTokenService;
