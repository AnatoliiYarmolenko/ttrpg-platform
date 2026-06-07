/**
 * resolveMediaUrl — утиліта для перетворення відносних URL у абсолютні.
 *
 * Використовується скрізь де сервер повертає відносний шлях (наприклад `/uploads/map.jpg`)
 * і нам потрібен повний URL для завантаження ресурсу на клієнті.
 *
 * @param {string | null | undefined} url - Відносний або абсолютний URL
 * @returns {string | null} - Абсолютний URL або null якщо url порожній
 *
 * @example
 * resolveMediaUrl('/uploads/map.jpg')
 * // → 'http://localhost:5000/uploads/map.jpg'
 *
 * resolveMediaUrl('http://cdn.example.com/map.jpg')
 * // → 'http://cdn.example.com/map.jpg' (без змін)
 *
 * resolveMediaUrl(null)
 * // → null
 */
export function resolveMediaUrl(url) {
  if (!url) return null;

  // Якщо вже абсолютний URL — повертаємо без змін
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${url}`;
}

/**
 * Повертає базовий URL сервера (без `/api`).
 * @returns {string}
 */
export function getApiBaseUrl() {
  let apiUrl = null;
  if (import.meta !== undefined) {
    apiUrl = import.meta.env?.VITE_API_URL;
  }

  return (apiUrl || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
}

/**
 * Обходить сцени і перетворює всі відносні URL у item-ах шарів на абсолютні.
 * Мутує переданий об'єкт (in-place).
 *
 * @param {Record<string, import('../features/vtt/types/vtt.types').Scene>} scenes
 * @returns {Record<string, import('../features/vtt/types/vtt.types').Scene>}
 */
export function resolveSceneUrls(scenes) {
  if (!scenes || typeof scenes !== 'object') return scenes;

  Object.values(scenes).forEach((scene) => {
    scene.layers?.forEach((layer) => {
      layer.items?.forEach((item) => {
        if (item.url) {
          item.url = resolveMediaUrl(item.url) ?? item.url;
        }
      });
    });
  });

  return scenes;
}
