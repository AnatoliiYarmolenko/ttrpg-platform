const { logger } = require('../lib/logger');
const { createTransporter, verifyTransporter } = require('./email/email-transporter');
const { renderEmailTemplate } = require('./email/email-template-renderer');

class EmailService {
  transporter = null;

  constructor() {
    this.initializeTransporter();
  }

  isTransientTransportError(error) {
    const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
    return message.includes('connection closed');
  }

  initializeTransporter() {
    try {
      this.transporter = createTransporter({ logger, env: process.env });
      verifyTransporter(this.transporter, logger);
    } catch (error) {
      logger.error({ err: error }, 'Email Service: Помилка ініціалізації');
      this.transporter = null;
    }
  }

  async sendTemplateEmail({ to, templateType, payload, successMessage, mockLogLabel }) {
    if (process.env.EMAIL_PROVIDER === 'disabled') {
      logger.info({ to, ...payload }, `MOCK EMAIL (${mockLogLabel})`);
      return { success: true, message: 'Email (Mock) успішно емульовано' };
    }

    if (!this.transporter) {
      return { success: false, message: 'Email сервіс не налаштований' };
    }

    const { subject, html } = renderEmailTemplate(templateType, payload);

    try {
      const info = await this.transporter.sendMail({
        from: `"TTRPG Platform" <${process.env.EMAIL_FROM || 'noreply@ttrpg.local'}>`,
        to,
        subject,
        html,
      });

      logger.info({ to, messageId: info.messageId }, successMessage);
      return { success: true, message: 'Email успішно надіслано' };
    } catch (error) {
      if (this.isTransientTransportError(error)) {
        logger.warn({ err: error, to }, 'Email Service: Відновлення SMTP-з\'єднання після transient помилки');
        this.initializeTransporter();

        if (this.transporter) {
          try {
            const retryInfo = await this.transporter.sendMail({
              from: `"TTRPG Platform" <${process.env.EMAIL_FROM || 'noreply@ttrpg.local'}>`,
              to,
              subject,
              html,
            });

            logger.info({ to, messageId: retryInfo.messageId }, successMessage);
            return { success: true, message: 'Email успішно надіслано' };
          } catch (retryError) {
            logger.error({ err: retryError, to }, 'Помилка повторного надсилання email');
            return { success: false, message: 'Помилка при надсиланні email' };
          }
        }
      }

      logger.error({ err: error, to }, 'Помилка надсилання email');
      return { success: false, message: 'Помилка при надсиланні email' };
    }
  }

  async sendPasswordResetEmail(email, resetUrl, userName = 'Користувач') {
    return this.sendTemplateEmail({
      to: email,
      templateType: 'password-reset',
      payload: { resetUrl, userName, link: resetUrl },
      successMessage: 'Email надіслано',
      mockLogLabel: 'Скидання пароля',
    });
  }

  async sendEmailVerificationEmail(email, verificationUrl, userName = 'Користувач') {
    return this.sendTemplateEmail({
      to: email,
      templateType: 'email-verification',
      payload: { verificationUrl, userName, link: verificationUrl },
      successMessage: 'Email верифікації надіслано',
      mockLogLabel: 'Верифікація',
    });
  }

  async sendEmailChangeConfirmation(newEmail, confirmUrl, userName = 'Користувач') {
    return this.sendTemplateEmail({
      to: newEmail,
      templateType: 'email-change',
      payload: { confirmUrl, userName, link: confirmUrl },
      successMessage: 'Email підтвердження зміни надіслано',
      mockLogLabel: 'Зміна email',
    });
  }
}

module.exports = new EmailService();
