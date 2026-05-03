import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import DashboardCard from '@/components/ui/DashboardCard';
import { BackButton } from '@/components/shared';
import useDashboardStore from '@/stores/useDashboardStore';
import { PANEL_MODES } from '@/features/dashboard/constants';
import CreateSessionForm from './CreateSessionForm';

const placeholders = [
  'Нагадування про старт сесії',
  'Оновлення статусу заявки в сесію',
  'Системні повідомлення платформи',
];

export default function HomeNotificationsWidget() {
  const queryClient = useQueryClient();
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const rightPanelMode = useDashboardStore((state) => state.rightPanelMode);
  const setRightPanelMode = useDashboardStore((state) => state.setRightPanelMode);

  const handleBackToNotifications = () => {
    setRightPanelMode(PANEL_MODES.LIST);
  };

  const handleCreateSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard', 'home', 'next-relevant-session'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard', 'games'] });
    handleBackToNotifications();
  };

  if (rightPanelMode === PANEL_MODES.CREATE) {
    return (
      <DashboardCard
        title="Створити сесію"
        actions={<BackButton label="Назад" onClick={handleBackToNotifications} variant="dark" />}
      >
        <CreateSessionForm
          initialDate={selectedDate}
          onSuccess={handleCreateSuccess}
          onCancel={handleBackToNotifications}
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Сповіщення">
      <div className="flex flex-col gap-3 h-full">
        <p className="text-sm text-brand-medium italic">
          — Гей, я всюди шукав тебе! Ось, просили передати прямо вруки! Ну все, бувай.
        </p>

        <ul className="space-y-2">
          {placeholders.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-brand-light/35 bg-brand-light/10 px-3 py-2 text-sm text-brand-dark"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  );
}
