import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallConnection } from '@/features/call/hooks/useCallConnection';
import useAuthStore from '@/stores/useAuthStore';
import { useCallStore } from '@/stores/useCallStore';
import { useSessionCallConfigQuery } from '@/features/sessions/hooks/useSessionQueries';
import { CallRpcClient } from '@/features/call/lib/callRpcClient';

vi.mock('@/stores/useAuthStore', () => ({
  default: vi.fn(),
}));

vi.mock('@/stores/useCallStore', () => {
  const store = {
    connectionState: 'DISCONNECTED',
    callState: 'IDLE',
    setCallState: vi.fn(),
    setConnectionState: vi.fn(),
    setPeers: vi.fn(),
    addPeer: vi.fn(),
    removePeer: vi.fn(),
    updatePeerMedia: vi.fn(),
    reset: vi.fn(),
    resetMedia: vi.fn(),
  };
  return {
    useCallStore: Object.assign(
      vi.fn((selector) => selector ? selector(store) : store),
      { getState: () => store }
    ),
  };
});

vi.mock('@/features/sessions/hooks/useSessionQueries', () => ({
  useSessionCallConfigQuery: vi.fn(),
}));

vi.mock('@/features/call/lib/callRpcClient', () => {
  return {
    CallRpcClient: vi.fn().mockImplementation(function() {
      const callbacks = {};
      return {
        connect: vi.fn().mockResolvedValue(true),
        disconnect: vi.fn(),
        request: vi.fn().mockResolvedValue({ callState: 'ACTIVE', peers: [] }),
        on: vi.fn((event, cb) => {
          callbacks[event] = cb;
        }),
        emit: (event, payload) => {
          if (callbacks[event]) callbacks[event](payload);
        }
      };
    }),
  };
});

vi.mock('@/stores/useToastStore', () => ({
  toast: {
    error: vi.fn(),
  }
}));

describe('useCallConnection', () => {
  const sessionId = 1;

  beforeEach(() => {
    vi.clearAllMocks();

    useAuthStore.mockImplementation((selector) => selector({ isAuthenticated: true }));
    
    useSessionCallConfigQuery.mockReturnValue({
      data: { wsCallPath: '/ws/call/1' },
      isSuccess: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null rpcClient and not connect if not authenticated', () => {
    useAuthStore.mockImplementation((selector) => selector({ isAuthenticated: false }));
    const { result } = renderHook(() => useCallConnection(sessionId));

    expect(result.current.rpcClient).toBeNull();
    expect(CallRpcClient).not.toHaveBeenCalled();
  });

  it('should initialize CallRpcClient and connect when prerequisites are met', async () => {
    const { result } = renderHook(() => useCallConnection(sessionId));

    await act(async () => {
      await Promise.resolve();
    });

    expect(CallRpcClient).toHaveBeenCalledWith(expect.stringContaining('/ws/call/1'));
    expect(result.current.rpcClient).toBeDefined();
    
    const state = useCallStore.getState();
    expect(state.setConnectionState).toHaveBeenCalledWith('CONNECTING');
    
    await act(async () => {
      await Promise.resolve(); 
      await Promise.resolve(); 
    });

    expect(result.current.rpcClient.connect).toHaveBeenCalled();
    expect(state.setConnectionState).toHaveBeenCalledWith('CONNECTED');
    expect(state.setCallState).toHaveBeenCalledWith('ACTIVE');
  });

  it('should disconnect on unmount', async () => {
    const { result, unmount } = renderHook(() => useCallConnection(sessionId));
    
    await act(async () => {
      await Promise.resolve();
    });

    const client = result.current.rpcClient;
    expect(client).not.toBeNull();

    unmount();

    expect(client.disconnect).toHaveBeenCalled();
    expect(useCallStore.getState().reset).toHaveBeenCalled();
  });

  it('should update state when receiving call:ended event', async () => {
    const { result } = renderHook(() => useCallConnection(sessionId));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve(); 
    });

    const client = result.current.rpcClient;
    
    act(() => {
      client.emit('call:ended');
    });

    const state = useCallStore.getState();
    expect(state.setCallState).toHaveBeenCalledWith('ENDED');
    expect(state.setPeers).toHaveBeenCalledWith([]);
  });
});
