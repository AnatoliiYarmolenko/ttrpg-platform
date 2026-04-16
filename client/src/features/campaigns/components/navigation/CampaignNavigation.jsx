import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import TopBarTabButton from '@/components/ui/TopBarTabButton';

const TABS = {
  SESSIONS: 'sessions',
  DETAILS: 'details',
  SETTINGS: 'settings',
};

/**
 * CampaignNavigation — topBar навігація на сторінці кампанії.
 *
 * Показує:
 * - Кнопку "Назад" (на Dashboard)
 * - Назву кампанії
 * - Таби: Сесії | Деталі | Налаштування (тільки Власник)
 *
 * @param {string} campaignTitle — назва кампанії
 * @param {string} activeTab — поточний таб ('sessions' | 'details' | 'settings')
 * @param {Function} onTabChange — колбек зміни табу
 * @param {boolean} canManageSettings — чи є юзер власником (для відображення табу "Налаштування")
 */
export default function CampaignNavigation({
  campaignTitle,
  activeTab,
  availableTabs = null,
  onTabChange,
  canManageSettings = false,
}) {
  const navigate = useNavigate();

  const defaultTabs = [
    { key: TABS.SESSIONS, label: 'Сесії' },
    { key: TABS.DETAILS, label: 'Деталі' },
    ...(canManageSettings ? [{ key: TABS.SETTINGS, label: 'Налаштування' }] : []),
  ];
  const tabs = Array.isArray(availableTabs) && availableTabs.length > 0
    ? defaultTabs.filter((tab) => availableTabs.includes(tab.key))
    : defaultTabs;

  return (
    <nav className="flex items-center gap-4 justify-between w-full">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="bg-white px-4 py-2 rounded-xl border-2 border-brand-light/30 shadow-md flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 bg-brand-dark rounded-full flex items-center justify-center text-brand-accent font-bold text-xs">
            D20
          </div>
          <span className="font-bold text-brand-dark hidden md:block shrink-0">TTRPG Platform</span>

          <span className="text-brand-dark/50 hidden md:inline">/</span>
          <span className="font-bold text-brand-dark text-sm truncate max-w-[220px]" title={campaignTitle}>
            {campaignTitle || 'Кампанія'}
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
