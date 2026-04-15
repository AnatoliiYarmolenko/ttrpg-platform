import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import TopBarTabButton from '@/components/ui/TopBarTabButton';

const TABS = {
  DETAILS: 'details',
  SETTINGS: 'settings',
};

/**
 * SessionNavigation — topBar навігація на сторінці сесії.
 *
 * Показує:
 * - Кнопку "Назад" (на Dashboard)
 * - Назву сесії
 * - Таби: Деталі | Налаштування (GM only)
 *
 * @param {string} sessionTitle — назва сесії
 * @param {string} activeTab — поточний таб ('details' | 'settings')
 * @param {Function} onTabChange — колбек зміни табу
 * @param {boolean} canManage — чи є юзер GM/Owner (для відображення табу "Налаштування")
 * @param {string} campaignTitle — назва кампанії (опціонально)
 */
export default function SessionNavigation({
  sessionTitle,
  activeTab,
  onTabChange,
  canManage = false,
  campaignTitle,
}) {
  const navigate = useNavigate();

  const tabs = [
    { key: TABS.DETAILS, label: 'Деталі' },
    ...(canManage ? [{ key: TABS.SETTINGS, label: 'Налаштування' }] : []),
  ];

  return (
    <nav className="flex items-center gap-4 justify-between w-full">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="bg-white px-4 py-2 rounded-xl border-2 border-brand-light/30 shadow-md flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 bg-brand-dark rounded-full flex items-center justify-center text-brand-accent font-bold text-xs">
            D20
          </div>
          <span className="font-bold text-brand-dark hidden md:block shrink-0">TTRPG Platform</span>

          <span className="text-brand-dark/50 hidden md:inline">/</span>
          <span className="font-bold text-brand-dark text-sm truncate max-w-[220px]" title={sessionTitle}>
            {sessionTitle || campaignTitle || 'Сесія'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {tabs.map((tab) => (
            <TopBarTabButton
              key={tab.key}
              label={tab.label}
              isActive={activeTab === tab.key}
              onClick={() => onTabChange(tab.key)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end flex-1">
        <Button
          onClick={() => navigate('/')}
          variant="topbar"
          size="md"
          fullWidth={false}
          className="font-bold"
        >
          На головну
        </Button>
      </div>
    </nav>
  );
}

export { TABS };
