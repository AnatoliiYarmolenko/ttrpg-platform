import { useCallback } from 'react';
import { toast } from '@/stores/useToastStore';
import { useCallStore } from '@/stores/useCallStore';

export function useCallController({ rpcClient, sessionId }) {
  const { setIsStarting, leaveCallSession} = useCallStore();

  const startCall = useCallback(async () => {
    if (!rpcClient) return;
    setIsStarting(true);
    try {
      await rpcClient.request('call:start', { sessionId });
      toast.success('Дзвінок розпочато');
    } catch (err) {
      toast.error(err.message || 'Помилка початку дзвінка');
    } finally {
      setIsStarting(false);
    }
  }, [rpcClient, sessionId, setIsStarting]);

  const endCall = useCallback(async () => {
    if (!rpcClient) return;
    try {
      await rpcClient.request('call:end', { sessionId });
    } catch (err) {
      toast.error(err.message || 'Помилка завершення дзвінка');
    }
  }, [rpcClient, sessionId]);

  const joinCall = useCallback(async () => {
    if (!rpcClient) return;
    try {
      const response = await rpcClient.request('call:join', { sessionId });
      toast.success('Ви приєднались до дзвінка');
      return response;
    } catch (err) {
      toast.error(err.message || 'Помилка приєднання');
      throw err; // throw to abort CallWidget flow
    }
  }, [rpcClient, sessionId]);

  const leaveCall = useCallback(() => {
    leaveCallSession(); // Змінюємо стан на LEAVING
    
    if (rpcClient) {
      rpcClient.sendEvent('call:leave', { sessionId }); // Відправляємо call:leave
    }
    
    const store = useCallStore.getState();
    const isOnSessionPage = globalThis.location?.pathname?.includes(`/session/${sessionId}`);
    
    if (isOnSessionPage) {
      store.cleanupCallMedia(); // Очищуємо медіа
      store.setPresenceState('NOT_JOINED'); // Повертаємо стан участі
    } else {
      store.cleanupCallConnection(); // Повністю розриваємо з'єднання
    }
  }, [rpcClient, sessionId, leaveCallSession]);

  return {
    startCall,
    endCall,
    joinCall,
    leaveCall
  };
}
