import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, RoleBadge, DateTimeDisplay } from '@/components/shared';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Dice20 from '@/components/ui/icons/Dice20';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';
/**
 * SessionCard — Карточка сесії з акордеоном
 * 
 * Відображає:
 * - Заголовок, статус, роль гравця
 * - Час, тривалість, кількість гравців, систему
 * - Опис сесії (при розгортанні)
 * - Інформацію про кампанію
 * - Ім'я Майстра
 * - Ціну (якщо є)
 * - Кнопку "Деталі" для переходу до сторінки сесії
 * 
 * @param {Object} props
 * @param {Object} props.session - Об'єкт сесії
 * @param {boolean} props.isExpanded - Чи розгорнута картка
 * @param {Function} props.onToggle - Функція для розгортання/згортання
 */
export default function SessionCard({ 
  session, 
  isExpanded, 
  onToggle,
}) {
  const navigate = useNavigate();
  // Форматування тривалості
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} хв`;
    if (mins === 0) return `${hours} год`;
    return `${hours} год ${mins} хв`;
  };

  return (
    <div 
      key={session.id} 
      className={`border-2 rounded-xl transition-all duration-200 ${
        isExpanded 
          ? 'border-[#164A41] shadow-md' 
          : 'border-[#9DC88D]/30 hover:border-[#164A41]/30'
      }`}
    >
      {/* Кнопка-заголовок для розгортання */}
      <button 
        onClick={onToggle}
        className="w-full p-4 text-left"
      >
        {/* Заголовок і статуси */}
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-bold text-[#164A41] flex-1 pr-2">
            {session.title}
          </h4>
          <div className="flex items-center gap-2">
            {session.myRole && (
              <RoleBadge role={session.myRole} />
            )}
            <StatusBadge status={session.status} size="sm" />
          </div>
        </div>

        {/* Основна інформація */}
        <div className="flex items-center gap-4 text-sm text-[#4D774E]">
          <span className="flex items-center gap-1">
            <Data className="w-4 h-4" /> <DateTimeDisplay value={session.date} format="time" />
          </span>
          <span className="flex items-center gap-1">
            <Timer className="w-4 h-4" /> {formatDuration(session.duration)}
          </span>
          <span className="flex items-center gap-1">
            <GroupPeople className="w-4 h-4" /> {session.currentPlayers}/{session.maxPlayers}
          </span>
          {session.system && (
            <span className="flex items-center gap-1">
              <Dice20 className="w-4 h-4" /> {session.system}
            </span>
          )}
        </div>

        {/* Стрілка розгортання */}
        <div className="flex justify-center mt-2">
          <span 
            className={`text-[#9DC88D] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Розгорнута інформація */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[#9DC88D]/20">
          {/* Опис */}
          {session.description && (
            <p className="text-sm text-[#4D774E] mt-3 mb-4">
              {session.description}
            </p>
          )}

          {/* Кампанія */}
          {session.campaign && (
            <div className="text-sm text-[#4D774E] mb-3">
              <span className="font-medium">Кампанія:</span> {session.campaign.title}
              {session.campaign.system && (
                <span className="text-xs ml-2 px-2 py-0.5 bg-[#9DC88D]/20 rounded">
                  {session.campaign.system}
                </span>
              )}
            </div>
          )}

          {/* Майстер */}
          <div className="text-sm text-[#4D774E] mb-4">
            <span className="font-medium">Організатор:</span> {session.owner?.displayName || session.owner?.username || 'Невідомо'}
          </div>

          {/* Ціна */}
          {session.price > 0 && (
            <div className="text-sm font-bold text-[#164A41] mb-4">
              Вартість: {session.price} грн
            </div>
          )}

          {/* Кнопка "Деталі" — перехід до сторінки сесії */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/session/${session.id}`);
            }}
            className="w-full py-2 px-4 bg-[#F1B24A] text-[#164A41] rounded-lg font-bold hover:bg-[#4D774E] hover:text-white transition-colors"
          >
            Деталі
          </button>
        </div>
      )}
    </div>
  );
}
