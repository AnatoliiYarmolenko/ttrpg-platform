/**
 * Формує WebSocket URL для signaling-з'єднання дзвінка.
 * @param {string} wsCallPath - Шлях із call config (наприклад, '/ws/call')
 * @returns {string} Повний WebSocket URL
 */
export function resolveCallWsUrl(wsCallPath) {
  if (!wsCallPath) return null;

  // Використовуємо поточний origin, щоб визначити протокол та хост
  const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // У dev-режимі Vite proxy може проксувати /ws на бекенд,
  // але якщо бекенд на іншому порту і без проксі, потрібна окрема конфігурація.
  // Зазвичай Vite проксовує або ми підключаємось до того ж хоста.
  // Покладаємось на той самий хост і очікуємо, що проксі це обробить, як у чаті.
  const host = globalThis.location.host;

  return `${protocol}//${host}${wsCallPath}`;
}
