import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { VIEW_MODES } from '@/features/dashboard/constants';
import Button from '@/components/ui/Button';
import NavButton from '@/components/ui/NavButton';
import useAuthStore, { selectIsAdmin } from '@/stores/useAuthStore';
import { BrandLogo, ConfirmModal } from '@/components/shared';
import useConfirmDialog from '@/hooks/useConfirmDialog';

// Додаємо props: user та onLogout
export default function DashboardNavigation({ currentView, onNavigate, user, onLogout }) {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(selectIsAdmin);
  const { openConfirm, confirmModalProps } = useConfirmDialog();

  const dashboardTabs = [
    { key: VIEW_MODES.CALENDAR, label: 'Календар', to: '/?tab=calendar' },
    { key: VIEW_MODES.MY_GAMES, label: 'Мої ігри', to: '/?tab=my-games' },
    { key: VIEW_MODES.SEARCH, label: 'Пошук', to: '/?tab=search' },
    { key: VIEW_MODES.PROFILE, label: 'Профіль', to: '/?tab=profile' },
  ];

  const adminButton = isAdmin && (
    <Button
      onClick={() => navigate('/admin')}
      variant="topbarAccent"
      size="sm"
      fullWidth={false}
      className="font-bold whitespace-nowrap lg:py-2 lg:px-4 lg:text-base"
    >
      Адмін
    </Button>
  );

  const handleLogoutClick = () => {
    openConfirm({
      title: 'Вийти з акаунту?',
      message: 'Після виходу доведеться знову авторизуватися.',
      variant: 'danger',
      confirmText: 'Вийти',
      onConfirm: onLogout,
    });
  };

  const logoutButton = (
    <Button 
      onClick={handleLogoutClick}
      variant="topbar"
      size="sm"
      fullWidth={false}
      className="font-bold whitespace-nowrap lg:py-2 lg:px-4 lg:text-base"
    >
      Вийти
    </Button>
  );

  return (
    <>
      <nav className="flex flex-col lg:flex-row gap-2 lg:items-center justify-between w-full">
      
      {/* Верхній рядок (Mobile), або лівий блок (Desktop) */}
      <div className="flex items-center justify-between gap-4 w-full lg:w-auto">
        <BrandLogo 
          className="min-w-0 max-w-[200px] sm:max-w-none lg:px-6" 
          isActive={currentView === VIEW_MODES.HOME} 
        />
        
        {/* Кнопки адмін/вихід (Mobile) */}
        <div className="flex lg:hidden items-center gap-2 flex-shrink-0">
          {adminButton}
          {logoutButton}
        </div>
      </div>

      {/* Інфо юзера (Mobile) */}
      {user && (
        <div className="lg:hidden w-full px-1">
          <span className="text-white/90 font-medium drop-shadow-md text-sm truncate block">
            {user.username}
          </span>
        </div>
      )}

      {/* Вкладки (Скролл на mobile, в лінію на desktop) */}
      <div className="w-full lg:flex-1 overflow-x-auto pb-1 lg:pb-0 -mx-1 lg:mx-0 px-1 lg:px-0">
        <div className="flex items-center gap-2 min-w-max lg:justify-start">
          {dashboardTabs.map((tab) => (
            <NavButton
              key={tab.key}
              label={tab.label}
              isActive={currentView === tab.key}
              to={tab.to}
              onClick={() => onNavigate(tab.key)}
              size="sm"
              className="px-3 py-1.5 text-sm whitespace-nowrap flex-shrink-0 lg:py-2 lg:px-6 lg:text-base justify-center"
            />
          ))}
        </div>
      </div>

      {/* Права частина з інфо юзера та кнопками (Desktop) */}
      <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
        {user && (
          <span className="text-white font-medium drop-shadow-md">
            {user.username}
          </span>
        )}
        {adminButton}
        {logoutButton}
      </div>
      </nav>

      <ConfirmModal {...confirmModalProps} />
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