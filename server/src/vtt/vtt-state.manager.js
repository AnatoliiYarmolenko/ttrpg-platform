const { logger } = require('../lib/logger');
const crypto = require('node:crypto');

/**
 * @typedef {import('./vtt.types').VttRoomState} VttRoomState
 * @typedef {import('./vtt.types').Scene} Scene
 * @typedef {import('./vtt.types').Layer} Layer
 * @typedef {import('./vtt.types').LayerItem} LayerItem
 */

/**
 * Дозволені поля для оновлення сцени через updateScene().
 * Клієнт не може перезаписати id, layers або type напряму.
 */
const ALLOWED_SCENE_UPDATE_FIELDS = new Set(['name', 'width', 'height', 'gridSize', 'backgroundColor', 'gridEnabled', 'gridType', 'gridColor', 'gridOpacity', 'gridScale']);

/**
 * Дозволені поля для оновлення шару через updateLayer().
 */
const ALLOWED_LAYER_UPDATE_FIELDS = new Set(['name', 'isVisible', 'isLocked', 'opacity']);

/**
 * Дозволені поля для оновлення зображення-оверлея через updateSceneImage().
 */
const ALLOWED_IMAGE_UPDATE_FIELDS = new Set(['x', 'y', 'scaleX', 'scaleY', 'rotation', 'layerId']);

/**
 * filterUpdates — whitelist фільтр оновлень.
 *
 * Запобігає перезапису критичних полів (id, type тощо) через клієнт.
 *
 * @param {Record<string, unknown>} updates
 * @param {Set<string>} allowedFields
 * @returns {Record<string, unknown>}
 */
function filterUpdates(updates, allowedFields) {
  if (!updates || typeof updates !== 'object') return {};
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedFields.has(key))
  );
}

/**
 * VttStateManager — in-memory менеджер стану Virtual Tabletop.
 *
 * Підтримує множинні сцени на сесію. Кожна сцена має шари (layers).
 * УВАГА: Стан зберігається в пам'яті — втрачається при перезапуску сервера.
 */
class VttStateManager {
  constructor() {
    /** @type {Map<string, VttRoomState>} */
    this.rooms = new Map();
  }

