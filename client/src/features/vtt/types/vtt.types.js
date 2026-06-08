/**
 * @file vtt.types.js
 *
 * JSDoc @typedef для всіх структур VTT (Virtual Tabletop).
 * Імпортуй типи у своїх файлах через:
 *
 * @example
 * // @import { Scene, Layer, Viewport } from '@/features/vtt/types/vtt.types'
 */

/**
 * Тип шару (layer).
 * @typedef {'BACKGROUND' | 'TOKEN' | 'DRAWING' | 'GENERIC'} LayerType
 */

/**
 * Елемент всередині шару (item).
 * @typedef {Object} LayerItem
 * @property {string} id - Унікальний ідентифікатор
 * @property {'IMAGE' | 'TOKEN' | 'DRAWING'} type - Тип елемента
 * @property {string} [url] - URL ресурсу (для IMAGE)
 * @property {number} [x] - Позиція X у world-координатах
 * @property {number} [y] - Позиція Y у world-координатах
 * @property {number} [width] - Ширина
 * @property {number} [height] - Висота
 */

/**
 * Шар сцени.
 * @typedef {Object} Layer
 * @property {string} id - Унікальний ідентифікатор
 * @property {string} name - Назва шару
 * @property {LayerType} type - Тип шару
 * @property {boolean} isVisible - Чи видимий шар
 * @property {boolean} isLocked - Чи заблокований (не можна змінювати)
 * @property {number} opacity - Прозорість (0–1)
 * @property {LayerItem[]} items - Елементи всередині шару
 */

/**
 * Сцена ігрового поля.
 * @typedef {Object} Scene
 * @property {string} id - Унікальний ідентифікатор
 * @property {string} name - Назва сцени
 * @property {number} width - Ширина у пікселях
 * @property {number} height - Висота у пікселях
 * @property {number} gridSize - Розмір однієї клітинки сітки у пікселях
 * @property {number} backgroundColor - Колір фону (hex number, напр. 0x243530)
 * @property {Layer[]} layers - Шари (знизу вгору)
 */

/**
 * Стан VTT кімнати (in-memory на сервері).
 * @typedef {Object} VttRoomState
 * @property {boolean} isOpen - Чи відкритий ігровий стіл
 * @property {Date | null} openedAt - Коли було відкрито
 * @property {string | null} openedBy - ID користувача що відкрив
 * @property {string | null} activeSceneId - ID сцени яку бачать гравці
 * @property {Record<string, Scene>} scenes - Словник всіх сцен
 */

/**
 * Стан viewport (камера).
 * @typedef {Object} Viewport
 * @property {number} x - Зсув по X (в пікселях екрана)
 * @property {number} y - Зсув по Y (в пікселях екрана)
 * @property {number} scale - Масштаб (1 = 100%, 0.5 = 50%, 2 = 200%)
 */

/**
 * Токен на ігровому полі (legacy).
 * @typedef {Object} Token
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} [color] - Hex color number
 */

/**
 * Стан battlefield store.
 * @typedef {Object} BattlefieldState
 * @property {number} gridSize
 * @property {string | null} activeSceneId
 * @property {string | null} gmViewSceneId
 * @property {Record<string, Scene>} scenes
 * @property {Token[]} tokens
 * @property {string | null} backgroundUrl
 * @property {number} mapWidth
 * @property {number} mapHeight
 */

/**
 * Параметри для функції setVttState.
 * @typedef {Object} VttStateUpdate
 * @property {string | null} [activeSceneId]
 * @property {Record<string, Scene>} [scenes]
 * @property {string | null} [backgroundUrl]
 * @property {number} [mapWidth]
 * @property {number} [mapHeight]
 */

// Цей файл є тільки типами — жодного runtime коду.
export {};
