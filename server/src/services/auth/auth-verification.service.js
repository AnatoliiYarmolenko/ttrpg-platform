function createAuthVerificationService({
  prisma,
  createError,
  getTokenCandidates,
  createRawAndHashedToken,
  emailService,
  TOKEN_TTL_MS,
}) {
  return {
    async verifyEmailToken(token) {
      const now = new Date();
      const tokenCandidates = getTokenCandidates(token);

      if (tokenCandidates.length === 0) {
        return { success: false, message: 'Токен не знайдено або вже використано.' };
      }

      const record = await prisma.emailVerificationToken.findFirst({
        where: {
          token: { in: tokenCandidates },
        },
        include: { user: true },
      });

      if (!record) {
        return { success: false, message: 'Токен не знайдено або вже використано.' };
      }

      if (record.expiresAt < now) {
        await prisma.emailVerificationToken.delete({ where: { id: record.id } });
        return { success: false, message: 'Термін дії посилання вичерпано. Запросіть нове.' };
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: record.userId },
          data: { emailVerified: true },
        }),
        prisma.emailVerificationToken.deleteMany({
          where: { userId: record.userId },
        }),
      ]);

      return { success: true };
    },

    async resendVerificationEmail(email, normalizeEmail) {
      const normalizedEmail = normalizeEmail(email);
      const genericMessage = 'Якщо цей email зареєстрований, лист відправлено.';

      const user = await prisma.user.findFirst({
        where: { email: normalizedEmail, isDeleted: false },
        select: { id: true, email: true, username: true, emailVerified: true },
      });

      if (!user) {
        return { message: genericMessage };
      }

      if (user.emailVerified) {
        return { message: genericMessage };
      }

      await prisma.emailVerificationToken.deleteMany({
        where: { userId: user.id },
      });

      const { rawToken, tokenHash } = createRawAndHashedToken(32);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.EMAIL_VERIFICATION);

      await prisma.emailVerificationToken.create({
        data: {
          token: tokenHash,
          userId: user.id,
          expiresAt,
        },
      });

      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;

      const emailResult = await emailService.sendEmailVerificationEmail(
        user.email,
        verificationUrl,
        user.username
      );

      if (!emailResult.success) {
        throw createError.emailSendFailed();
      }

      return { message: genericMessage };
    },
  };
}

module.exports = createAuthVerificationService;
