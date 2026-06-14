import React from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import useDashboardStore from '@/stores/useDashboardStore';
import useSearchStore from '@/stores/useSearchStore';
import { PANEL_MODES } from '@/features/dashboard/constants';
import { useQueryClient } from '@tanstack/react-query';
import { useDaySessionsQuery } from '../../hooks/useCalendarQueries';
import CreateSessionForm from './CreateSessionForm';
import SessionCard from '../ui/SessionCard';
import Button from '@/components/ui/Button';
import { BackButton, EmptyState, formatDate, SkeletonSessionCard } from '@/components/shared';
import Dice20 from '@/components/ui/icons/Dice20';
import {
  invalidateCalendarQuery,
  invalidateDailySessionsQuery,
  invalidateDashboardGamesQuery,
} from '@/lib/queryInvalidation';

export default function HomeRightWidget() {
  const {
    selectedDate,
    viewMode,
    rightPanelMode,
    expandedSessionId,
    setRightPanelMode,
    toggleSessionExpanded,
  } = useDashboardStore();

  const searchFilters = useSearchStore((state) => state.searchFilters);

  const queryClient = useQueryClient();
  
  const { data: daySessions = [], isLoading } = useDaySessionsQuery({
    date: selectedDate,
    viewMode,
    searchFilters,
  });

  const getDateTitle = (dateStr) => {
    if (!dateStr) return 'Оберіть день';
    return formatDate(dateStr, 'dayMonth');
  };

  const handleCreateClick = () => {
    setRightPanelMode(PANEL_MODES.CREATE);
  };

  const handleBackToList = () => {
    setRightPanelMode(PANEL_MODES.LIST);
  };

  const handleCreateSuccess = async () => {
    await invalidateCalendarQuery(queryClient);
    await invalidateDailySessionsQuery(queryClient);
    await invalidateDashboardGamesQuery(queryClient);
    handleBackToList();
  };

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

  
  const title = selectedDate 
    ? getDateTitle(selectedDate) 
    : 'Сесії на сьогодні';

  let sessionsContent;

  if (isLoading) {
    sessionsContent = (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <SkeletonSessionCard key={i} />)}
      </div>
    );
  } else if (daySessions.length === 0) {
    sessionsContent = (
      <EmptyState
        icon={<Dice20 className="w-14 h-14" />}
        title="Немає запланованих сесій"
        description="на цей день"
        className="h-full"
      />
    );
  } else {
    sessionsContent = (
      <div className="flex flex-col gap-3">
        {daySessions.map((session) => {
          const isExpanded = expandedSessionId === session.id;

          return (
            <SessionCard
              key={session.id}
              session={session}
              isExpanded={isExpanded}
              onToggle={() => toggleSessionExpanded(session.id)}
              showDate={false}
            />
          );
        })}
      </div>
    );
  }

return (
    <DashboardCard title={title}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto min-h-0">  
          {sessionsContent}
        </div>
        
        <div className="pt-4 border-t border-brand-light/20 mt-auto flex-shrink-0">
          <Button onClick={handleCreateClick} variant="primary" fullWidth={true} className="flex items-center justify-center gap-2">
            Створити сесію
          </Button>
        </div>
      </div>
    </DashboardCard>
  );}
