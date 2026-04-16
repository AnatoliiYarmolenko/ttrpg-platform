import React from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';

export default function SessionCommunicationChatWidget({
  sessionTitle = '',
  onToggleMode,
}) {
  return (
    <DashboardCard
      title="Чат сесії"
      actions={(
        <Button
          onClick={onToggleMode}
          variant="primary"
          size="md"
          fullWidth={false}
          className="h-8 min-w-[140px]"
        >
          Учасники
        </Button>
      )}
    >
      
    </DashboardCard>
  );
}

