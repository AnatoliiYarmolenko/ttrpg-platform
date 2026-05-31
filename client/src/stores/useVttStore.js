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
      /** Чи відкритий журнал кидків */
      isDiceLogOpen: false,

      /** Останні 8 результатів кидків */
      rollHistory: [],
      /** Останній кидок (для popup) */
      latestRoll: null,

      /** Збережені кидки (Quick Rolls) для кожної сесії. Формат: { [sessionId]: Array(8) } */
      quickRollsBySession: {},

      setVttOpen: (sessionId, isOpen) => set({ sessionId: String(sessionId), isVttOpen: Boolean(isOpen) }),
      setRollMakerOpen: (isOpen) => set({ isRollMakerOpen: Boolean(isOpen) }),
      toggleRollMaker: () => set((state) => ({ isRollMakerOpen: !state.isRollMakerOpen })),
      toggleQuickBar: () => set((state) => ({ isQuickBarOpen: !state.isQuickBarOpen })),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
      toggleDiceLog: () => set((state) => ({ isDiceLogOpen: !state.isDiceLogOpen })),

      /** Додати результат кидка (макс 8, старіші витісняються) */
      addRollResult: (result) => set((state) => {
        const newHistory = [result, ...state.rollHistory].slice(0, 8);
        return { rollHistory: newHistory, latestRoll: result };
      }),
      /** Прибрати popup останнього кидка */
      clearLatestRoll: () => set({ latestRoll: null }),
      /** Очистити журнал */
      clearRollHistory: () => set({ rollHistory: [], latestRoll: null }),
      
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

      /** Стан вікна чату (x, y, w, h, isLocked) */
      floatingChatState: null,
      /** Стан вікна журналу кидків (x, y, w, h, isLocked) */
      diceLogState: null,

      setFloatingChatState: (newState) => set({ floatingChatState: newState }),
      setDiceLogState: (newState) => set({ diceLogState: newState }),

      reset: () => set({ sessionId: null, isVttOpen: false, isRollMakerOpen: false }),
    }),
    {
      name: 'vtt-storage',
      // Зберігаємо в localStorage також стан панелей та історію кидків
      partialize: (state) => ({ 
        quickRollsBySession: state.quickRollsBySession,
        isChatOpen: state.isChatOpen,
        isDiceLogOpen: state.isDiceLogOpen,
        floatingChatState: state.floatingChatState,
        diceLogState: state.diceLogState,
        rollHistory: state.rollHistory,
      }),
    }
  )
);

export default useVttStore;
