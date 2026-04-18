import React from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';

/**
 * CampaignCommunicationChatWidget — заглушка чату кампанії.
 *
 * Права панель таба "Деталі" у режимі CHAT.
 * Реальний чат буде реалізований окремо.
 */
export default function CampaignCommunicationChatWidget({ onToggleMode }) {
  return (
    <DashboardCard
      title="Чат кампанії"
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
