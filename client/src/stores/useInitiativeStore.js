import { create } from 'zustand';

/**
 * Глобальний стан для трекера ініціативи.
 */
const useInitiativeStore = create((set) => ({
  entries: [],

  // Оновити список з бекенду (WebSockets)
  setInitiative: (entries) => set({ entries: entries || [] }),

  // Додати кидок ініціативи
  addRoll: (roll) => {
    // roll має вигляд: { id, name: 'Ініціатива', characterName, player, total: 18, ... }
    const newEntry = {
      id: roll.id || Date.now().toString(),
      name: roll.characterName || roll.player || 'Невідомий',
      value: roll.total || 0,
    };
    
    set((state) => {
      const existingIdx = state.entries.findIndex(e => e.name === newEntry.name);
      let newEntries = [...state.entries];
      if (existingIdx >= 0) {
        newEntries[existingIdx] = newEntry;
      } else {
        newEntries.push(newEntry);
      }
      
      newEntries.sort((a, b) => b.value - a.value);
      return { entries: newEntries };
    });
  },

  // Наступний хід (верхній елемент іде в кінець)
  nextTurn: () => {
    set((state) => {
      if (state.entries.length <= 1) return state;
      const newEntries = [...state.entries];
      const top = newEntries.shift();
      newEntries.push(top);
      return { entries: newEntries };
    });
  },

  // Попередній хід (нижній елемент повертається наверх)
  prevTurn: () => {
    set((state) => {
      if (state.entries.length <= 1) return state;
      const newEntries = [...state.entries];
      const bottom = newEntries.pop();
      newEntries.unshift(bottom);
      return { entries: newEntries };
    });
  },

  // Додати пустий хід (або з ім'ям та значенням)
  addEmptyTurn: (name, value) => {
    set((state) => {
      const newEntries = [...state.entries, {
        id: Date.now().toString(),
        name: name || 'Новий хід',
        value: Number(value) || 0
      }];
      newEntries.sort((a, b) => b.value - a.value);
      return { entries: newEntries };
    });
  },

  // Очистити трекер
  clear: () => set({ entries: [] }),

  // Видалити конкретний хід
  removeTurn: (id) => {
    set((state) => ({
      entries: state.entries.filter(e => e.id !== id)
    }));
  }
}));

export default useInitiativeStore;
