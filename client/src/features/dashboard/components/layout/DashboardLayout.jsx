import React from 'react';
import AppLayout from '../../../../components/layout/AppLayout';

export default function DashboardLayout({ topBar, leftPanel, rightPanel, leftLabel, rightLabel }) {
  return (
    <AppLayout
      topBar={topBar}
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      leftLabel={leftLabel}
      rightLabel={rightLabel}
    />
  );
}