import React, { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VttBattlefield } from '../components/battlefield';
import { useSessionPageQuery } from '@/features/sessions/hooks/useSessionQueries';
import { useChatController } from '@/features/chat/hooks';
import { useCallViewerSync } from '@/features/call/hooks/useCallViewerSync';
import useVttConnection from '../hooks/useVttConnection';
import { FullPageLoader } from '@/components/shared';
import DiceRoller3D from '../components/DiceRoller3D';
import QuickBar from '../components/QuickBar';
import RollMaker from '../components/RollMaker';
import VttSidebar from '../components/VttSidebar';
import VttFloatingChat from '../components/VttFloatingChat';
import VttFloatingCall from '../components/VttFloatingCall';
import RollResultPopup from '../components/RollResultPopup';
import DiceLogPanel from '../components/DiceLogPanel';
import SceneManager from '../components/SceneManager';
import useVttStore from '@/stores/useVttStore';

/**
 * VttPage — сторінка Ігрового столу (/session/:id/vtt).
 *
 * Поточний стан: заглушка-placeholder.
 * Повна реалізація VTT canvas (Konva, токени, сцени) — наступний етап.
 *
 * Логіка доступу:
 * - GM (canOpenVtt): відкриває VTT, надсилає vtt:open через WS
 * - Гравець (canJoinVtt): може зайти якщо GM вже відкрив
 * - Інакше: редірект назад на сторінку сесії
 */
export default function VttPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Ініціалізуємо підключення до сигнального сервера дзвінків
  useCallViewerSync(id);

  const setVttOpen = useVttStore((state) => state.setVttOpen);
  const incomingRoll = useVttStore((state) => state.incomingRoll);
  const rollStrength = useVttStore((state) => state.rollStrength);
  
  useEffect(() => {
    if (id) {
      setVttOpen(id, true);
    }
  }, [id, setVttOpen]);

  const { data: pageData, isLoading } = useSessionPageQuery({ sessionId: id ? Number(id) : null });
  const actions = pageData?.actions || {};

  const chatController = useChatController('session', Number.parseInt(id, 10), {
    enabled: Boolean(id && pageData),
  });

  const vttConnection = useVttConnection(id, {
    enabled: Boolean(id && pageData),
  });

  const canAccess = Boolean(actions.canOpenVtt || actions.canJoinVtt);

  // GM автоматично відкриває VTT при вході на сторінку
  useEffect(() => {
    if (!pageData || !chatController.isConnected) return;
    if (actions.canOpenVtt) {
      vttConnection.sendVttOpen?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageData?.actions?.canOpenVtt, chatController.isConnected]);



  // Редірект якщо немає доступу
  useEffect(() => {
    if (!isLoading && pageData && !canAccess) {
      navigate(`/session/${id}`, { replace: true });
    }
  }, [isLoading, pageData, canAccess, id, navigate]);

  // Обробник кидка з QuickBar або RollMaker
  const handleRoll = useCallback((formula, name, customStrength, visibility) => {
    if (!vttConnection.sendVttDiceRoll) {
      alert('Помилка: Функція sendVttDiceRoll недоступна. Будь ласка, оновіть сторінку (Ctrl+F5).');
      return;
    }
    // Відправляємо кидок на сервер для синхронізації
    vttConnection.sendVttDiceRoll(formula, name, customStrength ?? rollStrength, visibility);
  }, [vttConnection, rollStrength]);

  if (isLoading || !pageData) {
    return <FullPageLoader text="Завантаження Ігрового столу..." />;
  }

  if (!canAccess) {
    return null; // Редірект ще в процесі
  }

  return (
    <div className="flex flex-col h-screen bg-brand-dark text-white overflow-hidden">
      <VttSidebar />
      <VttFloatingChat chatController={chatController} />
      <VttFloatingCall sessionId={id} />
      <RollResultPopup />
      <DiceLogPanel />
      
      {/* Canvas Placeholder */}
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {/* 3D Dice Layer */}
        <DiceRoller3D incomingRoll={incomingRoll} />
        
        {/* Animated grid background */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(157, 200, 141, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(157, 200, 141, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        {/* PixiJS Battlefield Canvas */}
        <VttBattlefield 
          vttConnection={vttConnection} 
          isGM={Boolean(pageData?.viewer?.isSessionOwner || pageData?.viewer?.role === 'GM' || actions.canManageParticipants)} 
        />

        {/* UI Overlays */}
        <SceneManager vttConnection={vttConnection} />
        <RollMaker onRoll={handleRoll} />
        <QuickBar onRoll={handleRoll} />
      </main>
    </div>
  );
}
