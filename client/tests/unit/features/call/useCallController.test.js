import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallController } from '@/features/call/hooks/useCallController';
import { useCallStore } from '@/stores/useCallStore';
import { toast } from '@/stores/useToastStore';

vi.mock('@/stores/useCallStore', () => {
  const store = {
    setIsStarting: vi.fn(),
    leaveCallSession: vi.fn(),
    setMyPeerId: vi.fn(),
    disconnectAndCleanup: vi.fn(),
  };
  return {
    useCallStore: Object.assign(
      vi.fn((selector) => selector ? selector(store) : store),
      { getState: () => store }
    ),
  };
});

vi.mock('@/stores/useToastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}));

describe('useCallController', () => {
  const sessionId = 42;
  let rpcClient;

  beforeEach(() => {
    vi.clearAllMocks();
    rpcClient = {
      request: vi.fn(),
      sendEvent: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startCall', () => {
    it('should set starting state and make call:start request', async () => {
      rpcClient.request.mockResolvedValueOnce({});
      const { result } = renderHook(() => useCallController({ rpcClient, sessionId }));
      
      await act(async () => {
        await result.current.startCall();
      });

      const store = useCallStore.getState();
      expect(store.setIsStarting).toHaveBeenCalledWith(true);
      expect(rpcClient.request).toHaveBeenCalledWith('call:start', { sessionId });
      expect(toast.success).toHaveBeenCalledWith('Дзвінок розпочато');
      expect(store.setIsStarting).toHaveBeenLastCalledWith(false);
    });

    it('should handle start call failure', async () => {
      rpcClient.request.mockRejectedValueOnce(new Error('Start error'));
      const { result } = renderHook(() => useCallController({ rpcClient, sessionId }));
      
      await act(async () => {
        await result.current.startCall();
      });

      expect(toast.error).toHaveBeenCalledWith('Start error');
      expect(useCallStore.getState().setIsStarting).toHaveBeenLastCalledWith(false);
    });

    it('should do nothing if rpcClient is missing', async () => {
      const { result } = renderHook(() => useCallController({ rpcClient: null, sessionId }));
      
      await act(async () => {
        await result.current.startCall();
      });

      expect(useCallStore.getState().setIsStarting).not.toHaveBeenCalled();
    });
  });

  describe('endCall', () => {
    it('should make call:end request', async () => {
      rpcClient.request.mockResolvedValueOnce({});
      const { result } = renderHook(() => useCallController({ rpcClient, sessionId }));
      
      await act(async () => {
        await result.current.endCall();
      });

      expect(rpcClient.request).toHaveBeenCalledWith('call:end', { sessionId });
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should handle end call failure', async () => {
      rpcClient.request.mockRejectedValueOnce(new Error('End error'));
      const { result } = renderHook(() => useCallController({ rpcClient, sessionId }));
      
      await act(async () => {
        await result.current.endCall();
      });

      expect(toast.error).toHaveBeenCalledWith('End error');
    });
  });

  describe('joinCall', () => {
    it('should join and set myPeerId on success', async () => {
      rpcClient.request.mockResolvedValueOnce({ myPeerId: 'peer-123' });
      const { result } = renderHook(() => useCallController({ rpcClient, sessionId }));
      
      let joinResult;
      await act(async () => {
        joinResult = await result.current.joinCall();
      });

      expect(rpcClient.request).toHaveBeenCalledWith('call:join', { sessionId });
      expect(useCallStore.getState().setMyPeerId).toHaveBeenCalledWith('peer-123');
      expect(toast.success).toHaveBeenCalledWith('Ви приєднались до дзвінка');
      expect(joinResult).toEqual({ myPeerId: 'peer-123' });
    });

    it('should throw and notify on failure', async () => {
      rpcClient.request.mockRejectedValueOnce(new Error('Join error'));
      const { result } = renderHook(() => useCallController({ rpcClient, sessionId }));
      
      await expect(async () => {
        await act(async () => {
          await result.current.joinCall();
        });
      }).rejects.toThrow('Join error');

      expect(toast.error).toHaveBeenCalledWith('Join error');
    });
  });

  describe('leaveCall', () => {
    it('should clean up store and send call:leave event', () => {
      const { result } = renderHook(() => useCallController({ rpcClient, sessionId }));
      
      act(() => {
        result.current.leaveCall();
      });

      const store = useCallStore.getState();
      expect(store.leaveCallSession).toHaveBeenCalled();
      expect(rpcClient.sendEvent).toHaveBeenCalledWith('call:leave', { sessionId });
      expect(store.disconnectAndCleanup).toHaveBeenCalled();
    });

    it('should clean up store even if rpcClient is missing', () => {
      const { result } = renderHook(() => useCallController({ rpcClient: null, sessionId }));
      
      act(() => {
        result.current.leaveCall();
      });

      const store = useCallStore.getState();
      expect(store.leaveCallSession).toHaveBeenCalled();
      expect(store.disconnectAndCleanup).toHaveBeenCalled();
    });
  });
});
