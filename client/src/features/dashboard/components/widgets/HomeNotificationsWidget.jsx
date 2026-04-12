import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import DashboardCard from '@/components/ui/DashboardCard';
import { BackButton } from '@/components/shared';
import useDashboardStore from '@/stores/useDashboardStore';
import { PANEL_MODES } from '@/stores/dashboardConstants';
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
    <DashboardCard title="Нотифікації">
      <div className="flex flex-col gap-3 h-full">
        <p className="text-sm text-[#4D774E]">
          Незабаром тут будуть нагадування та системні події.
        </p>

        <ul className="space-y-2">
          {placeholders.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-[#9DC88D]/35 bg-[#F8FBF4] px-3 py-2 text-sm text-[#164A41]"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  );
}
