import React from 'react';
import DashboardCard from '@/components/ui/DashboardCard';

/**
 * CampaignCommunicationChatWidget — заглушка чату кампанії.
 *
 * Права панель таба "Деталі" у режимі CHAT.
 * Реальний чат буде реалізований окремо.
 */
export default function CampaignCommunicationChatWidget({ actions }) {
  return (
    <DashboardCard
      title="Чат кампанії"
      actions={actions}
    >

    </DashboardCard>
  );
}
