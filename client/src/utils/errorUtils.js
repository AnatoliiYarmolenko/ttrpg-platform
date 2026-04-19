/**
 * @param {any} error 
 * @param {string} [fallbackMessage]
 * @returns {string} 
 */
export function normalizePageError(error, fallbackMessage) {
  if (!error) return fallbackMessage;
  if (typeof error === 'string') return error;

  const responseData = error.response?.data;
  const apiMessage = responseData?.error || responseData?.message;
  if (apiMessage) return apiMessage;

  if (error.response?.status === 403) {
    return 'Недостатньо доступу';
  }

  return error.message || String(error);
}
