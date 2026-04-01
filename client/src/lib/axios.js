import axios from 'axios';

// Shared axios instance configuration.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const CSRF_ERROR_CODE = 'SECURITY_CSRF_INVALID';
const RECOVERABLE_AUTH_ERROR_CODES = new Set([
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
]);

const getCSRFToken = () => {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'XSRF-TOKEN') return decodeURIComponent(value);
  }

  return null;
};

const isCsrfError = (error) => {
  if (error.response?.status !== 403) return false;

  const { code, error: errorText, message } = error.response?.data || {};
  if (code === CSRF_ERROR_CODE) return true;

  const combinedMessage = [errorText, message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return combinedMessage.includes('csrf');
};

const shouldAttemptRefresh = (error) => {
  if (error.response?.status !== 401) {
    return false;
  }

  const code = error.response?.data?.code;
  if (!code) {
    return true;
  }

  return RECOVERABLE_AUTH_ERROR_CODES.has(code);
};

const shouldRetryCsrf = (error, originalRequest) => (
  Boolean(originalRequest)
  && isCsrfError(error)
  && !originalRequest._csrfRetry
  && !originalRequest._skipCsrfRetry
  && !originalRequest.url?.includes('/auth/csrf-token')
);

const shouldHandleRefresh = (error, originalRequest) => (
  shouldAttemptRefresh(error)
  && !originalRequest?._retry
  && !originalRequest?.url?.includes('/auth/refresh')
  && !originalRequest?.url?.includes('/auth/login')
);

const isLoginRoute = (originalRequest) => (
  originalRequest?.url?.includes('/auth/login')
);

const clearExpiredAuthState = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.localStorage) {
    window.localStorage.removeItem('ttrpg_app_user');
  }

  window.dispatchEvent(
    new CustomEvent('app:auth-expired', { detail: { redirectTo: '/login' } })
  );
};

api.interceptors.request.use(
  (config) => {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    if (config.url?.startsWith('/profile') || config.url?.startsWith('/auth/')) {
      config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      config.headers.Pragma = 'no-cache';
    }

    return config;
  },
  (error) => {
    throw error;
  }
);

let isRefreshing = false;
let failedQueue = [];
let csrfBootstrapPromise = null;

const processQueue = (error, token = null) => {
  failedQueue.forEach((promiseHandlers) => {
    if (error) promiseHandlers.reject(error);
    else promiseHandlers.resolve(token);
  });
  failedQueue = [];
};

const ensureCsrfCookie = async () => {
  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = api
      .get('/auth/csrf-token', { _skipCsrfRetry: true })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
};

const retryWithFreshCsrf = async (originalRequest) => {
  originalRequest._csrfRetry = true;
  await ensureCsrfCookie();
  return api(originalRequest);
};

const waitForRefreshAndRetry = (originalRequest) => (
  new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  }).then(() => api(originalRequest))
);

const handleRefreshFailure = (refreshError, originalRequest) => {
  processQueue(refreshError, null);

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  if (currentPath !== '/login' && !isLoginRoute(originalRequest)) {
    clearExpiredAuthState();
  }

  throw refreshError;
};

const refreshAndRetryRequest = async (originalRequest) => {
  if (isRefreshing) {
    return waitForRefreshAndRetry(originalRequest);
  }

  originalRequest._retry = true;
  isRefreshing = true;

  try {
    await api.post('/auth/refresh');
    processQueue(null, null);
    return api(originalRequest);
  } catch (refreshError) {
    return handleRefreshFailure(refreshError, originalRequest);
  } finally {
    isRefreshing = false;
  }
};

const handleResponseError = async (error) => {
  const originalRequest = error.config;

  if (shouldRetryCsrf(error, originalRequest)) {
    return retryWithFreshCsrf(originalRequest);
  }

  if (shouldHandleRefresh(error, originalRequest)) {
    return refreshAndRetryRequest(originalRequest);
  }

  throw error;
};

api.interceptors.response.use(
  (response) => response,
  handleResponseError
);

export default api;
