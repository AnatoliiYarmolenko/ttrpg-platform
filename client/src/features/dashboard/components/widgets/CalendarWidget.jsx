import React, { useEffect, useMemo, useState, memo } from 'react';
import PropTypes from 'prop-types';
import DashboardCard from '@/components/ui/DashboardCard';
import CalendarDayCell from '../ui/CalendarDayCell';
import useDashboardStore from '@/stores/useDashboardStore';
import useSearchStore from '@/stores/useSearchStore';
import { VIEW_MODES } from '@/features/dashboard/constants';
import Button from '@/components/ui/Button';
import { formatDate } from '@/components/shared';
import { getLocalDateKey, getMillisecondsUntilNextLocalDay } from '@/utils/dateTime';
import Arrow from '@/components/ui/icons/Arrow';
import { useCalendarStatsQuery } from '../../hooks/useCalendarQueries';

const EMPTY_SESSIONS = [];

const CalendarWidget = memo(function CalendarWidget({ title, showTodayButton }) {
  const {
    currentMonth,
    selectedDate,
    viewMode,
    goToNextMonth,
    goToPrevMonth,
    goToToday,
    selectDate,
  } = useDashboardStore();

  const searchFilters = useSearchStore((state) => state.searchFilters);

  const shouldShowTodayButton = showTodayButton ?? (viewMode === VIEW_MODES.MY_GAMES || viewMode === VIEW_MODES.CALENDAR);
  const [todayKey, setTodayKey] = useState(() => getLocalDateKey());

  useEffect(() => {
    let timeoutId = null;

    const scheduleNextTick = () => {
      timeoutId = globalThis.setTimeout(() => {
        setTodayKey(getLocalDateKey());
        scheduleNextTick();
      }, getMillisecondsUntilNextLocalDay());
    };

    scheduleNextTick();

    return () => {
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, []);

  const { data: calendarStats = {} } = useCalendarStatsQuery({
    currentMonth,
    viewMode,
    searchFilters,
  });

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    
    const days = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ id: `empty-before-${year}-${month}-${i}`, day: null, dateKey: null, isToday: false });
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, dateKey, isToday: dateKey === todayKey });
    }
    
    return days;
  }, [currentMonth, todayKey]);

  const monthName = useMemo(() => {
    return formatDate(currentMonth, 'monthYear');
  }, [currentMonth]);

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const navigationActions = (
    <div className="flex gap-1 sm:gap-2 items-center">
      <button
        onClick={goToPrevMonth}
        type="button"
        className="duration-300 inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-brand-dark bg-white/0 hover:bg-brand-light/20 transition-colors"
        aria-label="Попередній місяць"
      >
        <Arrow direction="left" className="w-5 h-5" />
      </button>

      {shouldShowTodayButton && (
        <div className="flex-shrink-0">
          <Button
            onClick={goToToday}
            variant="primary"
            size="md"
            fullWidth={false}
            className="h-8 px-3 sm:px-4 text-sm"
          >
            Сьогодні
          </Button>
        </div>
      )}

      <button
        onClick={goToNextMonth}
        type="button"
        className="duration-300 inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-brand-dark bg-white/0 hover:bg-brand-light/20 transition-colors"
        aria-label="Наступний місяць"
      >
        <Arrow direction="right" className="w-5 h-5" />
      </button>
    </div>
  );
  const cardTitle = title || (monthName.charAt(0).toUpperCase() + monthName.slice(1));

  return (
    <DashboardCard 
      title={cardTitle}
      actions={navigationActions}
    >
      <div className="h-full overflow-x-auto sm:overflow-x-visible">
        <div className="flex flex-col h-full min-w-[600px] sm:min-w-0">
          {/* Заголовки днів тижня */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center font-bold text-brand-medium text-xs py-0.5"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 flex-1 overflow-visible">
            {calendarDays.map((item) => {
              const stats = item.dateKey ? calendarStats[item.dateKey] : null;
              const count = stats?.count || 0;
              const sessions = stats?.sessions || EMPTY_SESSIONS;
              
              if (!item.day) {
                return <div key={item.id} className="min-h-[82px]" />;
              }
              
              return (
                <CalendarDayCell
                  key={item.dateKey}
                  dateKey={item.dateKey}
                  day={item.day}
                  count={count}
                  sessions={sessions}
                  isSelected={selectedDate === item.dateKey}
                  isToday={item.isToday}
                  onSelect={selectDate}
                />
              );
            })}
          </div>
        </div>
      </div>
    </DashboardCard>
  );
});

export default CalendarWidget;

CalendarWidget.propTypes = {
  title: PropTypes.string,
  showTodayButton: PropTypes.bool,
};
