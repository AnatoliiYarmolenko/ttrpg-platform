import React from 'react';

/**
 * Картки статистики для адмін-дашборду
 */
export default function StatsCards({ stats }) {
  if (!stats) return null;

  const cards = [
    { label: 'Користувачі', value: stats.users},
    { label: 'Кампанії', value: stats.campaigns},
    { label: 'Сесії', value: stats.sessions},
    { label: 'Активні сесії', value: stats.activeSessions},
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border-2 border-brand-light/30 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{card.icon}</span>
            <span className="text-sm text-gray-500 font-medium">{card.label}</span>
          </div>
          <div className="text-2xl font-bold text-brand-dark">{card.value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}
