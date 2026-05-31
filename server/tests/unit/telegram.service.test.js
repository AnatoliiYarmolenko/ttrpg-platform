const test = require('node:test');
const assert = require('node:assert/strict');

function loadTelegramServiceWithMocks(t, { configMock, profileServiceMock, telegrafMock, loggerMock }) {
  const telegramServicePath = require.resolve('../../src/services/telegram.service');
  const configPath = require.resolve('../../src/config/config');
  const profileServicePath = require.resolve('../../src/services/profile.service');
  const loggerPath = require.resolve('../../src/lib/logger');
  
  const telegrafPath = require.resolve('telegraf');

  const origConfig = require.cache[configPath];
  const origProfile = require.cache[profileServicePath];
  const origLogger = require.cache[loggerPath];
  const origTelegraf = require.cache[telegrafPath];
  const origService = require.cache[telegramServicePath];

  delete require.cache[telegramServicePath];
  
  require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: configMock };
  require.cache[profileServicePath] = { id: profileServicePath, filename: profileServicePath, loaded: true, exports: profileServiceMock };
  require.cache[loggerPath] = { id: loggerPath, filename: loggerPath, loaded: true, exports: { logger: loggerMock } };
  require.cache[telegrafPath] = { id: telegrafPath, filename: telegrafPath, loaded: true, exports: { Telegraf: telegrafMock } };

  t.after(() => {
    delete require.cache[telegramServicePath];
    if (origConfig) require.cache[configPath] = origConfig; else delete require.cache[configPath];
    if (origProfile) require.cache[profileServicePath] = origProfile; else delete require.cache[profileServicePath];
    if (origLogger) require.cache[loggerPath] = origLogger; else delete require.cache[loggerPath];
    if (origTelegraf) require.cache[telegrafPath] = origTelegraf; else delete require.cache[telegrafPath];
    if (origService) require.cache[telegramServicePath] = origService;
  });

  const exported = require('../../src/services/telegram.service');
  return {
    telegramService: exported,
    TelegramServiceClass: exported.TelegramService
  };
}

class MockTelegraf {
  constructor(token) {
    this.token = token;
    this.handlers = {};
    this.launched = false;
    this.stopped = false;
    this.webhookUrl = null;
    this.webhookDeleted = false;
    this.sentMessages = [];
    
    this.telegram = {
      setWebhook: async (url) => { this.webhookUrl = url; },
      deleteWebhook: async () => { this.webhookDeleted = true; },
      sendMessage: async (chatId, text, extra) => {
        this.sentMessages.push({ chatId, text, extra });
        return { message_id: 123 };
      }
    };
  }
  start(handler) { this.handlers.start = handler; }
  command(cmd, handler) { this.handlers[cmd] = handler; }
  on(event, handler) { this.handlers[event] = handler; }
  webhookCallback(path) { return `webhook-${path}`; }
  launch() { this.launched = true; }
  stop(signal) { this.stopped = signal; }

  async simulateStart(ctx) {
    if (this.handlers.start) await this.handlers.start(ctx);
  }
  async simulateCommand(cmd, ctx) {
    if (this.handlers[cmd]) await this.handlers[cmd](ctx);
  }
  async simulateEvent(event, ctx) {
    if (this.handlers[event]) await this.handlers[event](ctx);
  }
}

const defaultLoggerMock = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

