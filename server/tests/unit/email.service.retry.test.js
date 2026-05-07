const test = require('node:test');
const assert = require('node:assert/strict');

const emailServicePath = require.resolve('../../src/services/email.service');
const emailTransporterPath = require.resolve('../../src/services/email/email-transporter');
const loggerPath = require.resolve('../../src/lib/logger');

function loadEmailServiceWithMocks({ createTransporter, verifyTransporter, logger }) {
  const originalEmailServiceCache = require.cache[emailServicePath];
  const originalTransporterCache = require.cache[emailTransporterPath];
  const originalLoggerCache = require.cache[loggerPath];

  delete require.cache[emailServicePath];
  require.cache[emailTransporterPath] = {
    id: emailTransporterPath,
    filename: emailTransporterPath,
    loaded: true,
    exports: {
      createTransporter,
      verifyTransporter,
    },
  };

  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: {
      logger,
      httpLogger: logger,
    },
  };

  try {
    return require('../../src/services/email.service');
  } finally {
    delete require.cache[emailServicePath];

    if (originalTransporterCache) {
      require.cache[emailTransporterPath] = originalTransporterCache;
    } else {
      delete require.cache[emailTransporterPath];
    }

    if (originalLoggerCache) {
      require.cache[loggerPath] = originalLoggerCache;
    } else {
      delete require.cache[loggerPath];
    }

    if (originalEmailServiceCache) {
      require.cache[emailServicePath] = originalEmailServiceCache;
    }
  }
}

test('sendTemplateEmail reinitializes transporter after Connection closed and retries once', async () => {
  const logs = [];
  const logger = {
    info: (...args) => logs.push(['info', args]),
    warn: (...args) => logs.push(['warn', args]),
    error: (...args) => logs.push(['error', args]),
  };

  let createTransporterCalls = 0;
  const firstTransporter = {
    sendMail: async () => {
      const error = new Error('Connection closed');
      error.code = 'ECONNECTION';
      throw error;
    },
  };
  const secondTransporter = {
    sendMail: async () => ({ messageId: 'retry-message-id' }),
  };

  const emailService = loadEmailServiceWithMocks({
    createTransporter: () => {
      createTransporterCalls += 1;
      return createTransporterCalls === 1 ? firstTransporter : secondTransporter;
    },
    verifyTransporter: async () => {},
    logger,
  });

  const result = await emailService.sendTemplateEmail({
    to: 'user@example.com',
    templateType: 'password-reset',
    payload: {
      resetUrl: 'https://example.com/reset?token=test',
      userName: 'User',
      link: 'https://example.com/reset?token=test',
    },
    successMessage: 'Email надіслано',
    mockLogLabel: 'Password reset',
  });

  assert.equal(result.success, true);
  assert.equal(createTransporterCalls, 2);
  assert.ok(logs.some(([level, args]) => level === 'warn' && String(args[1]).includes('transient')));
});