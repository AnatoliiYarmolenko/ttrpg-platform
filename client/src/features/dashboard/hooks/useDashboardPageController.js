import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocalDateKey, getMillisecondsUntilNextLocalDay } from '@/components/shared/dateTime.utils';
import useAuthStore from '@/stores/useAuthStore';
import useDashboardStore from '@/stores/useDashboardStore';
import { VIEW_MODES } from '@/stores/dashboardConstants';
import { logoutUser } from '@/features/auth/api/authApi';
import { PROFILE_SECTIONS } from '../components/widgets/profileSections';
import logger from '@/lib/clientLogger';

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

  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  const viewMode = useDashboardStore((state) => state.viewMode);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const rightPanelMode = useDashboardStore((state) => state.rightPanelMode);
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const currentMonth = useDashboardStore((state) => state.currentMonth);
  const selectDate = useDashboardStore((state) => state.selectDate);
  const setCurrentMonth = useDashboardStore((state) => state.setCurrentMonth);

  const [profileSection, setProfileSection] = useState(PROFILE_SECTIONS.INFO);

  // Скинути секцію профілю при зміні viewMode
  useEffect(() => {
    if (viewMode !== VIEW_MODES.PROFILE) {
      setProfileSection(PROFILE_SECTIONS.INFO);
    }
  }, [viewMode]);

  useEffect(() => {
    const now = new Date();
    const currentTodayKey = getLocalDateKey(now);
    const timeoutId = globalThis.setTimeout(() => {
      const nextNow = new Date();
      const nextTodayKey = getLocalDateKey(nextNow);
      const shouldAdvanceSelectedDay =
        viewMode === VIEW_MODES.CALENDAR && selectedDate === currentTodayKey;
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
  }, [currentMonth, selectDate, selectedDate, setCurrentMonth, viewMode]);

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
    viewMode,
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
