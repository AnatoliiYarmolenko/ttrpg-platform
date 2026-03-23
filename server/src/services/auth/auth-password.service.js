function createAuthPasswordService({
  prisma,
  bcrypt,
  createError,
  AppError,
  ERROR_CODES,
  getTokenCandidates,
  createRawAndHashedToken,
  TOKEN_TTL_MS,
  PASSWORD_HASH_ROUNDS,
  emailService,
}) {
  return {
    async requestPasswordReset(email, normalizeEmail) {
      const normalizedEmail = normalizeEmail(email);

      const user = await prisma.user.findFirst({
        where: { email: normalizedEmail, isDeleted: false },
        select: { id: true, email: true, username: true },
      });

      if (!user) {
        return {
          message: 'Якщо email зареєстрований, ви отримаєте посилання для ресету',
        };
      }

      const { rawToken: resetToken, tokenHash: resetTokenHash } = createRawAndHashedToken(32);
      const resetExpiry = new Date(Date.now() + TOKEN_TTL_MS.PASSWORD_RESET);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetTokenHash,
          passwordResetExpiry: resetExpiry,
        },
      });

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

      const emailResult = await emailService.sendPasswordResetEmail(
        user.email,
        resetUrl,
        user.username || 'Користувач'
      );

      const shouldExposeResetDebugData =
        process.env.NODE_ENV !== 'production' && process.env.EXPOSE_AUTH_DEBUG_TOKENS === 'true';

      return {
        message: 'Посилання для ресету надіслано',
        emailSent: emailResult.success,
        emailMessage: emailResult.message,
        ...(shouldExposeResetDebugData && { resetToken, resetUrl }),
      };
    },

    async resetPassword(resetToken, newPassword) {
      const now = new Date();
      const tokenCandidates = getTokenCandidates(resetToken);

      if (tokenCandidates.length === 0) {
        throw createError.passwordResetTokenInvalid();
      }

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: {
            in: tokenCandidates,
          },
        },
        select: {
          id: true,
          passwordResetExpiry: true,
          username: true,
          email: true,
        },
      });

      if (!user) {
        throw createError.passwordResetTokenInvalid();
      }

      if (!user.passwordResetExpiry || now > user.passwordResetExpiry) {
        throw new AppError(ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED);
      }

      if (!newPassword || newPassword.length < 8) {
        throw new AppError(ERROR_CODES.PASSWORD_TOO_WEAK, 'Пароль повинен бути мінімум 8 символів');
      }

      const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpiry: null,
          },
        });

        await tx.refreshToken.deleteMany({
          where: { userId: user.id },
        });
      });

      return {
        message: 'Пароль успішно скинуто',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      };
    },
  };
}

module.exports = createAuthPasswordService;
