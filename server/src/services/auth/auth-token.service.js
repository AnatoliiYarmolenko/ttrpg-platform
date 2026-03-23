function createAuthTokenService({
  prisma,
  jwt,
  jwtSecret,
  logger,
  createError,
  getTokenCandidates,
  createRawAndHashedToken,
  TOKEN_TTL_MS,
  checkRefreshRateLimit,
  isUserDeleted,
  acquireRefreshLock,
  releaseRefreshLock,
}) {
  return {
    async refreshTokens(oldRefreshToken) {
      if (!prisma || !prisma.refreshToken) {
        logger.error('Prisma Client або модель refreshToken недоступні');
        throw createError.serverError();
      }

      if (!oldRefreshToken) {
        throw createError.refreshTokenMissing();
      }

      const tokenCandidates = getTokenCandidates(oldRefreshToken);
      if (tokenCandidates.length === 0) {
        throw createError.refreshTokenInvalid();
      }

      let stored = await prisma.refreshToken.findFirst({
        where: { token: { in: tokenCandidates } },
        select: { id: true, userId: true, expiresAt: true },
      });

      if (!stored) {
        throw createError.refreshTokenInvalid();
      }

      if (new Date() > stored.expiresAt) {
        throw createError.refreshTokenExpired();
      }

      await checkRefreshRateLimit(stored.userId);

      let lockValue = null;
      try {
        lockValue = await acquireRefreshLock(stored.userId, 5000);
        if (!lockValue) {
          throw createError.rateLimitExceeded(5);
        }
      } catch (err) {
        if (err && err.status === 429) {
          throw err;
        }
        logger.error({ err, userId: stored.userId }, '[Auth] Redis lock недоступний');
      }

      try {
        const storedAgain = await prisma.refreshToken.findFirst({
          where: { token: { in: tokenCandidates } },
          select: { id: true, userId: true, expiresAt: true },
        });

        if (!storedAgain) {
          throw createError.refreshTokenInvalid();
        }

        const now = new Date();
        await prisma.refreshToken.deleteMany({
          where: { userId: storedAgain.userId, expiresAt: { lt: now } },
        });

        const user = await prisma.user.findUnique({
          where: { id: storedAgain.userId },
          select: { id: true, username: true, email: true, role: true },
        });

        if (!user) {
          throw createError.userNotFound();
        }

        if (await isUserDeleted(user.id)) {
          throw createError.userNotFound();
        }

        await prisma.refreshToken.delete({ where: { id: storedAgain.id } });

        const accessToken = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          jwtSecret,
          { expiresIn: '15m' }
        );

        const { rawToken: newRefreshToken, tokenHash: newRefreshTokenHash } = createRawAndHashedToken(64);
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.REFRESH_TOKEN);

        await prisma.refreshToken.create({
          data: { token: newRefreshTokenHash, userId: user.id, expiresAt },
        });

        const safeUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: new Date(),
        };

        return { accessToken, refreshToken: newRefreshToken, user: safeUser };
      } finally {
        if (lockValue) {
          try {
            await releaseRefreshLock(stored.userId, lockValue);
          } catch (err) {
            logger.error({ err, userId: stored.userId }, '[Auth] Не вдалося звільнити Redis lock');
          }
        }
      }
    },

    async revokeRefreshToken(refreshToken) {
      if (!refreshToken) return;

      const tokenCandidates = getTokenCandidates(refreshToken);
      if (tokenCandidates.length === 0) return;

      if (!prisma || !prisma.refreshToken) {
        return;
      }

      try {
        await prisma.refreshToken.deleteMany({
          where: {
            token: { in: tokenCandidates },
          },
        });
      } catch (error) {
        // ignore logout revoke errors
      }
    },
  };
}

module.exports = createAuthTokenService;
