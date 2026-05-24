import { useCallback } from 'react';
import { toast } from '@/stores/useToastStore';

export function useCallController({ rpcClient, sessionId }) {
  const startCall = useCallback(async () => {
    if (!rpcClient) return;
    try {
      await rpcClient.request('call:start', { sessionId });
      toast.success('Відеодзвінок розпочато');
    } catch (err) {
      toast.error(err.message || 'Не вдалося розпочати дзвінок');
      throw err;
    }
  }, [rpcClient, sessionId]);

  const endCall = useCallback(async () => {
    if (!rpcClient) return;
    try {
      await rpcClient.request('call:end', { sessionId });
      toast.success('Відеодзвінок завершено');
    } catch (err) {
      toast.error(err.message || 'Не вдалося завершити дзвінок');
      throw err;
    }
  }, [rpcClient, sessionId]);

  const joinCall = useCallback(async () => {
    if (!rpcClient) return null;
    try {
      const result = await rpcClient.request('call:join', { sessionId });
      return result;
    } catch (err) {
      toast.error(err.message || 'Не вдалося приєднатися до дзвінка');
      throw err;
    }
  }, [rpcClient, sessionId]);

  const leaveCall = useCallback(() => {
    if (!rpcClient) return;
    rpcClient.sendEvent('call:leave', { sessionId });
  }, [rpcClient, sessionId]);

  return {
    startCall,
    endCall,
    joinCall,
    leaveCall
  };
}
