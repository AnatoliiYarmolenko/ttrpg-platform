import { renderHook, act } from '@testing-library/react';
import useDraggablePanel from '@/features/vtt/hooks/useDraggablePanel';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useDraggablePanel', () => {
  beforeEach(() => {
    // Mock requestAnimationFrame and global innerWidth/Height
    vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useDraggablePanel({
      defaultWidth: 300,
      defaultHeight: 400,
      defaultX: 10,
      defaultY: 20,
      minWidth: 200,
      minHeight: 200,
      isOpen: true
    }));

    expect(result.current.isLocked).toBe(false);
    expect(result.current.containerRef.current).toBe(null); // Until attached to a DOM node
  });

  it('toggles lock state', () => {
    const onSaveState = vi.fn();
    const { result } = renderHook(() => useDraggablePanel({
      defaultWidth: 300,
      defaultHeight: 400,
      onSaveState
    }));

    act(() => {
      result.current.toggleLock();
    });

    expect(result.current.isLocked).toBe(true);
    expect(onSaveState).toHaveBeenCalledWith(expect.objectContaining({ isLocked: true }));
  });

  it('handles drag interactions', () => {
    const { result } = renderHook(() => useDraggablePanel({
      defaultWidth: 300,
      defaultHeight: 400,
      defaultX: 10,
      defaultY: 10,
      isOpen: true
    }));

    // Mock container
    const container = document.createElement('div');
    result.current.containerRef.current = container;

    // Trigger drag start
    act(() => {
      result.current.onDragMouseDown({ button: 0, clientX: 50, clientY: 50, preventDefault: vi.fn() });
    });

    // Simulate mouse move
    act(() => {
      const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 150 });
      globalThis.dispatchEvent(moveEvent);
    });

    expect(container.style.transform).toBe('translate3d(60px, 110px, 0)'); // 10 + (100 - 50) = 60, 10 + (150 - 50) = 110

    // Simulate mouse up
    act(() => {
      const upEvent = new MouseEvent('mouseup');
      globalThis.dispatchEvent(upEvent);
    });
  });

  it('handles resize interactions', () => {
    const { result } = renderHook(() => useDraggablePanel({
      defaultWidth: 300,
      defaultHeight: 400,
      defaultX: 10,
      defaultY: 10,
      minWidth: 100,
      minHeight: 100,
      isOpen: true
    }));

    const container = document.createElement('div');
    result.current.containerRef.current = container;

    // Trigger resize start (south-east)
    act(() => {
      const onResize = result.current.onResizeMouseDown('se');
      onResize({ button: 0, clientX: 50, clientY: 50, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    });

    // Simulate mouse move
    act(() => {
      const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 150 });
      globalThis.dispatchEvent(moveEvent);
    });

    expect(container.style.width).toBe('350px'); // 300 + 50
    expect(container.style.height).toBe('500px'); // 400 + 100

    act(() => {
      globalThis.dispatchEvent(new MouseEvent('mouseup'));
    });
  });

  it('respects window boundaries', () => {
    const onSaveState = vi.fn();
    const { result } = renderHook(() => useDraggablePanel({
      defaultWidth: 300,
      defaultHeight: 400,
      defaultX: 900, // Close to right edge (1000)
      defaultY: 700, // Close to bottom edge (800)
      isOpen: true,
      onSaveState
    }));

    const container = document.createElement('div');
    result.current.containerRef.current = container;

    // Simulate window resize making the window smaller
    act(() => {
      vi.stubGlobal('innerWidth', 800);
      vi.stubGlobal('innerHeight', 600);
      globalThis.dispatchEvent(new Event('resize'));
    });

    // Max X = 800 - 300 = 500. So 700 (clamped from 900 by isOpen) -> 500
    // Max Y = 600 - 400 = 200. So 400 (clamped from 700 by isOpen) -> 200
    expect(container.style.transform).toBe('translate3d(500px, 200px, 0)');
  });
});
