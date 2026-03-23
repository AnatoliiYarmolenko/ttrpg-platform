import { create } from 'zustand';
import useSearchStore from './useSearchStore';
import {
  DASHBOARD_VIEWS,
  VIEW_MODES,
  PANEL_MODES,
} from './dashboardConstants';

const todayStr = new Date().toISOString().split('T')[0];

const useDashboardStore = create((set, get) => ({
  selectedDate: todayStr,
  viewMode: VIEW_MODES.HOME,
  rightPanelMode: PANEL_MODES.LIST,
  currentMonth: new Date(),
  expandedSessionId: null,
  error: null,

  setViewMode: (mode) => {
    const defaultPanelModes = {
      [VIEW_MODES.HOME]: PANEL_MODES.LIST,
      [VIEW_MODES.MY_GAMES]: PANEL_MODES.CAMPAIGNS,
      [VIEW_MODES.PROFILE]: PANEL_MODES.LIST,
      [VIEW_MODES.SEARCH]: PANEL_MODES.FILTER,
    };
    const initialDate = mode === VIEW_MODES.HOME ? todayStr : null;

    set({
      viewMode: mode,
      rightPanelMode: defaultPanelModes[mode] || PANEL_MODES.LIST,
      selectedDate: initialDate,
      expandedSessionId: null,
    });

    useSearchStore.getState().setHasSearched(false);
  },

  setRightPanelMode: (mode) => {
    set({ rightPanelMode: mode });
  },

  selectDate: (date) => {
    const { viewMode } = get();

    set({
      selectedDate: date,
      expandedSessionId: null,
    });

    if (viewMode === VIEW_MODES.HOME) {
      set({ rightPanelMode: PANEL_MODES.LIST });
    } else if (viewMode === VIEW_MODES.MY_GAMES) {
      set({ rightPanelMode: PANEL_MODES.USER_SESSIONS });
    } else if (viewMode === VIEW_MODES.SEARCH) {
      set({ rightPanelMode: PANEL_MODES.RESULTS });
    }
  },

  clearSelectedDate: () => {
    const { viewMode } = get();

    const defaultPanelModes = {
      [VIEW_MODES.HOME]: PANEL_MODES.LIST,
      [VIEW_MODES.MY_GAMES]: PANEL_MODES.CAMPAIGNS,
      [VIEW_MODES.SEARCH]: PANEL_MODES.FILTER,
    };

    set({
      selectedDate: null,
      rightPanelMode: defaultPanelModes[viewMode],
      expandedSessionId: null,
    });
  },

  setCurrentMonth: (date) => {
    set({ currentMonth: date });
  },

  goToNextMonth: () => {
    const { currentMonth } = get();
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    set({ currentMonth: nextMonth });
  },

  goToPrevMonth: () => {
    const { currentMonth } = get();
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    set({ currentMonth: prevMonth });
  },

  goToToday: () => {
    const today = new Date();
    set({ currentMonth: today });

    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    get().selectDate(dateStr);
  },

  toggleSessionExpanded: (sessionId) => {
    const { expandedSessionId } = get();
    set({
      expandedSessionId: expandedSessionId === sessionId ? null : sessionId,
    });
  },

  clearError: () => set({ error: null }),

  reset: () => {
    set({
      viewMode: VIEW_MODES.HOME,
      rightPanelMode: PANEL_MODES.LIST,
      selectedDate: todayStr,
      currentMonth: new Date(),
      expandedSessionId: null,
      error: null,
    });

    useSearchStore.getState().reset();
  },
}));

export { DASHBOARD_VIEWS, VIEW_MODES, PANEL_MODES };
export default useDashboardStore;