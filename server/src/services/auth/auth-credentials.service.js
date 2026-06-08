const notificationService = require('../notification.service');

function createAuthCredentialsService({
  prisma,
  bcrypt,
  jwt,
  jwtSecret,
  createError,
  createRawAndHashedToken,
  TOKEN_TTL_MS,
  PASSWORD_HASH_ROUNDS,
}) {
  return {
    async registerUser(username, email, password, normalizeEmail, emailService) {
      const normalizedEmail = normalizeEmail(email);

      const existingUserByUsername = await prisma.user.findFirst({
        where: { username },
        select: { id: true },
      });

      if (existingUserByUsername) {
        throw createError.usernameTaken();
      }

      const existingUserByEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (existingUserByEmail) {
        throw createError.emailTaken();
      }

      const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

      const newUser = await prisma.user.create({
        data: {
          username,
          email: normalizedEmail,
          password: hashedPassword,
          wallet: {
            create: { balance: 0 },
          },
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
        },
      });

      const { rawToken, tokenHash } = createRawAndHashedToken(32);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.EMAIL_VERIFICATION);

      await prisma.emailVerificationToken.create({
        data: {
          token: tokenHash,
          userId: newUser.id,
          expiresAt,
        },
      });

      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;

      emailService
        .sendEmailVerificationEmail(newUser.email, verificationUrl, newUser.username)
        .catch(() => {});

      return newUser;
    },

    async loginUser(email, password, normalizeEmail) {
      const normalizedEmail = normalizeEmail(email);

      const user = await prisma.user.findFirst({
        where: { email: normalizedEmail, isDeleted: false },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          emailVerified: true,
          role: true,
          isBanned: true,
        },
      });

      if (!user) {
        throw createError.invalidCredentials();
      }

      if (!user.emailVerified) {
        throw createError.emailNotVerified();
      }

      if (user.isBanned) {
        throw createError.userBanned();
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        throw createError.invalidCredentials();
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        jwtSecret,
        { expiresIn: '15m' }
      );

      const { rawToken: refreshToken, tokenHash: refreshTokenHash } = createRawAndHashedToken(64);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.REFRESH_TOKEN);

      const MAX_SESSIONS = 5;
      const now = new Date();

      await prisma.refreshToken.deleteMany({
        where: { userId: user.id, expiresAt: { lt: now } },
      });

      const activeSessions = await prisma.refreshToken.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (activeSessions.length >= MAX_SESSIONS) {
        const toDelete = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
        await prisma.refreshToken.deleteMany({
          where: { id: { in: toDelete.map((t) => t.id) } },
        });
      }

      await prisma.refreshToken.create({
        data: { token: refreshTokenHash, userId: user.id, expiresAt },
      });

      notificationService.createNotification({
        eventKey: 'welcome_login',
        type: 'WELCOME_LOGIN',
        severity: 'INFO',
        category: 'system',
        title: `Вітаємо, ${user.username}!`,
        body: 'Раді бачити вас на платформі.',
        recipientIds: [user.id],
        metadata: { isWelcome: true },
      }).catch(() => {
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      };
    },
  };
}

module.exports = createAuthCredentialsService;
