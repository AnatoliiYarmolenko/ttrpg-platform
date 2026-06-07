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

  /**
   * Змінити розмір клітинки сітки.
   * @param {number} size
   */
  setGridSize: (size) => set({ gridSize: size }),
}));

export default useBattlefieldStore;
