const isDev = import.meta.env.DEV;
const LOG_ENDPOINT_PATH = '/client-logs';
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 10;
const MAX_OBJECT_KEYS = 20;
const MAX_DEPTH = 4;
const REDACTED_VALUE = '[Redacted]';
const SENSITIVE_KEY_PATTERN = /pass(word)?|token|secret|authorization|cookie|session|xsrf|csrf/i;

const noop = () => {};

const devConsole = {
  debug: isDev ? console.debug.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  log: isDev ? console.log.bind(console) : noop,
};

const prodAwareConsole = {
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const getApiBaseUrl = () => import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getCsrfToken = () => {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'XSRF-TOKEN') return decodeURIComponent(value);
  }

  return null;
};

const clipString = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...`
    : value;
};

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const serializeAxiosError = (error, depth, seen) => ({
  name: error.name,
  message: clipString(error.message || 'Axios error'),
  code: error.code,
  status: error.response?.status,
  method: error.config?.method,
  url: error.config?.url,
  response: serializeValue(error.response?.data, depth + 1, seen),
});

function serializeValue(value, depth = 0, seen = new WeakSet()) {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    return clipString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (depth >= MAX_DEPTH) {
    return '[Truncated]';
  }

  if (value instanceof Error) {
    if (value.isAxiosError) {
      return serializeAxiosError(value, depth, seen);
    }

    return {
      name: value.name,
      message: clipString(value.message || value.name || 'Error'),
      stack: clipString(value.stack),
    };
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => serializeValue(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    const serializedEntries = Object.entries(value)
      .slice(0, MAX_OBJECT_KEYS)
      .map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key)
          ? REDACTED_VALUE
          : serializeValue(entryValue, depth + 1, seen),
      ]);

    const serializedObject = Object.fromEntries(serializedEntries);

    if (Object.keys(value).length > MAX_OBJECT_KEYS) {
      serializedObject.__truncatedKeys = Object.keys(value).length - MAX_OBJECT_KEYS;
    }

    return serializedObject;
  }

  return String(value);
}

const extractMessage = (value) => {
  if (!value) {
    return 'Client log event';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.message || value.name || 'Client error';
  }

  if (typeof value.message === 'string') {
    return value.message;
  }

  if (typeof value.error === 'string') {
    return value.error;
  }

  return 'Client log event';
};

const toMessageAndMeta = (args) => {
  const [first, ...rest] = args;
  const normalizedRest = rest.map((arg) => serializeValue(arg));

  if (typeof first === 'string') {
    return {
      message: first,
      meta: normalizedRest.length === 0
        ? undefined
        : normalizedRest.length === 1 && isPlainObject(normalizedRest[0])
          ? normalizedRest[0]
          : { args: normalizedRest },
    };
  }

  const primary = serializeValue(first);

  return {
    message: extractMessage(first),
    meta: isPlainObject(primary)
      ? {
          ...primary,
          ...(normalizedRest.length > 0 ? { extra: normalizedRest } : {}),
        }
      : {
          value: primary,
          ...(normalizedRest.length > 0 ? { extra: normalizedRest } : {}),
        },
  };
};

const sendToBackend = (level, args) => {
  if (typeof window === 'undefined') {
    return;
  }

  const { message, meta } = toMessageAndMeta(args);
  const csrfToken = getCsrfToken();

  const payload = {
    level,
    message,
    meta,
    path: window.location?.pathname,
  };

  fetch(`${getApiBaseUrl()}${LOG_ENDPOINT_PATH}`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Intentionally swallow transport failures to avoid logging loops.
  });
};

const logger = {
  debug: (...args) => devConsole.debug(...args),
  info: (...args) => devConsole.info(...args),
  log: (...args) => devConsole.log(...args),
  warn: (...args) => {
    prodAwareConsole.warn(...args);
    sendToBackend('warn', args);
  },
  error: (...args) => {
    prodAwareConsole.error(...args);
    sendToBackend('error', args);
  },
};

export default logger;
