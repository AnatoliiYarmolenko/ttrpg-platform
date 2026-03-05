import React from 'react';
import { useNavigate } from 'react-router-dom';
import { VIEW_MODES } from '@/stores/dashboardConstants';
import NavButton from '@/components/ui/NavButton';
import { selectIsAdmin } from '@/stores/useAuthStore';
import useAuthStore from '@/stores/useAuthStore';

// Додаємо props: user та onLogout
export default function DashboardNavigation({ currentView, onNavigate, user, onLogout }) {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(selectIsAdmin);

  return (
    <nav className="flex items-center gap-4 justify-between w-full">
      {/* Ліва частина: Лого та кнопки навігації */}
      <div className="flex items-center gap-4">
        <div className="bg-white px-4 py-2 rounded-xl border-2 border-[#9DC88D]/30 shadow-md flex items-center gap-2">
           <div className="w-6 h-6 bg-[#164A41] rounded-full flex items-center justify-center text-[#F1B24A] font-bold text-xs">
             D20
           </div>
           <span className="font-bold text-[#164A41] hidden md:block">TTRPG Platform</span>
        </div>

        <NavButton 
          label="Календар" 
          isActive={currentView === VIEW_MODES.HOME}
          onClick={() => onNavigate(VIEW_MODES.HOME)}
        />
        <NavButton 
          label="Мої ігри" 
          isActive={currentView === VIEW_MODES.MY_GAMES}
          onClick={() => onNavigate(VIEW_MODES.MY_GAMES)}
        />
        <NavButton 
          label="Пошук" 
          isActive={currentView === VIEW_MODES.SEARCH}
          onClick={() => onNavigate(VIEW_MODES.SEARCH)}
        />
        <NavButton 
          label="Профіль" 
          isActive={currentView === VIEW_MODES.PROFILE}
          onClick={() => onNavigate(VIEW_MODES.PROFILE)}
        />
      </div>

      {/* Права частина: Інфо про юзера та Логаут */}
      <div className="flex items-center gap-3">
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            title="Адмін-панель"
            className="px-4 py-2 rounded-xl border-2 border-[#F1B24A] bg-[#F1B24A] text-[#164A41] hover:bg-[#164A41] hover:text-[#F1B24A] transition-all font-bold shadow-lg"
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
          className="px-4 py-2 rounded-xl border-2 border-white/50 bg-[#164A41] text-white hover:bg-[#F1B24A] hover:text-[#164A41] hover:border-[#164A41] transition-all font-bold shadow-lg"
        >
          Вийти
        </button>
      </div>
    </nav>
  );
}