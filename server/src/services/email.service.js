const nodemailer = require('nodemailer');
const { logger } = require('../lib/logger');

/**
 * Email сервіс для відправлення листів (ресет пароля, верифікація, тощо)
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Ініціалізація transporter на основі змінних оточення
   */
  initializeTransporter() {
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'; 

    try {
      if (emailProvider === 'disabled') {
        logger.warn('Email Service: Режим відлагодження (відправка листів вимкнена)');
        return;
      }

      if (emailProvider === 'gmail') {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASSWORD,
          }
        });
        logger.info('Email Service: Gmail конфігурація активована');
      } else if (emailProvider === 'smtp') {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        });
        logger.info('Email Service: SMTP конфігурація активована');
      } else {
        logger.warn('Email Service: Невідомий провайдер email');
      }

      if (this.transporter) {
        this.transporter.verify((error) => {
          if (error) logger.error({ err: error }, 'Email Service: Помилка з\'єднання');
          else logger.info('Email Service: З\'єднання успішне');
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Email Service: Помилка ініціалізації');
    }
  }

  /**
   * Універсальний HTML шаблон (Wrapper)
   * Використовується для ВСІХ листів, щоб зберігати єдиний стиль
   */
  getHtmlTemplate(headerTitle, bodyContent) {
    return `
      <!DOCTYPE html>
      <html lang="uk">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
          .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
          .content h2 { margin-top: 0; color: #333; }
          .btn { display: inline-block; background-color: #5865F2; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 20px 0; text-align: center; }
          .btn:hover { background-color: #4752c4; }
          .warning-box { background-color: #fff8c4; border: 1px solid #e0c855; color: #755f08; padding: 15px; border-radius: 6px; font-size: 14px; margin: 20px 0; }
          .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999999; border-top: 1px solid #eeeeee; }
          .security-list { margin-top: 20px; font-size: 14px; color: #555; padding-left: 20px; }
          .security-list li { margin-bottom: 8px; }
          .link-text { font-size: 12px; word-break: break-all; color: #888; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 TTRPG Platform</h1>
            <p>${headerTitle}</p>
          </div>
          <div class="content">
            ${bodyContent}
          </div>
          <div class="footer">
            <p>&copy; 2026 TTRPG Platform. Всі права захищені.</p>
            <p>Цей лист був надісланий автоматично. Будь ласка, не відповідайте на нього.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Відправити листа для ресету пароля
   */
  async sendPasswordResetEmail(email, resetUrl, userName = 'Користувач') {
    if (process.env.EMAIL_PROVIDER === 'disabled') {
        logger.info({ to: email, link: resetUrl }, 'MOCK EMAIL (Скидання пароля)');
        return { success: true, message: 'Email (Mock) успішно емульовано' };
    }

    if (!this.transporter) return { success: false, message: 'Email сервіс не налаштований' };

    // Формуємо вміст листа
    const content = `
      <h2>Привіт, ${userName}! 👋</h2>
      <p>Ми отримали запит на скидання пароля для вашого акаунту. Якщо це не ви, просто ігноруйте цей лист.</p>
      <p>Щоб встановити новий пароль, натисніть на кнопку нижче:</p>
      
      <div style="text-align: center;">
        <a href="${resetUrl}" class="btn">Скинути пароль</a>
      </div>

      <div class="warning-box">
        ⚠️ <strong>Важливо:</strong> Це посилання дійсне тільки 1 годину. Якщо ви не скидаєте пароль протягом цього часу, запросіть нове посилання.
      </div>

      <p><strong>Безпека вашого акаунту:</strong></p>
      <ul class="security-list">
        <li>Ніколи не діліться цим посиланням з іншими</li>
        <li>TTRPG Staff ніколи не буде просити вас клікати на підозрілі посилання</li>
        <li>Переконайтеся, що ви на сайті ttrpg.local перед введенням пароля</li>
      </ul>
    `;

    const html = this.getHtmlTemplate('Скидання пароля', content);

    try {
      const info = await this.transporter.sendMail({
        from: `"TTRPG Platform" <${process.env.EMAIL_FROM || 'noreply@ttrpg.local'}>`,
        to: email,
        subject: '🔐 Скидання пароля - TTRPG Platform',
        html: html,
      });
      logger.info({ to: email, messageId: info.messageId }, 'Email надіслано');
      return { success: true, message: 'Email успішно надіслано' };
    } catch (error) {
      logger.error({ err: error, to: email }, 'Помилка надсилання email');
      return { success: false, message: 'Помилка при надсиланні email' };
    }
  }

  /**
   * Відправити листа для верифікації email
   */
  async sendEmailVerificationEmail(email, verificationUrl, userName = 'Користувач') {
    if (process.env.EMAIL_PROVIDER === 'disabled') {
        logger.info({ to: email, link: verificationUrl }, 'MOCK EMAIL (Верифікація)');
        return { success: true, message: 'Email (Mock) успішно емульовано' };
    }

    if (!this.transporter) return { success: false, message: 'Email сервіс не налаштований' };

    // Формуємо вміст листа
    const content = `
      <h2>Привіт, ${userName}! 👋</h2>
      <p>Дякуємо за реєстрацію на TTRPG Platform! Щоб почати користуватися всіма можливостями та активувати акаунт, будь ласка, підтвердіть свою електронну адресу.</p>
      
      <div style="text-align: center;">
        <a href="${verificationUrl}" class="btn">Підтвердити Email</a>
      </div>
      
      <div class="warning-box" style="background-color: #e3f2fd; border-color: #90caf9; color: #0d47a1;">
        ℹ️ <strong>Інформація:</strong> Посилання дійсне протягом 15 хвилин.
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 30px;">Якщо кнопка не працює, скопіюйте це посилання у браузер:</p>
      <p class="link-text">${verificationUrl}</p>
    `;

    const html = this.getHtmlTemplate('Підтвердження реєстрації', content);

    try {
      const info = await this.transporter.sendMail({
        from: `"TTRPG Platform" <${process.env.EMAIL_FROM || 'noreply@ttrpg.local'}>`,
        to: email,
        subject: '✅ Підтвердження реєстрації - TTRPG Platform',
        html: html,
      });
      logger.info({ to: email, messageId: info.messageId }, 'Email верифікації надіслано');
      return { success: true, message: 'Email верифікації надіслано' };
    } catch (error) {
      logger.error({ err: error, to: email }, 'Помилка надсилання email верифікації');
      return { success: false, message: 'Помилка при надсиланні email' };
    }
  }

  /**
   * Відправити листа для підтвердження зміни email
   */
  async sendEmailChangeConfirmation(newEmail, confirmUrl, userName = 'Користувач') {
    if (process.env.EMAIL_PROVIDER === 'disabled') {
        logger.info({ to: newEmail, link: confirmUrl }, 'MOCK EMAIL (Зміна email)');
        return { success: true, message: 'Email (Mock) успішно емульовано' };
    }

    if (!this.transporter) return { success: false, message: 'Email сервіс не налаштований' };

    const content = `
      <h2>Привіт, ${userName}! 👋</h2>
      <p>Ви запросили зміну email адреси вашого акаунту на TTRPG Platform.</p>
      <p>Щоб підтвердити цю зміну, натисніть на кнопку нижче:</p>
      
      <div style="text-align: center;">
        <a href="${confirmUrl}" class="btn">Підтвердити новий Email</a>
      </div>
      
      <div class="warning-box">
        ⚠️ <strong>Важливо:</strong> Посилання дійсне протягом 15 хвилин. Якщо ви не запитували зміну email, проігноруйте цей лист.
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 30px;">Якщо кнопка не працює, скопіюйте це посилання у браузер:</p>
      <p class="link-text">${confirmUrl}</p>
    `;

    const html = this.getHtmlTemplate('Підтвердження зміни Email', content);

    try {
      const info = await this.transporter.sendMail({
        from: `"TTRPG Platform" <${process.env.EMAIL_FROM || 'noreply@ttrpg.local'}>`,
        to: newEmail,
        subject: '📧 Підтвердження зміни Email - TTRPG Platform',
        html: html,
      });
      logger.info({ to: newEmail, messageId: info.messageId }, 'Email підтвердження зміни надіслано');
      return { success: true, message: 'Email підтвердження надіслано' };
    } catch (error) {
      logger.error({ err: error, to: newEmail }, 'Помилка надсилання email підтвердження зміни');
      return { success: false, message: 'Помилка при надсиланні email' };
    }
  }
}

module.exports = new EmailService();