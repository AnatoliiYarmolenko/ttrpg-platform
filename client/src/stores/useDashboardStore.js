import { create } from 'zustand';
import { getLocalDateKey } from '@/components/shared/dateTime.utils';
import useSearchStore from './useSearchStore';
import {
  DASHBOARD_VIEWS,
  VIEW_MODES,
  PANEL_MODES,
} from './dashboardConstants';

// Helper to get today's date string (computed dynamically)
const getTodayStr = () => getLocalDateKey(new Date());

const useDashboardStore = create((set, get) => ({
  selectedDate: getTodayStr(),
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
    const initialDate = mode === VIEW_MODES.HOME ? getTodayStr() : null;

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

    get().selectDate(getTodayStr());
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
      selectedDate: getTodayStr(),
      currentMonth: new Date(),
      expandedSessionId: null,
      error: null,
    });

    useSearchStore.getState().reset();
  },
}));

export { DASHBOARD_VIEWS, VIEW_MODES, PANEL_MODES };
export default useDashboardStore;
