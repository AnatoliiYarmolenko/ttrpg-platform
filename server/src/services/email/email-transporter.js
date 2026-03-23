const nodemailer = require('nodemailer');

function createTransporter({ logger, env = process.env }) {
  const emailProvider = env.EMAIL_PROVIDER || 'smtp';

  if (emailProvider === 'disabled') {
    logger.warn('Email Service: Режим відлагодження (відправка листів вимкнена)');
    return null;
  }

  if (emailProvider === 'gmail') {
    logger.info('Email Service: Gmail конфігурація активована');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_PASSWORD,
      },
    });
  }

  if (emailProvider === 'smtp') {
    const smtpPort = Number.parseInt(env.SMTP_PORT, 10) || 587;
    logger.info('Email Service: SMTP конфігурація активована');
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: smtpPort,
      secure: env.SMTP_SECURE === 'true',
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }

  logger.warn('Email Service: Невідомий провайдер email');
  return null;
}

async function verifyTransporter(transporter, logger) {
  if (!transporter) {
    return;
  }

  try {
    await transporter.verify();
    logger.info('Email Service: З\'єднання успішне');
  } catch (error) {
    logger.error({ err: error }, 'Email Service: Помилка з\'єднання');
  }
}

module.exports = {
  createTransporter,
  verifyTransporter,
};
