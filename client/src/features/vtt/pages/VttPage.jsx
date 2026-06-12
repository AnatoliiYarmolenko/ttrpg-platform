import React, { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VttBattlefield } from '../components/battlefield';
import { useSessionPageQuery } from '@/features/sessions/hooks/useSessionQueries';
import { useChatController } from '@/features/chat/hooks';
import { useCallViewerSync } from '@/features/call/hooks/useCallViewerSync';
import useVttConnection from '../hooks/useVttConnection';
import { FullPageLoader, ConfirmModal, InputModal } from '@/components/shared';
import DiceRoller3D from '../components/DiceRoller3D';
import QuickBar from '../components/QuickBar';
import RollMaker from '../components/RollMaker';
import VttSidebar from '../components/VttSidebar';
import VttFloatingChat from '../components/VttFloatingChat';
import VttFloatingCall from '../components/VttFloatingCall';
import VttDrawingTools from '../components/VttDrawingTools';

import RollResultPopup from '../components/RollResultPopup';
import DiceLogPanel from '../components/DiceLogPanel';
import SceneManager from '../components/SceneManager';
import useBattlefieldStore from '../components/battlefield/useBattlefieldStore';
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
  const activeSceneId = useBattlefieldStore((state) => state.activeSceneId);
  const gmViewSceneId = useBattlefieldStore((state) => state.gmViewSceneId);
  
  const clearPromptVisible = useBattlefieldStore(s => s.clearPromptVisible);
  const setClearPromptVisible = useBattlefieldStore(s => s.setClearPromptVisible);
  const textPrompt = useBattlefieldStore(s => s.textPrompt);
  const setTextPrompt = useBattlefieldStore(s => s.setTextPrompt);
  const drawingColor = useBattlefieldStore(s => s.drawingColor);
  const drawingThickness = useBattlefieldStore(s => s.drawingThickness);
  
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
  const isGM = Boolean(pageData?.viewer?.isSessionOwner || pageData?.viewer?.role === 'GM' || actions.canManageParticipants);

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
    if (!isLoading && !canAccess) {
      navigate(`/session/${id}`);
    }
  }, [isLoading, canAccess, id, navigate]);

  const handleClearDrawings = useCallback(() => {
    const sceneId = isGM ? (gmViewSceneId || activeSceneId) : activeSceneId;
    if (sceneId) {
      vttConnection?.sendVttSceneClearDrawings?.(sceneId);
    }
    setClearPromptVisible(false);
  }, [isGM, gmViewSceneId, activeSceneId, vttConnection, setClearPromptVisible]);

  const handleAddText = useCallback((text) => {
    const sceneId = isGM ? (gmViewSceneId || activeSceneId) : activeSceneId;
    if (text.trim() && sceneId && textPrompt) {
      const fontSize = 24 * (drawingThickness / 4);
      const estimatedWidth = Math.max(text.length * fontSize * 0.6, 50);
      const estimatedHeight = fontSize * 1.5;

      vttConnection?.sendVttSceneAddDrawing?.(sceneId, {
        type: 'text',
        points: [0, 0], // Відносні координати (0, 0) оскільки використовуємо anchor=0.5 в DrawingLayer
        x: textPrompt.points[0],
        y: textPrompt.points[1],
        width: estimatedWidth,
        height: estimatedHeight,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        color: drawingColor,
        thickness: drawingThickness,
        userId: pageData?.viewer?.id || 'me',
        text: text
      });
    }
    setTextPrompt(null);
  }, [isGM, gmViewSceneId, activeSceneId, textPrompt, drawingColor, drawingThickness, pageData, vttConnection, setTextPrompt]);

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
          isGM={isGM}
          viewerId={pageData?.viewer?.id}
        />

        {/* Drawing Tools */}
        <VttDrawingTools isGM={isGM} userId={pageData?.viewer?.id || 'me'} sceneId={isGM ? (gmViewSceneId || activeSceneId) : activeSceneId} vttConnection={vttConnection} />
        
        <ConfirmModal
          isOpen={clearPromptVisible}
          title="Очистити всі малюнки?"
          message="Ви впевнені, що хочете видалити всі малюнки з цієї сцени? Цю дію неможливо відмінити."
          confirmText="Очистити"
          cancelText="Скасувати"
          variant="danger"
          theme="dark"
          onConfirm={handleClearDrawings}
          onCancel={() => setClearPromptVisible(false)}
        />
        
        <InputModal
          isOpen={Boolean(textPrompt)}
          title="Введіть текст"
          message=""
          placeholder="Ваш текст..."
          confirmText="Додати"
          cancelText="Скасувати"
          theme="dark"
          onConfirm={handleAddText}
          onCancel={() => setTextPrompt(null)}
        />

        {/* UI Overlays */}
        <SceneManager vttConnection={vttConnection} />
        <RollMaker onRoll={handleRoll} />
        <QuickBar onRoll={handleRoll} />
      </main>
    </div>
  );
}
