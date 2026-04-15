import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import useDashboardStore, { VIEW_MODES } from '@/stores/useDashboardStore';

describe('useDashboardStore calendar regressions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
    useDashboardStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not skip April when navigating next month from March 31 after goToToday', () => {
    const { goToToday, goToNextMonth } = useDashboardStore.getState();

    goToToday();
    goToNextMonth();

    const { currentMonth } = useDashboardStore.getState();
    expect(currentMonth.getFullYear()).toBe(2026);
    expect(currentMonth.getMonth()).toBe(3);
    expect(currentMonth.getDate()).toBe(1);
  });

  it('preserves currentMonth and clears selectedDate when switching to HOME mode', () => {
    const { setCurrentMonth, setViewMode } = useDashboardStore.getState();

    setCurrentMonth(new Date('2025-11-15T12:00:00.000Z'));
    setViewMode(VIEW_MODES.SEARCH);
    setViewMode(VIEW_MODES.HOME);

    const { currentMonth, selectedDate } = useDashboardStore.getState();
    expect(currentMonth.getFullYear()).toBe(2025);
    expect(currentMonth.getMonth()).toBe(10);
    expect(currentMonth.getDate()).toBe(1);
    expect(selectedDate).toBeNull();
  });

  it('normalizes currentMonth to month start on reset', () => {
    const { setCurrentMonth, reset } = useDashboardStore.getState();

    setCurrentMonth(new Date('2026-03-17T12:00:00.000Z'));
    reset();

    const { currentMonth } = useDashboardStore.getState();
    expect(currentMonth.getDate()).toBe(1);
    expect(currentMonth.getMonth()).toBe(2);
    expect(currentMonth.getFullYear()).toBe(2026);
  });
});