import React, { useEffect, useMemo, useState, memo } from 'react';
import PropTypes from 'prop-types';
import DashboardCard from '@/components/ui/DashboardCard';
import CalendarDayCell from '../ui/CalendarDayCell';
import useDashboardStore from '@/stores/useDashboardStore';
import useSearchStore from '@/stores/useSearchStore';
import { VIEW_MODES } from '@/stores/dashboardConstants';
import Button from '@/components/ui/Button';
import { formatDate } from '@/components/shared';
import { getLocalDateKey, getMillisecondsUntilNextLocalDay } from '@/components/shared/dateTime.utils';
import Arrow from '@/components/ui/icons/Arrow';
import { useCalendarStatsQuery } from '../../hooks/useCalendarQueries';

const EMPTY_SESSIONS = [];

/**
 * Універсальний CalendarWidget для всіх режимів Dashboard
 */
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
  const hasSearched = useSearchStore((state) => state.hasSearched);

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

  // Отримуємо статистику через React Query
  const { data: calendarStats = {} } = useCalendarStatsQuery({
    currentMonth,
    viewMode,
    searchFilters,
    hasSearched,
  });

  // Генеруємо дні для календаря
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Перший день місяця
    const firstDay = new Date(year, month, 1);
    // Останній день місяця
    const lastDay = new Date(year, month + 1, 0);
    
    // День тижня першого дня (0 = неділя, перетворюємо на 0 = понеділок)
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    
    // Сьогоднішня дата для порівняння
    const days = [];
    
    // Додаємо порожні клітинки для днів попереднього місяця
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ id: `empty-before-${year}-${month}-${i}`, day: null, dateKey: null, isToday: false });
    }
    
    // Додаємо дні поточного місяця
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, dateKey, isToday: dateKey === todayKey });
    }
    
    return days;
  }, [currentMonth, todayKey]);

  // Форматуємо назву місяця
  const monthName = useMemo(() => {
    return formatDate(currentMonth, 'monthYear');
  }, [currentMonth]);

  // Дні тижня
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const navigationActions = (
    <div className="flex gap-2 items-center">
      <button
        onClick={goToPrevMonth}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-dark hover:bg-brand-light/20 transition-colors"
        aria-label="Попередній місяць"
      >
        <Arrow direction="left" className="w-5 h-5" />
      </button>
      
      {shouldShowTodayButton && (
        <div className="flex-shrink-0">
          <Button
            onClick={goToToday}
            variant="primary"
            fullWidth={false}
            className="h-8 px-3 text-base flex items-center justify-center"
          >
            Сьогодні
          </Button>
        </div>
      )}
      
      <button
        onClick={goToNextMonth}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-dark hover:bg-brand-light/20 transition-colors"
        aria-label="Наступний місяць"
      >
        <Arrow direction="right" className="w-5 h-5" />
      </button>
    </div>
  );  
  // Генеруємо заголовок на основі viewMode
  const getViewModeLabel = () => {
    switch (viewMode) {
      case VIEW_MODES.MY_GAMES:
        return 'Мої ігри';
      case VIEW_MODES.CALENDAR:
        return 'Календар';
      case VIEW_MODES.SEARCH:
        return 'Пошук';
      default:
        return '';
    }
  };
  
  const viewModeLabel = getViewModeLabel();
  const cardTitle = title || (viewModeLabel 
    ? `${viewModeLabel} — ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`
    : `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`
  );

  return (
    <DashboardCard 
      title={cardTitle}
      actions={navigationActions}
    >
      {/* {isCalendarLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-brand-dark">Завантаження...</div>
        </div>
      ) : ( */}
      {
        <div className="flex flex-col h-full">
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
          
          {/* Сітка днів */}
          <div className="grid grid-cols-7 gap-1 flex-1 overflow-visible">
            {calendarDays.map((item) => {
              const stats = item.dateKey ? calendarStats[item.dateKey] : null;
              const count = stats?.count || 0;
              const sessions = stats?.sessions || EMPTY_SESSIONS;
              
              if (!item.day) {
                // Порожня клітинка
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
      }
    </DashboardCard>
  );
});

export default CalendarWidget;

CalendarWidget.propTypes = {
  title: PropTypes.string,
  showTodayButton: PropTypes.bool,
};
