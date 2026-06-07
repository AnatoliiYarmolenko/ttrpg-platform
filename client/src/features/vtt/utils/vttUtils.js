/**
 * @file vttUtils.js
 *
 * Утиліти для логіки VTT (Virtual Tabletop).
 * Чисті функції без залежностей від React або PixiJS.
 * Можуть використовуватись у компонентах, хуках та тестах.
 */

/**
 * snapToGrid — прив'язує world-координати до центру найближчої клітинки сітки.
 *
 * @param {number} worldX - Координата X у world-просторі
 * @param {number} worldY - Координата Y у world-просторі
 * @param {number} gridSize - Розмір клітинки у пікселях
 * @param {number | null} [mapWidth] - Ширина карти (для обмеження меж)
 * @param {number | null} [mapHeight] - Висота карти (для обмеження меж)
 * @returns {{ x: number, y: number }}
 *
 * @example
 * snapToGrid(75, 45, 64)
 * // → { x: 96, y: 32 }  (центр клітинки [1,0])
 */
export function snapToGrid(worldX, worldY, gridSize, mapWidth = null, mapHeight = null) {
  let col = Math.floor(worldX / gridSize);
  let row = Math.floor(worldY / gridSize);

  if (mapWidth != null && mapHeight != null) {
    const maxCol = Math.max(0, Math.floor(mapWidth / gridSize) - 1);
    const maxRow = Math.max(0, Math.floor(mapHeight / gridSize) - 1);
    col = Math.max(0, Math.min(maxCol, col));
    row = Math.max(0, Math.min(maxRow, row));
  }

  return {
    x: col * gridSize + gridSize / 2,
    y: row * gridSize + gridSize / 2,
  };
}

/**
 * worldToScreen — перетворює world-координати у screen-координати.
 *
 * @param {number} worldX
 * @param {number} worldY
 * @param {import('../types/vtt.types').Viewport} viewport
 * @returns {{ x: number, y: number }}
 */
export function worldToScreen(worldX, worldY, viewport) {
  return {
    x: worldX * viewport.scale + viewport.x,
    y: worldY * viewport.scale + viewport.y,
  };
}

/**
 * screenToWorld — перетворює screen-координати у world-координати.
 *
 * @param {number} screenX
 * @param {number} screenY
 * @param {import('../types/vtt.types').Viewport} viewport
 * @returns {{ x: number, y: number }}
 */
export function screenToWorld(screenX, screenY, viewport) {
  return {
    x: (screenX - viewport.x) / viewport.scale,
    y: (screenY - viewport.y) / viewport.scale,
  };
}

/**
 * clampViewport — обмежує viewport щоб карта залишалась у межах видимості.
 *
 * @param {import('../types/vtt.types').Viewport} viewport
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @param {number} screenWidth
 * @param {number} screenHeight
 * @returns {import('../types/vtt.types').Viewport}
 */
export function clampViewport(viewport, mapWidth, mapHeight, screenWidth, screenHeight) {
  const { scale } = viewport;
  const scaledMapW = mapWidth * scale;
  const scaledMapH = mapHeight * scale;

  const minX = Math.min(0, screenWidth - scaledMapW);
  const minY = Math.min(0, screenHeight - scaledMapH);

  return {
    x: Math.max(minX, Math.min(0, viewport.x)),
    y: Math.max(minY, Math.min(0, viewport.y)),
    scale,
  };
}
