import { create } from 'zustand';

/**
 * findNewSceneId — знаходить ID нової сцени яку додали до словника.
 *
 * Порівнює два словники сцен і повертає ID першої нової сцени.
 * Виділена як утиліта для тестування та перевикористання.
 *
 * @param {Record<string, unknown>} prevScenes
 * @param {Record<string, unknown>} nextScenes
 * @returns {string | null}
 */
export function findNewSceneId(prevScenes, nextScenes) {
  const prevKeys = Object.keys(prevScenes || {});
  const nextKeys = Object.keys(nextScenes || {});

  if (nextKeys.length <= prevKeys.length) return null;

  return nextKeys.find((id) => !prevKeys.includes(id)) ?? null;
}

/**
 * useBattlefieldStore — стан ігрового поля.
 *
 * Зберігає:
 * - `activeSceneId` — сцена яку бачать гравці (встановлює GM)
 * - `gmViewSceneId` — сцена яку зараз переглядає GM локально
 * - `scenes` — словник усіх сцен поточної сесії
 * - `tokens` — legacy токени (планується перенести у scene.layers)
 *
 * @type {import('zustand').UseBoundStore<import('zustand').StoreApi<import('../types/vtt.types').BattlefieldState & {
 *   setVttState: (state: import('../types/vtt.types').VttStateUpdate) => void,
 *   setGmViewSceneId: (sceneId: string) => void,
 *   setBackgroundUrl: (url: string, width?: number, height?: number) => void,
 *   moveToken: (tokenId: string, x: number, y: number) => void,
 *   addToken: (token: import('../types/vtt.types').Token) => void,
 *   removeToken: (tokenId: string) => void,
 *   setGridSize: (size: number) => void,
 * }>>}
 */