  /** @returns {string} */
  _generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
  }

  /**
   * Повертає кімнату, створюючи її якщо не існує.
   *
   * @param {string | number} sessionId
   * @returns {VttRoomState}
   */
  _ensureRoom(sessionId) {
    const id = String(sessionId);
    if (!this.rooms.has(id)) {
      this.rooms.set(id, {
        isOpen: false,
        openedAt: null,
        openedBy: null,
        activeSceneId: null,
        scenes: {},
        diceLog: [],
      });
    }
    return this.rooms.get(id);
  }

  /**
   * Повертає сцену або кидає помилку якщо не знайдена.
   *
   * @param {VttRoomState} room
   * @param {string} sceneId
   * @returns {Scene}
   */
  _getScene(room, sceneId) {
    const scene = room.scenes[sceneId];
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);
    return scene;
  }

  /**
   * Повертає шар або кидає помилку якщо не знайдений.
   *
   * @param {Scene} scene
   * @param {string} layerId
   * @returns {{ layer: Layer, index: number }}
   */
  _getLayer(scene, layerId) {
    const index = scene.layers.findIndex((l) => l.id === layerId);
    if (index === -1) throw new Error(`Layer not found: ${layerId}`);
    return { layer: scene.layers[index], index };
  }

  // ─── VTT Lifecycle ────────────────────────────────────────────────────────

  /**
   * Відкрити VTT для сесії. Створює дефолтну сцену якщо ще немає жодної.
   *
   * @param {string | number} sessionId
   * @param {string | number} openedBy - ID користувача
   */
  openVtt(sessionId, openedBy) {
    const room = this._ensureRoom(sessionId);
    room.isOpen = true;
    room.openedAt = new Date();
    room.openedBy = openedBy ? String(openedBy) : null;

    if (Object.keys(room.scenes).length === 0) {
      this.createScene(sessionId, { name: 'Default Scene', width: 2048, height: 2048 });
    }

    logger.info({ sessionId, openedBy }, 'VTT opened');
  }

  /**
   * Закрити VTT — зберігаємо стан але позначаємо як закритий.
   * (НЕ видаляємо сцени — вони можуть знадобитися при повторному відкритті)
   *
   * @param {string | number} sessionId
   */
  closeVtt(sessionId) {
    const id = String(sessionId);
    const room = this.rooms.get(id);
    if (room) {
      room.isOpen = false;
      logger.info({ sessionId: id }, 'VTT closed');
    }
  }

  /**
   * @param {string | number} sessionId
   * @returns {boolean}
   */
  isVttOpen(sessionId) {
    return Boolean(this.rooms.get(String(sessionId))?.isOpen);
  }

  /**
   * @param {string | number} sessionId
   * @returns {VttRoomState}
   */
  getVttState(sessionId) {
    const room = this.rooms.get(String(sessionId));
    if (!room) {
      return { isOpen: false, openedAt: null, openedBy: null, activeSceneId: null, scenes: {}, diceLog: [] };
    }
    // Повертаємо shallow copy щоб уникнути зовнішніх мутацій
    return { ...room };
  }

  // ─── Dice Log ─────────────────────────────────────────────────────────────

  addDiceRoll(sessionId, rollResult) {
    const room = this._ensureRoom(sessionId);
    
    const entry = {
      id: rollResult.id || `roll-${this._generateId()}`,
      timestamp: rollResult.timestamp || Date.now(),
      ...rollResult
    };

    // Add to beginning of array
    room.diceLog.unshift(entry);

    // Limit to 50 rolls to prevent memory leaks
    if (room.diceLog.length > 50) {
      room.diceLog = room.diceLog.slice(0, 50);
    }

    return entry;
  }

  getDiceLog(sessionId) {
    const room = this.rooms.get(String(sessionId));
    return room ? [...room.diceLog] : [];
  }
  
  clearDiceLog(sessionId) {
    const room = this.rooms.get(String(sessionId));
    if (room) {
      room.diceLog = [];
    }
  }

  // ─── Scene Management ─────────────────────────────────────────────────────

  /**
   * Створити нову сцену у сесії.
   *
   * @param {string | number} sessionId
   * @param {string} name
   * @param {number} width
   * @param {number} height
   * @param {string | null} [backgroundUrl]
   * @param {string | number | null} [backgroundColor] - Колір фону: hex-рядок (#3d5a3e) або число (0x3d5a3e)
   * @param {boolean} [gridEnabled] - Чи увімкнена сітка
   * @param {string} [gridType] - Тип сітки: 'SQUARE' або 'HEXAGONAL'
   * @param {string | number | null} [gridColor] - Колір сітки: hex-рядок або число
   * @returns {Scene}
   */
  createScene(sessionId, data) {
    logger.info({ data }, '>>> createScene data');
    const { name, width, height, backgroundUrl = null, backgroundColor = null, gridEnabled = true, gridType = 'SQUARE', gridColor = null, gridSize = 64, gridOpacity = 0.4, gridScale = 5 } = data || {};
    const room = this._ensureRoom(sessionId);
    const sceneId = `scene-${this._generateId()}`;

    // Конвертуємо backgroundColor: рядок '#rrggbb' → число 0xrrggbb
    let bgColor = 0x9dc88d; // default green
    if (backgroundColor != null) {
      if (typeof backgroundColor === 'string' && backgroundColor.startsWith('#')) {
        bgColor = Number.parseInt(backgroundColor.slice(1), 16);
      } else if (typeof backgroundColor === 'number') {
        bgColor = backgroundColor;
      }
    }

    // Конвертуємо gridColor: рядок '#rrggbb' → число 0xrrggbb
    let gColor = 0x9dc88d; // default light green
    if (gridColor != null) {
      if (typeof gridColor === 'string' && gridColor.startsWith('#')) {
        gColor = Number.parseInt(gridColor.slice(1), 16);
      } else if (typeof gridColor === 'number') {
        gColor = gridColor;
      }
    }

    /** @type {Scene} */
    const scene = {
      id: sceneId,
      name: name || 'New Scene',
      width: width || 2048,
      height: height || 2048,
      gridSize: gridSize || 64,
      backgroundColor: bgColor,
      gridEnabled: gridEnabled !== false,
      gridType: gridType === 'HEXAGONAL' ? 'HEXAGONAL' : 'SQUARE',
      gridColor: gColor,
      gridOpacity: gridOpacity ?? 0.4,
      gridScale: gridScale ?? 5,
      layers: [
        {
          id: `layer-${this._generateId()}`,
          name: 'Background',
          type: 'BACKGROUND',
          isVisible: true,
          isLocked: true,
          opacity: 1,
          items: backgroundUrl
            ? [{ id: `item-${this._generateId()}`, type: 'IMAGE', url: backgroundUrl, x: 0, y: 0 }]
            : [],
        },
        {
          id: `layer-${this._generateId()}`,
          name: 'Сітка',
          type: 'GRID',
          isVisible: true,
          isLocked: false,
          opacity: 1,
          items: []
        },
        {
          id: `layer-${this._generateId()}`,
          name: 'Tokens',
          type: 'TOKEN',
          isVisible: true,
          isLocked: false,
          opacity: 1,
          items: [],
        },
      ],
    };

    room.scenes[sceneId] = scene;

    if (!room.activeSceneId) {
      room.activeSceneId = sceneId;
    }

    logger.info({ sessionId, sceneId, name }, 'Scene created');
    return scene;
  }

  /**
   * Оновити параметри сцени.
   * Тільки дозволені поля (whitelist).
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {Record<string, unknown>} updates
   * @returns {Scene | null}
   */
  updateScene(sessionId, sceneId, updates) {
    const room = this._ensureRoom(sessionId);
    if (!room.scenes[sceneId]) return null;

    const safeUpdates = filterUpdates(updates, ALLOWED_SCENE_UPDATE_FIELDS);
    logger.info({ safeUpdates }, '>>> updateScene safeUpdates');
    room.scenes[sceneId] = { ...room.scenes[sceneId], ...safeUpdates };
    return room.scenes[sceneId];
  }

  /**
   * Видалити сцену. Якщо це була активна — автоматично обирає іншу.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @returns {boolean}
   */
  deleteScene(sessionId, sceneId) {
    const room = this._ensureRoom(sessionId);
    if (!room.scenes[sceneId]) return false;

    delete room.scenes[sceneId];

    if (room.activeSceneId === sceneId) {
      const remaining = Object.keys(room.scenes);
      room.activeSceneId = remaining.length > 0 ? remaining[0] : null;
    }

    logger.info({ sessionId, sceneId }, 'Scene deleted');
    return true;
  }

  /**
   * Зробити сцену активною (гравці побачать її).
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @returns {boolean}
   */
  activateScene(sessionId, sceneId) {
    const room = this._ensureRoom(sessionId);
    if (!room.scenes[sceneId]) return false;
    room.activeSceneId = sceneId;
    logger.info({ sessionId, sceneId }, 'Scene activated');
    return true;
  }

  // ─── Layer Management ─────────────────────────────────────────────────────

  /**
   * Створити новий шар у сцені.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string} name
   * @param {string} [type]
   * @returns {Layer | null}
   */
  createLayer(sessionId, sceneId, name, type) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return null;

    /** @type {Layer} */
    const layer = {
      id: `layer-${this._generateId()}`,
      name: name || 'New layer',
      type: type || 'GENERIC',
      isVisible: true,
      isLocked: false,
      opacity: 1,
      items: [],
    };

    scene.layers.unshift(layer);
    return layer;
  }

  /**
   * Оновити параметри шару.
   * Тільки дозволені поля (whitelist).
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string} layerId
   * @param {Record<string, unknown>} updates
   * @returns {Layer | null}
   */
  updateLayer(sessionId, sceneId, layerId, updates) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return null;

    const { index } = this._getLayer(scene, layerId);
    const safeUpdates = filterUpdates(updates, ALLOWED_LAYER_UPDATE_FIELDS);
    
    // Create a new array to ensure reference checks detect the change
    scene.layers = [...scene.layers];
    scene.layers[index] = { ...scene.layers[index], ...safeUpdates };

    return scene.layers[index];
  }

  /**
   * Змінити порядок шарів у сцені.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string[]} layerIds - Новий порядок ID шарів
   * @returns {boolean}
   */
  reorderLayers(sessionId, sceneId, layerIds) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene || !Array.isArray(layerIds)) return false;

    const layerMap = new Map(scene.layers.map((l) => [l.id, l]));

    const ordered = layerIds
      .filter((id) => layerMap.has(id))
      .map((id) => {
        const l = layerMap.get(id);
        layerMap.delete(id);
        return l;
      });

    // Залишаємо шари яких не було в layerIds (на випадок розбіжностей)
    scene.layers = [...ordered, ...layerMap.values()];
    return true;
  }

  /**
   * Видалити шар.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string} layerId
   * @returns {boolean}
   */
  deleteLayer(sessionId, sceneId, layerId) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return false;

    const before = scene.layers.length;
    scene.layers = scene.layers.filter((l) => l.id !== layerId);
    return scene.layers.length < before;
  }

  // ─── Scene Image Management ──────────────────────────────────────────────

  /**
   * Додати зображення-оверлей до сцени (у BACKGROUND шар).
   * НЕ змінює розміри сцени.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string} imageUrl
   * @param {number} width - Оригінальна ширина зображення
   * @param {number} height - Оригінальна висота зображення
   * @returns {LayerItem | null}
   */
  addImageToScene(sessionId, sceneId, imageUrl, width, height) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return null;

    const bgLayer = scene.layers.find((l) => l.type === 'BACKGROUND');
    if (!bgLayer) return null;

    const item = {
      id: `img-${this._generateId()}`,
      type: 'IMAGE',
      url: imageUrl,
      // Розміщуємо по центру сцени за замовчуванням
      x: scene.width / 2,
      y: scene.height / 2,
      width: width || 512,
      height: height || 512,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    };

    bgLayer.items.push(item);
    logger.info({ sessionId, sceneId, imageId: item.id }, 'Image added to scene');
    return item;
  }

  /**
   * Оновити позицію/масштаб зображення на сцені.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string} imageId
   * @param {Record<string, unknown>} updates
   * @returns {LayerItem | null}
   */
  updateSceneImage(sessionId, sceneId, imageId, updates) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return null;

    let currentLayer = null;
    let itemIndex = -1;

    for (const layer of scene.layers) {
      itemIndex = layer.items.findIndex((item) => item.id === imageId);
      if (itemIndex !== -1) {
        currentLayer = layer;
        break;
      }
    }

    if (!currentLayer) return null;

    const safeUpdates = filterUpdates(updates, ALLOWED_IMAGE_UPDATE_FIELDS);
    
    // Якщо змінюється шар
    if (safeUpdates.layerId && safeUpdates.layerId !== currentLayer.id) {
      const newLayer = scene.layers.find((l) => l.id === safeUpdates.layerId);
      if (newLayer) {
        // Забираємо з поточного
        const [item] = currentLayer.items.splice(itemIndex, 1);
        // Оновлюємо і додаємо в новий
        const updatedItem = { ...item, ...safeUpdates };
        delete updatedItem.layerId; // Не зберігаємо layerId в самому об'єкті
        newLayer.items.push(updatedItem);
        return updatedItem;
      }
    }

    delete safeUpdates.layerId;
    currentLayer.items[itemIndex] = { ...currentLayer.items[itemIndex], ...safeUpdates };
    return currentLayer.items[itemIndex];
  }

  /**
   * Видалити зображення зі сцени.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string} imageId
   * @returns {boolean}
   */
  removeSceneImage(sessionId, sceneId, imageId) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return false;

    let removed = false;
    for (const layer of scene.layers) {
      const before = layer.items.length;
      layer.items = layer.items.filter((item) => item.id !== imageId);
      if (layer.items.length < before) {
        removed = true;
        break;
      }
    }
    
    if (removed) {
      logger.info({ sessionId, sceneId, imageId }, 'Image removed from scene');
      return true;
    }
    return false;
  }

  // ─── Legacy Compatibility ─────────────────────────────────────────────────

  /**
   * Legacy: встановити фонове зображення для активної/нової сцени.
   *
   * @param {string | number} sessionId
   * @param {string} backgroundUrl
   * @param {number} [mapWidth]
   * @param {number} [mapHeight]
   */
  setBackground(sessionId, backgroundUrl, mapWidth, mapHeight) {
    const room = this._ensureRoom(sessionId);
    let sceneId = room.activeSceneId;

    if (!sceneId) {
      this.createScene(sessionId, { name: 'Imported Map', width: mapWidth, height: mapHeight, backgroundUrl });
      return;
    }

    const scene = room.scenes[sceneId];
    if (!scene) return;

    scene.width = mapWidth || scene.width;
    scene.height = mapHeight || scene.height;

    const bgLayer = scene.layers.find((l) => l.type === 'BACKGROUND');
    if (bgLayer) {
      bgLayer.items = [{
        id: `item-${this._generateId()}`,
        type: 'IMAGE',
        url: backgroundUrl,
        x: 0,
        y: 0,
      }];
    }
  }
  // ─── Drawing Management ───────────────────────────────────────────────────

  /**
   * Додати малюнок до шару DRAWING.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {Object} drawingData - { type, points, color, thickness, userId, ... }
   * @returns {LayerItem | null}
   */
  addDrawingToScene(sessionId, sceneId, drawingData) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return null;

    let drawLayer = scene.layers.find((l) => l.type === 'DRAWING');
    if (!drawLayer) {
      drawLayer = {
        id: `layer-${this._generateId()}`,
        name: 'Малюнки',
        type: 'DRAWING',
        isVisible: true,
        isLocked: false,
        opacity: 1,
        items: []
      };
      const gridIndex = scene.layers.findIndex(l => l.type === 'GRID');
      if (gridIndex === -1) {
        scene.layers.push(drawLayer);
      } else {
        scene.layers.splice(gridIndex + 1, 0, drawLayer);
      }
    }

    const item = {
      id: `draw-${this._generateId()}`,
      ...drawingData,
      timestamp: Date.now(),
    };

    drawLayer.items.push(item);
    return item;
  }

  /**
   * Відмінити останній малюнок конкретного користувача.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string} userId
   * @returns {string | null} ID видаленого малюнка
   */
  removeLastDrawing(sessionId, sceneId, userId) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return null;

    const drawLayer = scene.layers.find((l) => l.type === 'DRAWING');
    if (!drawLayer?.items?.length) return null;

    // Шукаємо останній малюнок цього користувача (з кінця масиву)
    for (let i = drawLayer.items.length - 1; i >= 0; i--) {
      const item = drawLayer.items[i];
      if (String(item.userId) === String(userId)) {
        drawLayer.items.splice(i, 1);
        return item.id;
      }
    }
    return null;
  }

  /**
   * Оновити параметри малюнка.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string} drawingId
   * @param {Record<string, unknown>} updates
   * @returns {object | null}
   */
  updateDrawing(sessionId, sceneId, drawingId, updates) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return null;

    for (const layer of scene.layers) {
      if (layer.items) {
        const itemIndex = layer.items.findIndex((item) => item.id === drawingId);
        if (itemIndex !== -1) {
          const safeUpdates = filterUpdates(updates, new Set(['x', 'y', 'width', 'height', 'scaleX', 'scaleY', 'rotation', 'points']));
          layer.items[itemIndex] = { ...layer.items[itemIndex], ...safeUpdates };
          return layer.items[itemIndex];
        }
      }
    }
    return null;
  }

  /**
   * Видалити конкретний малюнок.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @param {string} drawingId
   * @returns {boolean}
   */
  removeDrawingById(sessionId, sceneId, drawingId) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return false;

    let removed = false;
    for (const layer of scene.layers) {
      if (layer.items) {
        const itemIndex = layer.items.findIndex((item) => item.id === drawingId);
        if (itemIndex !== -1) {
          layer.items.splice(itemIndex, 1);
          removed = true;
          break;
        }
      }
    }
    return removed;
  }


  /**
   * Очистити всі малюнки.
   *
   * @param {string | number} sessionId
   * @param {string} sceneId
   * @returns {boolean}
   */
  clearDrawings(sessionId, sceneId) {
    const room = this._ensureRoom(sessionId);
    const scene = room.scenes[sceneId];
    if (!scene) return false;

    const drawLayer = scene.layers.find((l) => l.type === 'DRAWING');
    if (!drawLayer) return false;

    drawLayer.items = [];
    return true;
  }
}

const vttStateManager = new VttStateManager();

module.exports = {
  vttStateManager,
  VttStateManager,
  filterUpdates, // exported for testing
};
