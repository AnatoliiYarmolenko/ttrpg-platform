const { logger } = require('../lib/logger');
const { getCorrelationId } = require('../lib/correlation');

const ALLOWED_LEVELS = new Set(['warn', 'error']);
const MAX_MESSAGE_LENGTH = 5000;
const MAX_META_STRING_LENGTH = 5000;
const MAX_STACK_LENGTH = 10000;
const MAX_META_KEYS = 20;
const MAX_META_ARRAY_LENGTH = 10;
const MAX_META_DEPTH = 4;

function normalizeMessage(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.slice(0, MAX_MESSAGE_LENGTH);
}

function clipString(value, maxLength = MAX_META_STRING_LENGTH) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.length > maxLength
    ? `${value.slice(0, maxLength)}...`
    : value;
}

function normalizeMetaValue(value, depth = 0) {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    return clipString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (depth >= MAX_META_DEPTH) {
    return '[Truncated]';
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_META_ARRAY_LENGTH)
      .map((item) => normalizeMetaValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .slice(0, MAX_META_KEYS)
      .map(([key, entryValue]) => [key, normalizeMetaValue(entryValue, depth + 1)]);

    const normalizedObject = Object.fromEntries(entries);

    if (Object.keys(value).length > MAX_META_KEYS) {
      normalizedObject.__truncatedKeys = Object.keys(value).length - MAX_META_KEYS;
    }

    return normalizedObject;
  }

  return String(value);
}

function normalizeMeta(value) {
  if (value == null) {
    return undefined;
  }

  const normalized = normalizeMetaValue(value);

  if (Array.isArray(normalized)) {
    return { items: normalized };
  }

  if (normalized && typeof normalized === 'object') {
    return normalized;
  }

  return { value: normalized };
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
    const correlationId = req.body?.correlationId || getCorrelationId();
    const sessionId = req.body?.sessionId;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const payload = {
      source: 'client',
      userId: req.user?.id,
      userAgent: req.get('user-agent'),
      path: typeof req.body?.path === 'string' ? clipString(req.body.path, 300) : undefined,
      correlationId,
      sessionId,
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
