import React from 'react';
import { useParams } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import { CallWidget } from '@/features/call/components/CallWidget';

export default function SessionCommunicationCallWidget() {
  const { id } = useParams();
  const sessionId = Number(id);

  return (
    <DashboardCard title="Відеодзвінок">
      <CallWidget sessionId={sessionId} />
    </DashboardCard>
  );
}

