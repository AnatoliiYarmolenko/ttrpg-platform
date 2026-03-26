const isDev = import.meta.env.DEV;
const LOG_ENDPOINT_PATH = '/client-logs';

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

const toMessageAndMeta = (args) => {
  const [first, ...rest] = args;

  if (typeof first === 'string') {
    return {
      message: first,
      meta: rest.length ? rest : undefined,
    };
  }

  return {
    message: 'Client log event',
    meta: args.length ? args : undefined,
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
