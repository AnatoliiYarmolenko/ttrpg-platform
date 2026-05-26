import { useEffect } from 'react';
import { useCallStore } from '@/stores/useCallStore';

/**
 * Цей хук забезпечує підключення до сигнального сервера сесії в режимі "Глядача".
 * Він автоматично встановлює activeSessionId, якщо користувач ще не перебуває у дзвінку іншої сесії.
 * При відході зі сторінки він очищує з'єднання (лише якщо юзер не приєднався до дзвінка).
 */
export function useCallViewerSync(sessionId) {
  const numericSessionId = sessionId ? Number(sessionId) : null;

  useEffect(() => {
    if (!numericSessionId) return;
    
    const store = useCallStore.getState();
    const activeId = store.activeSessionId ? Number(store.activeSessionId) : null;
    if (activeId !== numericSessionId && store.presenceState === 'NOT_JOINED') {
      store.setActiveSessionId(numericSessionId);
    }
    
    return () => {
      const currentStore = useCallStore.getState();
      const currentActiveId = currentStore.activeSessionId ? Number(currentStore.activeSessionId) : null;
      if (currentActiveId === numericSessionId && currentStore.presenceState === 'NOT_JOINED') {
        currentStore.cleanupCallConnection();
      }
    };
  }, [numericSessionId]);
}
