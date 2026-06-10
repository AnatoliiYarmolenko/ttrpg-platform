import { useState, useRef, useCallback, useEffect } from 'react';

export default function useDraggablePanel({
  initialState,
  defaultWidth,
  defaultHeight,
  defaultX,
  defaultY,
  minWidth,
  minHeight,
  onSaveState,
  storageKey,
  isOpen
}) {
  const containerRef = useRef(null);

  const getSavedState = () => {
    if (!storageKey || globalThis.window === undefined) return null;
    try {
      const saved = globalThis.window.localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load panel state', e);
    }
    return null;
  };

  const savedState = getSavedState() || initialState || {};

  const stateRef = useRef({
    x: savedState.x ?? (globalThis.window === undefined ? 0 : (defaultX ?? 0)),
    y: savedState.y ?? (globalThis.window === undefined ? 0 : (defaultY ?? 0)),
    w: savedState.w ?? defaultWidth,
    h: savedState.h ?? defaultHeight,
    isLocked: savedState.isLocked ?? false,
    isCollapsed: savedState.isCollapsed ?? false,
  });

  const [isLocked, setIsLocked] = useState(savedState.isLocked ?? false);
  const [isCollapsed, setIsCollapsed] = useState(savedState.isCollapsed ?? false);

  const saveStateToStorage = useCallback((state) => {
    if (storageKey && globalThis.window !== undefined) {
      try {
        globalThis.window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (e) {
        console.warn('Failed to save panel state', e);
      }
    }
    if (onSaveState) onSaveState(state);
  }, [storageKey, onSaveState]);

  const action = useRef(null);
  const start = useRef({ mx: 0, my: 0, ox: 0, oy: 0, w: 0, h: 0 });
  const rafRef = useRef(null);

  const applyStyles = useCallback(() => {
    if (!containerRef.current) return;
    const { x, y, w, h, isCollapsed } = stateRef.current;
    containerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    containerRef.current.style.width = `${w}px`;
    containerRef.current.style.height = isCollapsed ? 'auto' : `${h}px`;
  }, []);

  const onDragMouseDown = useCallback((e) => {
    if (stateRef.current.isLocked || e.button !== 0) return;
    action.current = 'drag';
    start.current = { mx: e.clientX, my: e.clientY, ox: stateRef.current.x, oy: stateRef.current.y };
    e.preventDefault();
  }, []);

  const onResizeMouseDown = useCallback((direction) => (e) => {
    if (stateRef.current.isLocked || e.button !== 0) return;
    action.current = `resize-${direction}`;
    start.current = { mx: e.clientX, my: e.clientY, ox: stateRef.current.x, oy: stateRef.current.y, w: stateRef.current.w, h: stateRef.current.h };
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const toggleLock = useCallback(() => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    stateRef.current.isLocked = newLocked;
    saveStateToStorage({ ...stateRef.current });
  }, [isLocked, saveStateToStorage]);

  const toggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    stateRef.current.isCollapsed = newCollapsed;
    applyStyles();
    saveStateToStorage({ ...stateRef.current });
  }, [isCollapsed, applyStyles, saveStateToStorage]);

  // Window resize handler to keep panel within bounds
  useEffect(() => {
    const handleWindowResize = () => {
      let changed = false;
      const winW = globalThis.window.innerWidth;
      const winH = globalThis.window.innerHeight;

      if (stateRef.current.w > winW) {
        stateRef.current.w = Math.max(minWidth, winW);
        changed = true;
      }
      if (stateRef.current.h > winH) {
        stateRef.current.h = Math.max(minHeight, winH);
        changed = true;
      }
      
      const max_x = Math.max(0, winW - stateRef.current.w);
      const max_y = Math.max(0, winH - stateRef.current.h);
      
      if (stateRef.current.x > max_x) {
        stateRef.current.x = max_x;
        changed = true;
      }
      if (stateRef.current.y > max_y) {
        stateRef.current.y = max_y;
        changed = true;
      }
      
      if (stateRef.current.x < 0) {
        stateRef.current.x = 0;
        changed = true;
      }
      if (stateRef.current.y < 0) {
        stateRef.current.y = 0;
        changed = true;
      }

      if (changed) {
        applyStyles();
        saveStateToStorage({ ...stateRef.current });
      }
    };

    globalThis.addEventListener('resize', handleWindowResize);
    return () => globalThis.removeEventListener('resize', handleWindowResize);
  }, [minWidth, minHeight, saveStateToStorage, applyStyles]);

  // Handle panel toggle (bring back into bounds if it was moved while closed)
  useEffect(() => {
    if (!isOpen) return;
    
    const winW = globalThis.window.innerWidth;
    const winH = globalThis.window.innerHeight;
    
    const max_x = Math.max(0, winW - stateRef.current.w);
    const max_y = Math.max(0, winH - stateRef.current.h);
    
    if (stateRef.current.x > max_x) stateRef.current.x = max_x;
    if (stateRef.current.y > max_y) stateRef.current.y = max_y;
    
    if (stateRef.current.x < 0) stateRef.current.x = 0;
    if (stateRef.current.y < 0) stateRef.current.y = 0;
    
    applyStyles();
  }, [isOpen, applyStyles]);

  // Handle drag and resize movement
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!action.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const dx = e.clientX - start.current.mx;
        const dy = e.clientY - start.current.my;
        const winW = globalThis.window.innerWidth;
        const winH = globalThis.window.innerHeight;
        
        if (action.current === 'drag') {
          const currentHeight = stateRef.current.isCollapsed ? (containerRef.current?.offsetHeight || 42) : stateRef.current.h;
          const max_x = Math.max(0, winW - stateRef.current.w);
          const max_y = Math.max(0, winH - currentHeight);
          
          stateRef.current.x = Math.max(0, Math.min(max_x, start.current.ox + dx));
          stateRef.current.y = Math.max(0, Math.min(max_y, start.current.oy + dy));
        } else if (action.current.startsWith('resize-')) {
          const dir = action.current.replace('resize-', '');
          let newW = start.current.w;
          let newH = start.current.h;
          let newX = start.current.ox;
          let newY = start.current.oy;

          if (dir.includes('e')) {
            newW = Math.max(minWidth, Math.min(winW - start.current.ox, start.current.w + dx));
          }
          if (dir.includes('s')) {
            newH = Math.max(minHeight, Math.min(winH - start.current.oy, start.current.h + dy));
          }
          if (dir.includes('w')) { 
            newW = Math.max(minWidth, Math.min(start.current.w + start.current.ox, start.current.w - dx)); 
            newX = start.current.ox + (start.current.w - newW); 
          }
          if (dir.includes('n')) { 
            newH = Math.max(minHeight, Math.min(start.current.h + start.current.oy, start.current.h - dy)); 
            newY = start.current.oy + (start.current.h - newH); 
          }

          stateRef.current.w = newW;
          stateRef.current.h = newH;
          stateRef.current.x = newX;
          stateRef.current.y = newY;
        }
        applyStyles();
      });
    };

    const onMouseUp = () => {
      if (!action.current) return;
      action.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      
      saveStateToStorage({ ...stateRef.current });
    };

    globalThis.addEventListener('mousemove', onMouseMove, { passive: true });
    globalThis.addEventListener('mouseup', onMouseUp);
    return () => { 
      globalThis.removeEventListener('mousemove', onMouseMove); 
      globalThis.removeEventListener('mouseup', onMouseUp); 
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [minWidth, minHeight, saveStateToStorage, applyStyles]);

  // Застосовуємо стилі при першому рендері та при зміні applyStyles
  useEffect(() => {
    applyStyles();
  }, [applyStyles]);

  return {
    containerRef,
    isLocked,
    isCollapsed,
    toggleLock,
    toggleCollapse,
    onDragMouseDown,
    onResizeMouseDown
  };
}
