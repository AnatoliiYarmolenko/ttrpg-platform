import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCallStore } from '@/stores/useCallStore';
import { Phone, ArrowRight } from 'lucide-react';

export function GlobalInCallBadge() {
  const { activeSessionId, presenceState, localMicEnabled } = useCallStore();
  const location = useLocation();

  // Показуємо віджет тільки якщо юзер приєднаний до дзвінка
  if (!activeSessionId || presenceState !== 'JOINED') {
    return null;
  }

  // Якщо користувач вже знаходиться на сторінці сесії (там де є віджет), не показуємо плаваючу панель.
  // Припускаємо, що роут сесії виглядає як /session/:id
  const isCurrentlyOnSessionPage = location.pathname.includes(`/session/${activeSessionId}`);
  if (isCurrentlyOnSessionPage) {
    return null;
  }

return (
    <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 bg-brand-dark/95 border border-white/10 shadow-2xl shadow-brand-dark/40 rounded-xl py-2 px-3 backdrop-blur-md animate-in slide-in-from-bottom-5 fade-in duration-300">
      
      <div className="relative flex items-center justify-center w-8 h-8 bg-brand-accent/10 rounded-full text-brand-accent">
        <div className="absolute inset-0 rounded-full border border-brand-accent animate-ping opacity-25"></div>
        <Phone size={15} />
      </div>
      
      <div className="flex flex-col text-left">
        <span className="text-xs font-bold text-white leading-tight">Ви у дзвінку</span>
        <span className="text-[10px] font-semibold leading-tight text-white/70">
          Мікрофон {localMicEnabled ? 'увімкнено' : 'вимкнено'}
        </span>
      </div>

      <div className="h-6 w-px bg-white/20 mx-1"></div>

      <Link 
        to={`/session/${activeSessionId}?tab=communication`}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-accent text-brand-dark transition-all duration-300 ease-out cursor-pointer shadow-md hover:bg-brand-medium hover:text-brand-accent hover:shadow-lg"
        title="Повернутись до сесії"
      >
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
