const { logger } = require('../lib/logger');

const ALLOWED_LEVELS = new Set(['warn', 'error']);
const MAX_MESSAGE_LENGTH = 1000;
const MAX_META_LENGTH = 3000;

function normalizeMessage(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.slice(0, MAX_MESSAGE_LENGTH);
}

function normalizeMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return undefined;
    }

    return JSON.parse(serialized.slice(0, MAX_META_LENGTH));
  } catch {
    return undefined;
  }
}

function normalizeLevel(level) {
  if (!ALLOWED_LEVELS.has(level)) {
    return 'error';
  }

  return level;
}

async function ingestClientLog(req, res, next) {
  try {
    const level = normalizeLevel(req.body?.level);
    const message = normalizeMessage(req.body?.message);
    const meta = normalizeMeta(req.body?.meta);

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const payload = {
      source: 'client',
      userId: req.user?.id,
      userAgent: req.get('user-agent'),
      path: req.body?.path,
      meta,
    };

    logger[level](payload, `[Client] ${message}`);

    return res.status(202).json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  ingestClientLog,
};
