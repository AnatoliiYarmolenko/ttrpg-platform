import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useViewport — хук для керування камерою ігрового поля (pan + zoom).
 *
 * Відповідає за:
 * - Панорамування (пересування камери) правою або середньою кнопкою миші
 * - Масштабування (зум) колесом миші з точкою зуму під курсором
 * - Прив'язку нативних DOM-подій до переданого елемента
 *
 * @param {React.RefObject<HTMLElement>} containerRef - ref на DOM-елемент-контейнер
 * @returns {{
 *   viewport: import('../types/vtt.types').Viewport,
 *   setViewport: React.Dispatch<React.SetStateAction<import('../types/vtt.types').Viewport>>
 * }}
 */
export default function useViewport(containerRef) {
  /** @type {[import('../types/vtt.types').Viewport, React.Dispatch<React.SetStateAction<import('../types/vtt.types').Viewport>>]} */
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });

  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // --- Handlers ---

  const handlePointerDown = useCallback((e) => {
    // Панорамування — права (2) або середня (1) кнопка миші
    if (e.button === 1 || e.button === 2) {
      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };

    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (e.button === 1 || e.button === 2) {
      isDraggingRef.current = false;
    }
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

    setViewport((prev) => {
      const newScale = Math.max(0.1, Math.min(5, prev.scale * zoomFactor));

      // Зумуємо навколо позиції курсора (а не центру екрана)
      const mouseX = e.offsetX;
      const mouseY = e.offsetY;

      return {
        x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
        y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
        scale: newScale,
      };
    });
  }, []);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  // --- Прив'язка нативних DOM-подій ---

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('contextmenu', handleContextMenu);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handleContextMenu,
  ]);

  return { viewport, setViewport };
}
