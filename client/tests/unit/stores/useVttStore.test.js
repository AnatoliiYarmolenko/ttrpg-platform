import { describe, it, expect, beforeEach } from 'vitest';
import useVttStore from '@/stores/useVttStore';

describe('useVttStore', () => {
  beforeEach(() => {
    const store = useVttStore.getState();
    store.reset();
    store.clearRollHistory();
  });

  it('should initialize with default state', () => {
    const state = useVttStore.getState();
    expect(state.isVttOpen).toBe(false);
    expect(state.rollHistory).toEqual([]);
    expect(state.isChatOpen).toBe(false);
    expect(state.isDiceLogOpen).toBe(false);
  });

  it('should toggle chat state', () => {
    const { toggleChat } = useVttStore.getState();
    expect(useVttStore.getState().isChatOpen).toBe(false);
    
    toggleChat();
    expect(useVttStore.getState().isChatOpen).toBe(true);
    
    toggleChat();
    expect(useVttStore.getState().isChatOpen).toBe(false);
  });

  it('should add roll to history and limit to 8 items', () => {
    const { addRollResult } = useVttStore.getState();
    
    // Додаємо 10 кидків
    for (let i = 1; i <= 10; i++) {
      addRollResult({ id: i, total: i * 2, formula: `1d20+${i}` });
    }

    const state = useVttStore.getState();
    
    // Має зберегтися лише 8 останніх кидків
    expect(state.rollHistory.length).toBe(8);
    // Останній кидок має бути першим у списку (id: 10)
    expect(state.rollHistory[0].total).toBe(20);
    expect(state.rollHistory[0].id).toBe(10);
    // Найстаріший збережений кидок має бути id: 3 (бо 1 і 2 були витіснені)
    expect(state.rollHistory[7].id).toBe(3);
    
    expect(state.latestRoll.total).toBe(20);
  });


  it('should successfully clear roll history', () => {
    const { addRollResult, clearRollHistory } = useVttStore.getState();
    addRollResult({ id: 1, total: 20 });
    
    expect(useVttStore.getState().rollHistory.length).toBe(1);
    
    clearRollHistory();
    expect(useVttStore.getState().rollHistory.length).toBe(0);
    expect(useVttStore.getState().latestRoll).toBeNull();
  });
});
