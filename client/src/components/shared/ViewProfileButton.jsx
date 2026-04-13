import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Arrow from '@/components/ui/icons/Arrow';

/**
 * ViewProfileButton — кнопка переходу на повну публічну сторінку профілю.
 *
 * Передає поточний pathname у location.state.fromPath, щоб PublicProfilePage
 * міг показати правильний підпис кнопки "Назад" (до сесії / кампанії / тощо).
 *
 * @param {string} username
 */
export default function ViewProfileButton({ username }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!username) return null;

  return (
    <button
      onClick={() => navigate(`/user/${username}`, { state: { fromPath: location.pathname } })}
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg border border-brand-light/40 text-brand-dark hover:bg-brand-light/10 transition-colors w-full"
      title={`Відкрити профіль @${username}`}
    >
      Відкрити профіль
      <Arrow className="w-4 h-4" direction="right" />
    </button>
  );
}
