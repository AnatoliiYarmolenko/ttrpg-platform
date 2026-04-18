import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import TopBarTabButton from '@/components/ui/TopBarTabButton';
import { buildSessionTabs } from '../../constants/sessionTabs';
import { BrandLogo } from '@/components/shared';

/**
 * SessionNavigation — topBar навігація на сторінці сесії.
 *
 * Показує:
 * - Кнопку "Назад" (на Dashboard)
 * - Назву сесії
 * - Таби: Деталі | Налаштування (GM only)
 *
 * @param {string} activeTab — поточний таб ('details' | 'settings')
 * @param {Function} onTabChange — колбек зміни табу
 * @param {boolean} canManage — чи є юзер GM/Owner (для відображення табу "Налаштування")
 */
export default function SessionNavigation({
  activeTab,
  availableTabs = null,
  onTabChange,
  canManage = false,
  canManageSession = false,
}) {
  const navigate = useNavigate();

  const defaultTabs = buildSessionTabs({
    canManageSettings: canManage,
    canManageSession,
  });
  const tabs = Array.isArray(availableTabs) && availableTabs.length > 0
    ? defaultTabs.filter((tab) => availableTabs.includes(tab.key))
    : defaultTabs;

  const homeButton = (
    <Button
      onClick={() => navigate('/')}
      variant="topbar"
      size="md"
      fullWidth={false}
      className="font-bold lg:py-2 lg:px-4 lg:text-base whitespace-nowrap"
    >
      На головну
    </Button>
  );

  return (
    <nav className="flex flex-col lg:flex-row gap-2 lg:items-center justify-between w-full">
      <div className="flex items-center justify-between gap-4 w-full lg:w-auto">
        <BrandLogo className="min-w-0 max-w-[200px] sm:max-w-none lg:px-6" />
        
        <div className="flex lg:hidden items-center gap-2 flex-shrink-0">
          {homeButton}
        </div>
      </div>

      <div className="w-full lg:flex-1 overflow-x-auto pb-1 lg:pb-0 -mx-1 lg:mx-0 px-1 lg:px-0">
        <div className="flex items-center gap-2 min-w-max lg:justify-start">
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

      <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
        {homeButton}
      </div>
    </nav>
  );
}