const useBattlefieldStore = create((set) => ({
  gridSize: 64,

  activeSceneId: null,
  gmViewSceneId: null,

  /** @type {Record<string, import('../types/vtt.types').Scene>} */
  scenes: {},

  // Legacy поля — будуть поступово замінені сценами
  /** @type {import('../types/vtt.types').Token[]} */
  tokens: [],
  backgroundUrl: null,
  mapWidth: 2048,
  mapHeight: 2048,

  /**
   * Оновити стан VTT з сервера (при отриманні vtt:state або vtt:opened).
   *
   * Логіка:
   * 1. Визначаємо яку сцену показувати GM (gmViewSceneId)
   * 2. Якщо з'явилася нова сцена — автоматично перемикаємося на неї
   * 3. Merge сцен замість повної заміни (безпечніше)
   *
   * @param {import('../types/vtt.types').VttStateUpdate} state
   */
  setVttState: (state) => set((prev) => {
    let gmViewSceneId = prev.gmViewSceneId;
    const activeSceneId = state.activeSceneId ?? null;

    // Якщо поточна перегляд-сцена GM більше не існує — перемикаємося
    if (gmViewSceneId && state.scenes && !state.scenes[gmViewSceneId]) {
      gmViewSceneId = activeSceneId;
    }

    // Якщо GM ще не вибрав сцену — ставимо активну
    if (!gmViewSceneId && activeSceneId) {
      gmViewSceneId = activeSceneId;
    }

    // Автоматично перемикаємося на нову сцену якщо вона щойно з'явилась
    if (state.scenes && prev.scenes) {
      const newId = findNewSceneId(prev.scenes, state.scenes);
      if (newId) {
        gmViewSceneId = newId;
      }
    }

    return {
      activeSceneId,
      // Замінюємо сцени повністю, щоб видалені на сервері сцени зникали і на клієнті
      scenes: state.scenes || prev.scenes,
      gmViewSceneId,
      // Legacy: використовуємо ??, щоб 0 не вважався falsy
      backgroundUrl: state.backgroundUrl ?? prev.backgroundUrl,
      mapWidth: state.mapWidth ?? prev.mapWidth,
      mapHeight: state.mapHeight ?? prev.mapHeight,
    };
  }),

  /**
   * Оновлює локальний стан об'єкта (малюнка або зображення) для плавного перетягування (preview).
   * Не замінює vttState.
   * @param {string} sceneId
   * @param {string} itemId
   * @param {Object} updates
   */
  previewSceneItem: (sceneId, itemId, updates) => set((state) => {
    if (!state.scenes?.[sceneId]) return state;
    const scene = state.scenes[sceneId];
    if (!scene.layers) return state;

    let layerIndex = -1;
    let itemIndex = -1;

    for (let i = 0; i < scene.layers.length; i++) {
      const items = scene.layers[i].items;
      if (items) {
        itemIndex = items.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
          layerIndex = i;
          break;
        }
      }
    }

    if (layerIndex === -1) return state;

    const layer = scene.layers[layerIndex];
    const item = layer.items[itemIndex];

    const newLayers = [...scene.layers];
    newLayers[layerIndex] = {
      ...layer,
      items: [
        ...layer.items.slice(0, itemIndex),
        { ...item, ...updates },
        ...layer.items.slice(itemIndex + 1)
      ]
    };
    
    return {
      scenes: {
        ...state.scenes,
        [sceneId]: {
          ...scene,
          layers: newLayers
        }
      }
    };
  }),

  /**
   * Змінити сцену яку GM зараз переглядає локально.
   * @param {string} sceneId
   */
  setGmViewSceneId: (sceneId) => set({ gmViewSceneId: sceneId }),

  /**
   * Legacy: Встановити фонове зображення та розміри поля.
   * @param {string} url
   * @param {number} [width]
   * @param {number} [height]
   */
  setBackgroundUrl: (url, width = 2048, height = 2048) =>
    set({ backgroundUrl: url, mapWidth: width, mapHeight: height }),

  /**
   * Перемістити legacy-токен на нову позицію.
   * @param {string} tokenId
   * @param {number} x
   * @param {number} y
   */
  moveToken: (tokenId, x, y) =>
    set((state) => ({
      tokens: state.tokens.map((t) =>
        t.id === tokenId ? { ...t, x, y } : t
      ),
    })),

  /**
   * Додати новий legacy-токен.
   * @param {import('../types/vtt.types').Token} token
   */
  addToken: (token) =>
    set((state) => ({
      tokens: [...state.tokens, token],
    })),

  /**
   * Видалити legacy-токен.
   * @param {string} tokenId
   */
  removeToken: (tokenId) =>
    set((state) => ({
      tokens: state.tokens.filter((t) => t.id !== tokenId),
    })),

  /** Виділене зображення-оверлей (тільки для локального UI, не синхронізується з сервером) */
  selectedImageId: null,
  setSelectedImageId: (id) => set({ selectedImageId: id }),

  selectedDrawingId: null,
  setSelectedDrawingId: (id) => set({ selectedDrawingId: id }),

  /**
   * Змінити розмір клітинки сітки.
   * @param {number} size
   */
  setGridSize: (size) => set({ gridSize: size }),

  // ─── Drawing State ────────────────────────────────────────────────────────

  /** 
   * Поточний інструмент малювання. 
   * null = вимкнено (режим виділення/переміщення)
   * 'pencil' | 'line' | 'rect' | 'circle' | 'polygon' | 'arrow' | 'text' | 'eraser'
   */
  drawingTool: null,
  setDrawingTool: (tool) => set({ drawingTool: tool }),

  drawingColor: '#ffffff',
  setDrawingColor: (color) => set({ drawingColor: color }),

  drawingThickness: 4,
  setDrawingThickness: (thickness) => set({ drawingThickness: thickness }),

  /**
   * Словник поточних малюнків, що зараз малюються іншими гравцями (live preview).
   * Key: userId, Value: { type, points, color, thickness }
   */
  drawPreviews: {},
  setDrawPreview: (userId, previewData) => set((state) => ({
    drawPreviews: {
      ...state.drawPreviews,
      [userId]: previewData
    }
  })),
  removeDrawPreview: (userId) => set((state) => {
    const newPreviews = { ...state.drawPreviews };
    delete newPreviews[userId];
    return { drawPreviews: newPreviews };
  }),
  clearAllPreviews: () => set({ drawPreviews: {} }),

  textPrompt: null,
  setTextPrompt: (data) => set({ textPrompt: data }),

  clearPromptVisible: false,
  setClearPromptVisible: (visible) => set({ clearPromptVisible: visible }),

  // ─── Ruler State ────────────────────────────────────────────────────────
  rulerTool: null, // 'line' | 'cone' | 'circle' | 'rectangle' | null
  rulerConfig: { coneAngle: 60, distance: 15, radius: 20, width: 20, height: 20 },
  localRuler: null, // ruler shape object with coordinates
  remoteRulers: {}, // map of user IDs to ruler shape objects

  setRulerTool: (tool) => set({ rulerTool: tool }),
  setRulerConfig: (config) => set((state) => ({ rulerConfig: { ...state.rulerConfig, ...config } })),
  setLocalRuler: (ruler) => set({ localRuler: ruler }),
  setRemoteRuler: (userId, ruler) => set((state) => {
    if (!ruler) {
      const next = { ...state.remoteRulers };
      delete next[userId];
      return { remoteRulers: next };
    }
    return { remoteRulers: { ...state.remoteRulers, [userId]: ruler } };
  }),
  clearAllRemoteRulers: () => set({ remoteRulers: {} }),
}));

export default useBattlefieldStore;
