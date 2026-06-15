import React from 'react';
import AppLayout from '../../../../components/layout/AppLayout';

/**
 * CampaignLayout — лейаут сторінки кампанії.
 * Повторює паттерн SessionLayout / DashboardLayout (70/30, topBar + left + right).
 *
 * @param {React.ReactNode} topBar — верхня навігація
 * @param {React.ReactNode} leftPanel — лівий контент (70%)
 * @param {React.ReactNode} rightPanel — правий контент (30%)
 */
export default function CampaignLayout({ topBar, leftPanel, rightPanel, leftLabel = 'Кампанія', rightLabel = 'Деталі' }) {
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
