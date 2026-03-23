import React from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import useDashboardStore from '@/stores/useDashboardStore';
import useSearchStore from '@/stores/useSearchStore';
import { PANEL_MODES } from '@/stores/dashboardConstants';
import { useQueryClient } from '@tanstack/react-query';
import { useDaySessionsQuery } from '../../hooks/useCalendarQueries';
import CreateSessionForm from './CreateSessionForm';
import SessionCard from '../ui/SessionCard';
import Button from '@/components/ui/Button';
import { BackButton, EmptyState, formatDate } from '@/components/shared';
import Dice20 from '@/components/ui/icons/Dice20';

/**
 * HomeRightWidget — Права панель для режиму "Головна"
 * 
 * Стани:
 * - LIST: Список сесій вибраного дня (з акордеоном)
 * - CREATE: Форма створення нової сесії
 * 
 * Features:
 * - Sticky footer з кнопкою "Створити сесію"
 * - Акордеон для розгортання деталей сесії
 * - Кнопка "Деталі" веде до сторінки сесії
 * - Автоматично показує сесії на сьогодні при першому завантаженні
 */
export default function HomeRightWidget() {
  const {
    selectedDate,
    currentMonth,
    viewMode,
    rightPanelMode,
    expandedSessionId,
    setRightPanelMode,
    toggleSessionExpanded,
  } = useDashboardStore();

  const searchFilters = useSearchStore((state) => state.searchFilters);
  const hasSearched = useSearchStore((state) => state.hasSearched);

  const queryClient = useQueryClient();
  
  const { data: daySessions = [], isLoading } = useDaySessionsQuery({
    date: selectedDate,
    viewMode,
    searchFilters,
    hasSearched,
  });

  // Форматування дати для відображення
  const getDateTitle = (dateStr) => {
    if (!dateStr) return 'Оберіть день';
    return formatDate(dateStr, 'dayMonth');
  };

  // Перехід до форми створення
  const handleCreateClick = () => {
    setRightPanelMode(PANEL_MODES.CREATE);
  };

  // Повернення до списку
  const handleBackToList = () => {
    setRightPanelMode(PANEL_MODES.LIST);
  };

  const handleCreateSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['calendar'] });
    await queryClient.invalidateQueries({ queryKey: ['sessions', 'daily'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard', 'games'] });
    handleBackToList();
  };

  // ===== РЕЖИМ СТВОРЕННЯ СЕСІЇ =====
  if (rightPanelMode === PANEL_MODES.CREATE) {
    return (
      <DashboardCard 
        title="Створити сесію"
        actions={
          <BackButton label="Назад" onClick={handleBackToList} variant="dark" />
        }
      >
        <CreateSessionForm 
          initialDate={selectedDate}
          onSuccess={handleCreateSuccess}
          onCancel={handleBackToList}
        />
      </DashboardCard>
    );
  }

  // ===== РЕЖИМ СПИСКУ СЕСІЙ =====
  
  // Заголовок залежить від того, чи вибрана дата
  const title = selectedDate 
    ? getDateTitle(selectedDate) 
    : 'Сесії на сьогодні';

  // Якщо дата не вибрана — показуємо підказку
return (
    <DashboardCard title={title}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? ( 
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-[#164A41] font-medium">Завантаження сесій...</div>
            </div>
          ) : daySessions.length === 0 ? (
            <EmptyState
              icon={<Dice20 className="w-14 h-14" />}
              title="Немає запланованих сесій"
              description="на цей день"
              className="h-full"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {daySessions.map((session) => {
                const isExpanded = expandedSessionId === session.id;
                
                return (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isExpanded={isExpanded}
                    onToggle={() => toggleSessionExpanded(session.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
        
        {/* Sticky Footer */}
        <div className="pt-4 border-t border-[#9DC88D]/20 mt-auto flex-shrink-0">
          <Button onClick={handleCreateClick} variant="primary" className="flex items-center justify-center gap-2">
            Створити сесію
          </Button>
        </div>
      </div>
    </DashboardCard>
  );}
