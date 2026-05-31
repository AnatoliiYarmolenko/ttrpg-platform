import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useLocalMedia } from '@/features/call/hooks/useLocalMedia';
import { useCallStore } from '@/stores/useCallStore';
import * as mediasoupClient from 'mediasoup-client';
import { toast } from '@/stores/useToastStore';

vi.mock('@/stores/useCallStore', () => ({
  useCallStore: Object.assign(
    vi.fn(),
    {
      getState: vi.fn(),
      setState: vi.fn(),
    }
  ),
}));

vi.mock('@/stores/useToastStore', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('mediasoup-client', () => ({
  Device: vi.fn().mockImplementation(function() {
    return {
      load: vi.fn(),
      createSendTransport: vi.fn(),
      createRecvTransport: vi.fn(),
    };
  }),
}));

describe('useLocalMedia', () => {
  const mockRpcClient = {
    request: vi.fn(),
  };

  const setupStore = (state = {}) => {
    const defaultState = {
      device: null,
      sendTransport: null,
      recvTransport: null,
      micProducer: null,
      camProducer: null,
      setDevice: vi.fn(),
      setTransports: vi.fn(),
      setMicProducer: vi.fn(),
      setCamProducer: vi.fn(),
      setMediaPermissionError: vi.fn(),
      ...state,
    };
    useCallStore.mockReturnValue(defaultState);
    useCallStore.getState.mockReturnValue(defaultState);
    return defaultState;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  describe('initDevice', () => {
    it('initializes mediasoup device successfully', async () => {
      const store = setupStore();
      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1 })
      );

      const mockDeviceLoad = vi.fn().mockResolvedValue();
      mediasoupClient.Device.mockImplementation(function() {
        return { load: mockDeviceLoad };
      });

      await act(async () => {
        await result.current.initDevice({ some: 'caps' });
      });

      expect(mockDeviceLoad).toHaveBeenCalledWith({ routerRtpCapabilities: { some: 'caps' } });
      expect(store.setDevice).toHaveBeenCalled();
    });

    it('handles device init failure', async () => {
      setupStore();
      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1 })
      );

      const mockDeviceLoad = vi.fn().mockRejectedValue(new Error('Load failed'));
      mediasoupClient.Device.mockImplementation(function() {
        return { load: mockDeviceLoad };
      });

      await expect(
        act(async () => {
          await result.current.initDevice({});
        })
      ).rejects.toThrow('Load failed');

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Не вдалося ініціалізувати'));
    });
  });

  describe('enableMic', () => {
    it('does nothing if no device or transport', async () => {
      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1 })
      );

      await act(async () => {
        await result.current.enableMic();
      });

      expect(globalThis.navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    });

    it('requests mic access and creates producer', async () => {
      const mockTrack = { id: 'track1' };
      const mockStream = {
        getAudioTracks: vi.fn().mockReturnValue([mockTrack]),
      };
      globalThis.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const mockProducer = { id: 'prod1', on: vi.fn() };
      const mockSendTransport = {
        produce: vi.fn().mockResolvedValue(mockProducer),
      };

      const store = setupStore({
        device: {},
        sendTransport: mockSendTransport,
        micProducer: null,
      });

      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1 })
      );

      await act(async () => {
        await result.current.enableMic();
      });

      expect(globalThis.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(mockSendTransport.produce).toHaveBeenCalledWith({
        track: mockTrack,
        codecOptions: { opusStereo: true, opusDtx: true },
      });
      expect(store.setMicProducer).toHaveBeenCalledWith(mockProducer);
      expect(store.setMediaPermissionError).toHaveBeenCalledWith(false);
    });

    it('handles NotAllowedError', async () => {
      const error = new Error('Denied');
      error.name = 'NotAllowedError';
      globalThis.navigator.mediaDevices.getUserMedia.mockRejectedValue(error);

      const store = setupStore({
        device: {},
        sendTransport: { produce: vi.fn() },
      });

      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1 })
      );

      await act(async () => {
        await result.current.enableMic();
      });

      expect(store.setMediaPermissionError).toHaveBeenCalledWith(true);
      expect(toast.error).toHaveBeenCalledWith('Доступ до мікрофона заборонено браузером');
    });

    it('handles generic error', async () => {
      const error = new Error('Unknown Error');
      globalThis.navigator.mediaDevices.getUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1 })
      );

      await act(async () => {
        await result.current.enableMic();
      });

      expect(toast.error).toHaveBeenCalledWith('Не вдалося увімкнути мікрофон');
    });
  });

  describe('disableMic', () => {
    it('stops track, closes producer and notifies server', async () => {
      const mockTrack = { stop: vi.fn() };
      const mockProducer = {
        id: 'prod1',
        track: mockTrack,
        close: vi.fn(),
      };
      
      const store = setupStore({ micProducer: mockProducer });
      mockRpcClient.request.mockResolvedValue();

      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1 })
      );

      act(() => {
        result.current.disableMic();
      });

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(mockProducer.close).toHaveBeenCalled();
      expect(mockRpcClient.request).toHaveBeenCalledWith('call:closeProducer', {
        sessionId: 1,
        producerId: 'prod1',
      });
      expect(store.setMicProducer).toHaveBeenCalledWith(null);
    });
  });

  describe('enableCam', () => {
    it('requests camera access and creates producer', async () => {
      const mockTrack = { id: 'video-track1' };
      const mockStream = {
        getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
      };
      globalThis.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const mockProducer = { id: 'cam-prod1', on: vi.fn() };
      const mockSendTransport = {
        produce: vi.fn().mockResolvedValue(mockProducer),
      };

      const store = setupStore({
        device: {},
        sendTransport: mockSendTransport,
        camProducer: null,
      });

      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1 })
      );

      await act(async () => {
        await result.current.enableCam();
      });

      expect(globalThis.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 15, max: 24 }
        }
      });
      expect(mockSendTransport.produce).toHaveBeenCalledWith({ track: mockTrack });
      expect(store.setCamProducer).toHaveBeenCalledWith(mockProducer);
      expect(store.setMediaPermissionError).toHaveBeenCalledWith(false);
    });
  });

  describe('disableCam', () => {
    it('stops track, closes producer and notifies server', async () => {
      const mockTrack = { stop: vi.fn() };
      const mockProducer = {
        id: 'cam-prod1',
        track: mockTrack,
        close: vi.fn(),
      };
      
      const store = setupStore({ camProducer: mockProducer });
      mockRpcClient.request.mockResolvedValue();

      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1 })
      );

      act(() => {
        result.current.disableCam();
      });

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(mockProducer.close).toHaveBeenCalled();
      expect(mockRpcClient.request).toHaveBeenCalledWith('call:closeProducer', {
        sessionId: 1,
        producerId: 'cam-prod1',
      });
      expect(store.setCamProducer).toHaveBeenCalledWith(null);
    });
  });

  describe('initTransports', () => {
    it('creates send and recv transports and binds their events', async () => {
      const mockDevice = {
        createSendTransport: vi.fn(),
        createRecvTransport: vi.fn(),
      };
      
      const mockSendTransport = { id: 'send-tx', on: vi.fn() };
      const mockRecvTransport = { id: 'recv-tx', on: vi.fn() };

      mockDevice.createSendTransport.mockReturnValue(mockSendTransport);
      mockDevice.createRecvTransport.mockReturnValue(mockRecvTransport);

      mockRpcClient.request.mockResolvedValue({ id: 'tx-id', iceParameters: {}, iceCandidates: [], dtlsParameters: {} });

      const store = setupStore();

      const { result } = renderHook(() => 
        useLocalMedia({ rpcClient: mockRpcClient, sessionId: 1, callConfig: { iceServers: [] } })
      );

      await act(async () => {
        await result.current.initTransports(mockDevice);
      });

      expect(mockRpcClient.request).toHaveBeenCalledWith('call:createWebRtcTransport', { sessionId: 1, producing: true, consuming: false });
      expect(mockRpcClient.request).toHaveBeenCalledWith('call:createWebRtcTransport', { sessionId: 1, producing: false, consuming: true });

      expect(mockDevice.createSendTransport).toHaveBeenCalled();
      expect(mockDevice.createRecvTransport).toHaveBeenCalled();

      expect(mockSendTransport.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSendTransport.on).toHaveBeenCalledWith('produce', expect.any(Function));
      expect(mockRecvTransport.on).toHaveBeenCalledWith('connect', expect.any(Function));

      expect(store.setTransports).toHaveBeenCalledWith({
        sendTransport: mockSendTransport,
        recvTransport: mockRecvTransport,
      });
    });
  });
});