test('TelegramService Test Suite', async (suite) => {

  await suite.test('TelegramService - initialization', async (t) => {
  await t.test('initializes if token is provided', () => {
    let constructorCalled = false;
    class SpiedMockTelegraf extends MockTelegraf {
      constructor(token) {
        super(token);
        constructorCalled = true;
      }
    }
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: 'mock-token' },
      profileServiceMock: {},
      telegrafMock: SpiedMockTelegraf,
      loggerMock: defaultLoggerMock,
    });
    
    assert.ok(constructorCalled);
    assert.ok(telegramService.bot instanceof SpiedMockTelegraf);
  });

  await t.test('does not initialize if token is missing and logs warning', () => {
    const logs = [];
    const loggerMock = {
      ...defaultLoggerMock,
      warn: (msg) => logs.push(msg)
    };
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: null },
      profileServiceMock: {},
      telegrafMock: MockTelegraf,
      loggerMock,
    });
    
    assert.equal(telegramService.bot, null);
    assert.ok(logs.some(msg => msg.includes('TELEGRAM_BOT_TOKEN не задано')));
  });
});

  await suite.test('TelegramService - message formatting', async (t) => {
  const { TelegramServiceClass } = loadTelegramServiceWithMocks(t, {
    configMock: { telegramBotToken: 'mock-token', frontendUrl: 'https://test.com' },
    profileServiceMock: {},
    telegrafMock: MockTelegraf,
    loggerMock: defaultLoggerMock,
  });
  const service = new TelegramServiceClass();

  await t.test('formats basic message properly', () => {
    const payload = {
      title: 'New Session',
      body: 'Session is starting soon',
      severity: 'INFO'
    };
    const result = service._formatMessage(payload);
    assert.equal(result.includes('ℹ️ <b>New Session</b>'), true);
    assert.equal(result.includes('Session is starting soon'), true);
  });

  await t.test('escapes HTML tags in title and body', () => {
    const payload = {
      title: '<script>alert(1)</script>',
      body: 'a & b > c',
    };
    const result = service._formatMessage(payload);
    assert.equal(result.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
    assert.equal(result.includes('a &amp; b &gt; c'), true);
  });

  await t.test('resolves different severities to correct emojis', () => {
    assert.equal(service._formatMessage({ title: 'T', severity: 'SUCCESS' }).includes('✅'), true);
    assert.equal(service._formatMessage({ title: 'T', severity: 'WARNING' }).includes('⚠️'), true);
    assert.equal(service._formatMessage({ title: 'T', severity: 'ERROR' }).includes('❌'), true);
    assert.equal(service._formatMessage({ title: 'T', severity: 'CRITICAL' }).includes('🚨'), true);
    assert.equal(service._formatMessage({ title: 'T', severity: 'SECURITY' }).includes('🔐'), true);
    assert.equal(service._formatMessage({ title: 'T', severity: 'UNKNOWN' }).includes('ℹ️'), true);
  });

  await t.test('appends links correctly (absolute and relative)', () => {
    const payloadAbs = { title: 'T', link: 'https://google.com' };
    const resAbs = service._formatMessage(payloadAbs);
    assert.equal(resAbs.includes('<a href="https://google.com">Перейти</a>'), true);

    const payloadRel = { title: 'T', link: '/dashboard' };
    const resRel = service._formatMessage(payloadRel);

    assert.equal(resRel.includes('<a href="https://test.com/dashboard">Перейти</a>'), true);
  });

  await t.test('handles null body gracefully', () => {
    const payload = { title: 'T', body: null };
    const result = service._formatMessage(payload);

    assert.equal(result.includes('null'), false);
    assert.equal(result.includes('undefined'), false);
  });
});

  await suite.test('TelegramService - sendMessage', async (t) => {
  await t.test('throws if bot is not initialized', async (t) => {
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: null },
      profileServiceMock: {},
      telegrafMock: MockTelegraf,
      loggerMock: defaultLoggerMock,
    });
    
    await assert.rejects(
      telegramService.sendMessage(12345, { title: 'Test' }),
      /Telegram bot is not initialized/
    );
  });

  await t.test('sends formatted message via telegraf', async (t) => {
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: 'mock-token' },
      profileServiceMock: {},
      telegrafMock: MockTelegraf,
      loggerMock: defaultLoggerMock,
    });
    
    telegramService.isInitialized = true;
    
    await telegramService.sendMessage(12345, { title: 'Test Title' });
    
    const botMock = telegramService.bot;
    assert.equal(botMock.sentMessages.length, 1);
    assert.equal(botMock.sentMessages[0].chatId, 12345);
    assert.equal(botMock.sentMessages[0].text.includes('Test Title'), true);
    assert.equal(botMock.sentMessages[0].extra.parse_mode, 'HTML');
  });

  await t.test('throws and logs error when sending fails', async (t) => {
    const logs = [];
    const loggerMock = { ...defaultLoggerMock, error: (...args) => logs.push(args) };
    
    class FailingTelegraf extends MockTelegraf {
      constructor(t) {
        super(t);
        this.telegram.sendMessage = async () => { throw new Error('API Error'); };
      }
    }
    
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: 'mock-token' },
      profileServiceMock: {},
      telegrafMock: FailingTelegraf,
      loggerMock,
    });
    telegramService.isInitialized = true;
    
    await assert.rejects(
      telegramService.sendMessage(12345, { title: 'Test Title' }),
      /API Error/
    );
    assert.equal(logs.length, 1);
  });
});

  await suite.test('TelegramService - commands', async (t) => {
  await t.test('/start without payload returns instruction', async (t) => {
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: 'mock-token' },
      profileServiceMock: {},
      telegrafMock: MockTelegraf,
      loggerMock: defaultLoggerMock,
    });
    
    const replies = [];
    const ctx = {
      payload: null,
      chat: { id: 123 },
      reply: async (text) => { replies.push(text); }
    };
    
    await telegramService.bot.simulateStart(ctx);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].includes('прив\'яжіть акаунт'), true);
  });

  await t.test('/start with valid payload links account', async (t) => {
    const profileServiceMock = {
      linkTelegram: async (payload, chatId) => {
        assert.equal(payload, 'valid-token');
        assert.equal(chatId, 123);
        return true;
      }
    };
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: 'mock-token' },
      profileServiceMock,
      telegrafMock: MockTelegraf,
      loggerMock: defaultLoggerMock,
    });
    
    const replies = [];
    const ctx = {
      payload: 'valid-token',
      chat: { id: 123 },
      reply: async (text) => { replies.push(text); }
    };
    
    await telegramService.bot.simulateStart(ctx);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].includes('успішно прив\'язано'), true);
  });

  await t.test('/start with invalid payload handles failure', async (t) => {
    const profileServiceMock = {
      linkTelegram: async () => false
    };
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: 'mock-token' },
      profileServiceMock,
      telegrafMock: MockTelegraf,
      loggerMock: defaultLoggerMock,
    });
    
    const replies = [];
    const ctx = {
      payload: 'invalid-token',
      chat: { id: 123 },
      reply: async (text) => { replies.push(text); }
    };
    
    await telegramService.bot.simulateStart(ctx);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].includes('Посилання недійсне або прострочене'), true);
  });

  await t.test('/stop unlinks account', async (t) => {
    let unlinkedId = null;
    const profileServiceMock = {
      unlinkTelegramByChatId: async (chatId) => {
        unlinkedId = chatId;
      }
    };
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: 'mock-token' },
      profileServiceMock,
      telegrafMock: MockTelegraf,
      loggerMock: defaultLoggerMock,
    });
    
    const replies = [];
    const ctx = {
      chat: { id: 123 },
      reply: async (text) => { replies.push(text); }
    };
    
    await telegramService.bot.simulateCommand('stop', ctx);
    assert.equal(unlinkedId, 123);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].includes('відв\'язано'), true);
  });

  await t.test('message event replies with placeholder in private chat', async (t) => {
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: 'mock-token' },
      profileServiceMock: {},
      telegrafMock: MockTelegraf,
      loggerMock: defaultLoggerMock,
    });
    
    const replies = [];
    const ctx = {
      chat: { type: 'private', id: 123 },
      reply: async (text) => { replies.push(text); }
    };
    
    await telegramService.bot.simulateEvent('message', ctx);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].includes('не розуміє текстових повідомлень'), true);
  });

  await t.test('message event ignores non-private chats', async (t) => {
    const { telegramService } = loadTelegramServiceWithMocks(t, {
      configMock: { telegramBotToken: 'mock-token' },
      profileServiceMock: {},
      telegrafMock: MockTelegraf,
      loggerMock: defaultLoggerMock,
    });
    
    const replies = [];
    const ctx = {
      chat: { type: 'group', id: 123 },
      reply: async (text) => { replies.push(text); }
    };
    
    await telegramService.bot.simulateEvent('message', ctx);
    assert.equal(replies.length, 0);
  });
});
});
