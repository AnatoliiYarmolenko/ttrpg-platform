import { useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getLocalDateKey, getMillisecondsUntilNextLocalDay } from '@/components/shared/dateTime.utils';
import useAuthStore from '@/stores/useAuthStore';
import useDashboardStore from '@/stores/useDashboardStore';
import {
  VIEW_MODES,
  DASHBOARD_URL_PARAMS,
  DASHBOARD_VIEW_VALUES,
} from '@/stores/dashboardConstants';
import { logoutUser } from '@/features/auth/api/authApi';
import { PROFILE_SECTIONS } from '../components/widgets/profileSections';
import logger from '@/lib/clientLogger';
import {
  parseEnumSearchParam,
  setOrDeleteParam,
  updateSearchParams,
} from '@/utils/urlState';

/**
 * useDashboardPageController — основна логіка DashboardPage.
 *
 * Інкапсулює:
 * - отримання user з useAuthStore
 * - viewMode / panel modes з useDashboardStore
 * - профільні секції
 * - logout
 *
 * @returns об'єкт із готовими пропсами для layout та віджетів
 */
export default function useDashboardPageController() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  const viewMode = useDashboardStore((state) => state.viewMode);
  const setStoreViewMode = useDashboardStore((state) => state.setViewMode);
  const rightPanelMode = useDashboardStore((state) => state.rightPanelMode);
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const currentMonth = useDashboardStore((state) => state.currentMonth);
  const selectDate = useDashboardStore((state) => state.selectDate);
  const setCurrentMonth = useDashboardStore((state) => state.setCurrentMonth);

  const profileSectionValues = useMemo(() => Object.values(PROFILE_SECTIONS), []);
  const urlViewMode = parseEnumSearchParam(
    searchParams,
    DASHBOARD_URL_PARAMS.TAB,
    DASHBOARD_VIEW_VALUES,
    VIEW_MODES.HOME
  );
  const requestedProfileSection = parseEnumSearchParam(
    searchParams,
    DASHBOARD_URL_PARAMS.SECTION,
    profileSectionValues,
    PROFILE_SECTIONS.INFO
  );
  const profileSection = urlViewMode === VIEW_MODES.PROFILE
    ? requestedProfileSection
    : PROFILE_SECTIONS.INFO;

  const setViewMode = useCallback(
    (nextMode) => {
      const normalizedMode = DASHBOARD_VIEW_VALUES.includes(nextMode) ? nextMode : VIEW_MODES.HOME;

      updateSearchParams(setSearchParams, (next) => {
        setOrDeleteParam(next, DASHBOARD_URL_PARAMS.TAB, normalizedMode, VIEW_MODES.HOME);
        if (normalizedMode !== VIEW_MODES.PROFILE) {
          next.delete(DASHBOARD_URL_PARAMS.SECTION);
        }
      });
    },
    [setSearchParams]
  );

  const setProfileSection = useCallback(
    (nextSection) => {
      const normalizedSection = profileSectionValues.includes(nextSection)
        ? nextSection
        : PROFILE_SECTIONS.INFO;

      updateSearchParams(setSearchParams, (next) => {
        setOrDeleteParam(next, DASHBOARD_URL_PARAMS.TAB, VIEW_MODES.PROFILE, VIEW_MODES.HOME);
        setOrDeleteParam(
          next,
          DASHBOARD_URL_PARAMS.SECTION,
          normalizedSection,
          PROFILE_SECTIONS.INFO
        );
      });
    },
    [profileSectionValues, setSearchParams]
  );

  // URL -> store sync (tab is source of truth for navigation)
  useEffect(() => {
    if (viewMode !== urlViewMode) {
      setStoreViewMode(urlViewMode);
    }
  }, [setStoreViewMode, urlViewMode, viewMode]);

  // store -> URL sync (handles legacy store-driven tab switches)
  // URL normalization for invalid/dependent values.
  useEffect(() => {
    const rawTab = searchParams.get(DASHBOARD_URL_PARAMS.TAB);
    const rawSection = searchParams.get(DASHBOARD_URL_PARAMS.SECTION);
    const hasInvalidTab = rawTab && rawTab !== urlViewMode;
    const hasInvalidSection = rawSection && rawSection !== requestedProfileSection;
    const hasSectionOutsideProfile = urlViewMode !== VIEW_MODES.PROFILE && rawSection;

    if (!hasInvalidTab && !hasInvalidSection && !hasSectionOutsideProfile) {
      return;
    }

    updateSearchParams(setSearchParams, (next) => {
      setOrDeleteParam(next, DASHBOARD_URL_PARAMS.TAB, urlViewMode, VIEW_MODES.HOME);
      if (urlViewMode === VIEW_MODES.PROFILE) {
        setOrDeleteParam(
          next,
          DASHBOARD_URL_PARAMS.SECTION,
          requestedProfileSection,
          PROFILE_SECTIONS.INFO
        );
      } else {
        next.delete(DASHBOARD_URL_PARAMS.SECTION);
      }
    }, { replace: true });
  }, [requestedProfileSection, searchParams, setSearchParams, urlViewMode]);

  useEffect(() => {
    const now = new Date();
    const currentTodayKey = getLocalDateKey(now);
    const timeoutId = globalThis.setTimeout(() => {
      const nextNow = new Date();
      const nextTodayKey = getLocalDateKey(nextNow);
      const shouldAdvanceSelectedDay =
        urlViewMode === VIEW_MODES.CALENDAR && selectedDate === currentTodayKey;
      const shouldAdvanceCurrentMonth =
        currentMonth instanceof Date
        && !Number.isNaN(currentMonth.getTime())
        && currentMonth.getFullYear() === now.getFullYear()
        && currentMonth.getMonth() === now.getMonth();

      if (shouldAdvanceCurrentMonth) {
        setCurrentMonth(nextNow);
      }

      if (shouldAdvanceSelectedDay && nextTodayKey) {
        selectDate(nextTodayKey);
      }
    }, getMillisecondsUntilNextLocalDay(now));

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [currentMonth, selectDate, selectedDate, setCurrentMonth, urlViewMode]);

  const handleProfileUpdate = useCallback(
    (updatedData) => {
      updateUser(updatedData);
    },
    [updateUser]
  );

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      logger.error('Logout error', error);
    } finally {
      clearUser();
      navigate('/login');
    }
  }, [clearUser, navigate]);

  return {
    // Дані
    user,

    // Стан
    viewMode: urlViewMode,
    setViewMode,
    rightPanelMode,
    profileSection,
    setProfileSection,

    // Дії
    handleProfileUpdate,
    handleLogout,

    // Навігація
    navigate,
  };
}
