import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import TopBarTabButton from '@/components/ui/TopBarTabButton';
import { buildSessionTabs } from '../../constants/sessionTabs';
import { BrandLogo } from '@/components/shared';

/**
 * SessionNavigation — topBar навігація на сторінці сесії.
 *
 * Показує:
 * - Кнопку "На головну"
 * - Таби: Деталі | Комунікація | Керування (GM) | Ігровий стіл (активна сесія)
 *
 * Таб "Ігровий стіл" є особливим — він навігує на /session/:id/vtt
 * і має кілька станів:
 *   - canOpenVtt: GM, може відкрити (активна кнопка)
 *   - canJoinVtt: гравець, GM вже відкрив (активна кнопка)
 *   - інакше: заблокована (disabled) з тултіпом
 */
export default function SessionNavigation({
  activeTab,
  availableTabs = null,
  onTabChange,
  canManage = false,
  canManageSession = false,
  isSessionActive = false,
  actions = {},
}) {
  const navigate = useNavigate();
  const { id } = useParams();

  const defaultTabs = buildSessionTabs({
    canManageSettings: canManage,
    canManageSession,
    isSessionActive,
  });
  const tabs = Array.isArray(availableTabs) && availableTabs.length > 0
    ? defaultTabs.filter((tab) => availableTabs.includes(tab.key) || tab.isVttTab)
    : defaultTabs;

  const canAccessVtt = Boolean(actions?.canOpenVtt || actions?.canJoinVtt);

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

  const handleTabClick = (tab) => {
    if (tab.isVttTab) {
      if (canAccessVtt && id) {
        navigate(`/session/${id}/vtt`);
      }
      return;
    }
    onTabChange(tab.key);
  };

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
          {tabs.map((tab) => {
            if (tab.isVttTab) {
              return (
                <div key={tab.key} className="relative group">
                  <TopBarTabButton
                    label={tab.label}
                    isActive={activeTab === tab.key}
                    onClick={() => handleTabClick(tab)}
                    disabled={!canAccessVtt}
                    className={canAccessVtt ? '' : 'opacity-40 cursor-not-allowed'}
                  />
                  {!canAccessVtt && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                      {actions?.isVttOpen === false && isSessionActive
                        ? 'Очікування GM для відкриття Ігрового столу'
                        : 'Доступно під час активної сесії'}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <TopBarTabButton
                key={tab.key}
                label={tab.label}
                isActive={activeTab === tab.key}
                onClick={() => handleTabClick(tab)}
              />
            );
          })}
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
        {homeButton}
      </div>
    </nav>
  );
}

SessionNavigation.propTypes = {
  activeTab: PropTypes.string.isRequired,
  availableTabs: PropTypes.arrayOf(PropTypes.string),
  onTabChange: PropTypes.func.isRequired,
  canManage: PropTypes.bool,
  canManageSession: PropTypes.bool,
  isSessionActive: PropTypes.bool,
  actions: PropTypes.shape({
    canOpenVtt: PropTypes.bool,
    canJoinVtt: PropTypes.bool,
    isVttOpen: PropTypes.bool,
  }),
};
