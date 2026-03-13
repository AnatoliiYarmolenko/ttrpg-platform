import axios from 'axios';

// 1. Створюємо інстанс
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', // Перевір свій URL
  withCredentials: true, // Важливо для cookies
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

// === CSRF Logic ===
const getCSRFToken = () => {
  // Твій код без змін
  if (typeof document === 'undefined') return null; // Перевірка на всяк випадок
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
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

// === Interceptors: Request ===
api.interceptors.request.use(
    (config) => {
      const csrfToken = getCSRFToken();
      if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
      
      // Запобігаємо кешуванню для запитів автентифікації
      // Використовуємо параметр замість заголовків, щоб уникнути CORS проблем
      if (config.url?.includes('/profile') || config.url?.includes('/auth/')) {
        // Додаємо timestamp до URL для запобігання кешуванню
        const separator = config.url.includes('?') ? '&' : '?';
        config.url = `${config.url}${separator}_t=${Date.now()}`;
      }
      
      return config;
    },
    (error) => Promise.reject(error)
  );

// === Refresh Token Logic ===
let isRefreshing = false;
let failedQueue = [];
let csrfBootstrapPromise = null;

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
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

// === Interceptors: Response ===
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      originalRequest &&
      isCsrfError(error) &&
      !originalRequest._csrfRetry &&
      !originalRequest._skipCsrfRetry &&
      !originalRequest.url?.includes('/auth/csrf-token')
    ) {
      originalRequest._csrfRetry = true;

      try {
        await ensureCsrfCookie();
        return api(originalRequest);
      } catch (csrfError) {
        return Promise.reject(csrfError);
      }
    }

    // Перевіряємо помилки 401/403 і щоб це не був сам запит на рефреш/логін
    if (
      shouldAttemptRefresh(error) &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Тут ми викликаємо рефреш через сам інстанс або окремий axios,
        // але важливо, щоб шляхи збігалися з бекендом
        await api.post('/auth/refresh'); 
        
        processQueue(null, null);
        isRefreshing = false;
        
        // Повторюємо оригінальний запит
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Тільки тут ми робимо редірект або чистку
        // Уникаємо циклу - не робимо редірект, якщо вже на сторінці логіну
        // або якщо це запит зі сторінки логіну
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && !originalRequest.url?.includes('/auth/login')) {
          // Очищаємо localStorage перед редіректом
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem('ttrpg_app_user');
          }
          window.location.href = '/login'; 
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;