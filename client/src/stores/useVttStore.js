import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * useVttStore — глобальний стан Ігрового столу (VTT).
 *
 * Зберігає чи VTT відкритий у поточній сесії.
 * Оновлюється через WS події 'vtt:opened' та 'vtt:state'.
 */
const useVttStore = create(
  persist(
    (set) => ({
      /** ID сесії, для якої відомий стан VTT */
      sessionId: null,
      /** Чи VTT відкрито GM */
      isVttOpen: false,

      // --- Dice Roller UI State ---
      /** Чи відкрита панель Roll Maker */
      isRollMakerOpen: false,
      /** Чи відкрита нижня панель QuickBar */
      isQuickBarOpen: true,
      /** Чи відкрита бокова панель (Sidebar) */
      isSidebarOpen: false,
      /** Чи відкритий плаваючий чат */
      isChatOpen: false,
      /** Чи відкритий плаваючий віджет дзвінка */
      isCallOpen: false,
      /** Чи відкритий журнал кидків */
      isDiceLogOpen: false,
      /** Чи відкритий менеджер сцен (карта, токени) */
      isSceneManagerOpen: false,

      /** Останні 8 результатів кидків */
      rollHistory: [],
      /** Останній кидок (для popup) */
      latestRoll: null,
      /** Кидок, що щойно надійшов (для тригеру 3D анімації) */
      incomingRoll: null,

      /** Збережені кидки (Quick Rolls) для кожної сесії. Формат: { [sessionId]: Array(8) } */
      quickRollsBySession: {},

      /** Сила кидка кубика (від 0.1 до 3.0), за замовчуванням 1 */
      rollStrength: 1,

      setVttOpen: (sessionId, isOpen) => set({ sessionId: String(sessionId), isVttOpen: Boolean(isOpen) }),
      setRollStrength: (strength) => set({ rollStrength: Number.parseFloat(strength) }),
      setRollMakerOpen: (isOpen) => set({ isRollMakerOpen: Boolean(isOpen) }),
      toggleRollMaker: () => set((state) => ({ isRollMakerOpen: !state.isRollMakerOpen })),
      toggleQuickBar: () => set((state) => ({ isQuickBarOpen: !state.isQuickBarOpen })),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
      toggleCall: () => set((state) => ({ isCallOpen: !state.isCallOpen })),
      toggleDiceLog: () => set((state) => ({ isDiceLogOpen: !state.isDiceLogOpen })),
      toggleSceneManager: () => set((state) => ({ isSceneManagerOpen: !state.isSceneManagerOpen })),

      /** Додати результат кидка (макс 8, старіші витісняються) */
      addRollResult: (result) => set((state) => {
        // Уникаємо дублювання (оскільки ми самі можемо отримати свій же кидок)
        if (state.rollHistory.some(r => r.id === result.id)) return state;
        const newHistory = [result, ...state.rollHistory].slice(0, 8);
        return { rollHistory: newHistory, latestRoll: result };
      }),
      /** Встановити подію вхідного кидка (для 3D) */
      setIncomingRoll: (roll) => set({ incomingRoll: roll }),
      /** Очистити подію вхідного кидка */
      clearIncomingRoll: () => set({ incomingRoll: null }),
      /** Прибрати popup останнього кидка */
      clearLatestRoll: () => set({ latestRoll: null }),
      /** Очистити журнал */
      clearRollHistory: () => set({ rollHistory: [], latestRoll: null, incomingRoll: null }),
      
      /** Зберегти кидок у певний слот (0-7) для поточної сесії */
      setQuickRoll: (index, rollData) => set((state) => {
        if (!state.sessionId) return state;
        const currentRolls = state.quickRollsBySession[state.sessionId] || new Array(8).fill(null);
        const newRolls = [...currentRolls];
        newRolls[index] = rollData; // { name: string, formula: string }
        return {
          quickRollsBySession: {
            ...state.quickRollsBySession,
            [state.sessionId]: newRolls,
          }
        };
      }),

      /** Очистити слот (0-7) для поточної сесії */
      clearQuickRoll: (index) => set((state) => {
        if (!state.sessionId) return state;
        const currentRolls = state.quickRollsBySession[state.sessionId] || new Array(8).fill(null);
        const newRolls = [...currentRolls];
        newRolls[index] = null;
        return {
          quickRollsBySession: {
            ...state.quickRollsBySession,
            [state.sessionId]: newRolls,
          }
        };
      }),

      reset: () => set({ sessionId: null, isVttOpen: false, isRollMakerOpen: false }),
    }),
    {
      name: 'vtt-storage',
      // Зберігаємо в localStorage також стан панелей та історію кидків
      partialize: (state) => ({ 
        quickRollsBySession: state.quickRollsBySession,
        isChatOpen: state.isChatOpen,
        isCallOpen: state.isCallOpen,
        isDiceLogOpen: state.isDiceLogOpen,
        isSceneManagerOpen: state.isSceneManagerOpen,
        rollHistory: state.rollHistory,
      }),
    }
  )
);

export default useVttStore;
