/**
 * Формує WebSocket URL для signaling-з'єднання дзвінка.
 * @param {string} wsCallPath - Шлях із call config (наприклад, '/ws/call')
 * @returns {string} Повний WebSocket URL
 */
export function resolveCallWsUrl(wsCallPath) {
  if (!wsCallPath) return null;

  const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // Визначаємо хост на основі VITE_API_URL (як у чаті)
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
  
  let host;
  if (baseUrl.startsWith('http')) {
    const urlObj = new URL(baseUrl);
    host = urlObj.host;
  } else {
    host = globalThis.location.host;
  }

  return `${protocol}//${host}${wsCallPath}`;
}
