import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { VIEW_MODES } from '@/stores/dashboardConstants';
import NavButton from '@/components/ui/NavButton';
import useAuthStore, { selectIsAdmin } from '@/stores/useAuthStore';

// Додаємо props: user та onLogout
export default function DashboardNavigation({ currentView, onNavigate, user, onLogout }) {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(selectIsAdmin);

  const dashboardTabs = [
    { key: VIEW_MODES.HOME, label: 'Дашборд' },
    { key: VIEW_MODES.CALENDAR, label: 'Календар' },
    { key: VIEW_MODES.MY_GAMES, label: 'Мої ігри' },
    { key: VIEW_MODES.SEARCH, label: 'Пошук' },
    { key: VIEW_MODES.PROFILE, label: 'Профіль' },
  ];

  return (
    <>
      <nav className="hidden lg:flex items-center gap-4 justify-between w-full">
        {/* Ліва частина: Лого та кнопки навігації */}
        <div className="flex items-center gap-4">
          <div className="bg-white px-4 py-2 rounded-xl border-2 border-brand-light/30 shadow-md flex items-center gap-2">
             <div className="w-6 h-6 bg-brand-dark rounded-full flex items-center justify-center text-brand-accent font-bold text-xs">
               D20
             </div>
             <span className="font-bold text-brand-dark hidden md:block">TTRPG Platform</span>
          </div>

          {dashboardTabs.map((tab) => (
            <NavButton
              key={tab.key}
              label={tab.label}
              isActive={currentView === tab.key}
              onClick={() => onNavigate(tab.key)}
            />
          ))}
        </div>

        {/* Права частина: Інфо про юзера та Логаут */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              title="Адмін-панель"
              className="px-4 py-2 rounded-xl border-2 border-brand-accent bg-brand-accent text-brand-dark hover:bg-brand-dark hover:text-brand-accent transition-all font-bold shadow-lg"
            >
              ⚙ Адмін
            </button>
          )}
          {user && (
            <span className="text-white font-medium drop-shadow-md hidden sm:block">
              {user.username}
            </span>
          )}
          
          <button 
            onClick={onLogout}
            title="Вийти з акаунту"
            className="px-4 py-2 rounded-xl border-2 border-white/50 bg-brand-dark text-white hover:bg-brand-accent hover:text-brand-dark hover:border-brand-dark transition-all font-bold shadow-lg"
          >
            Вийти
          </button>
        </div>
      </nav>

      <nav className="lg:hidden flex flex-col gap-2 w-full">
        <div className="flex items-center justify-between gap-2">
          <div className="bg-white px-3 py-2 rounded-xl border-2 border-brand-light/30 shadow-md flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 bg-brand-dark rounded-full flex items-center justify-center text-brand-accent font-bold text-xs">
              D20
            </div>
            <span className="font-bold text-brand-dark text-sm truncate">TTRPG Platform</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                title="Адмін-панель"
                className="px-3 py-2 rounded-xl border-2 border-brand-accent bg-brand-accent text-brand-dark hover:bg-brand-dark hover:text-brand-accent transition-all font-bold shadow-lg text-sm whitespace-nowrap"
              >
                ⚙ Адмін
              </button>
            )}
            <button 
              onClick={onLogout}
              title="Вийти з акаунту"
              className="px-3 py-2 rounded-xl border-2 border-white/50 bg-brand-dark text-white hover:bg-brand-accent hover:text-brand-dark hover:border-brand-dark transition-all font-bold shadow-lg text-sm whitespace-nowrap"
            >
              Вийти
            </button>
          </div>
        </div>

        {user && (
          <span className="text-white/90 font-medium drop-shadow-md text-sm px-1 truncate">
            {user.username}
          </span>
        )}

        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex items-center gap-2 min-w-max">
            {dashboardTabs.map((tab) => (
              <NavButton
                key={tab.key}
                label={tab.label}
                isActive={currentView === tab.key}
                onClick={() => onNavigate(tab.key)}
                className="px-3 py-1.5 text-sm whitespace-nowrap flex-shrink-0"
              />
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}

DashboardNavigation.propTypes = {
  currentView: PropTypes.string,
  onNavigate: PropTypes.func.isRequired,
  user: PropTypes.shape({
    username: PropTypes.string,
  }),
  onLogout: PropTypes.func.isRequired,
};