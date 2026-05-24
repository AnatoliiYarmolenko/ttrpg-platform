import { useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { useCallStore } from '@/stores/useCallStore';
import { toast } from '@/stores/useToastStore';

export function useLocalMedia({ rpcClient, sessionId, callConfig }) {
  const { 
    device, 
    sendTransport, 
    micProducer,
    camProducer,
    setDevice,
    setTransports,
    setMicProducer,
    setCamProducer,
  } = useCallStore();

  // Ініціалізуємо mediasoup device
  const initDevice = useCallback(async (routerRtpCapabilities) => {
    try {
      const newDevice = new mediasoupClient.Device();
      await newDevice.load({ routerRtpCapabilities });
      setDevice(newDevice);
      return newDevice;
    } catch (err) {
      console.error('Failed to init mediasoup device', err);
      toast.error('Не вдалося ініціалізувати аудіо/відео пристрій. Перевірте підтримку вашого браузера.');
      throw err;
    }
  }, [setDevice]);

  // Створюємо транспорти
  const initTransports = useCallback(async (currentDevice) => {
    try {
      // 1. Створюємо Send Transport
      const sendTransportParams = await rpcClient.request('call:createWebRtcTransport', { 
        sessionId, 
        producing: true, 
        consuming: false 
      });

      const sendTrans = currentDevice.createSendTransport({
        ...sendTransportParams,
        iceServers: callConfig?.iceServers || []
      });

      sendTrans.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await rpcClient.request('call:connectWebRtcTransport', {
            sessionId,
            transportId: sendTrans.id,
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTrans.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { id } = await rpcClient.request('call:produce', {
            sessionId,
            transportId: sendTrans.id,
            kind,
            rtpParameters,
          });
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      // 2. Створюємо Recv Transport
      const recvTransportParams = await rpcClient.request('call:createWebRtcTransport', { 
        sessionId, 
        producing: false, 
        consuming: true 
      });

      const recvTrans = currentDevice.createRecvTransport({
        ...recvTransportParams,
        iceServers: callConfig?.iceServers || []
      });

      recvTrans.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await rpcClient.request('call:connectWebRtcTransport', {
            sessionId,
            transportId: recvTrans.id,
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      setTransports({ sendTransport: sendTrans, recvTransport: recvTrans });
      return { sendTransport: sendTrans, recvTransport: recvTrans };
    } catch (err) {
      console.error('Failed to init transports', err);
      toast.error('Помилка підключення до медіа-сервера');
      throw err;
    }
  }, [rpcClient, sessionId, callConfig, setTransports]);

  // Запитуємо user media та створюємо producer-и
  const enableMic = useCallback(async () => {
    if (!device || !sendTransport) return;
    if (micProducer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      const producer = await sendTransport.produce({ track });
      setMicProducer(producer);
      rpcClient.sendEvent('call:setMediaState', { sessionId, mediaState: { micEnabled: true } });
    } catch (err) {
      console.error('Failed to enable mic', err);
      toast.error('Не вдалося отримати доступ до мікрофона');
    }
  }, [device, sendTransport, micProducer, setMicProducer, rpcClient, sessionId]);

  const disableMic = useCallback(() => {
    if (micProducer) {
      micProducer.track.stop();
      micProducer.close();
      rpcClient.request('call:closeProducer', { sessionId, producerId: micProducer.id }).catch(console.error);
      setMicProducer(null);
      rpcClient.sendEvent('call:setMediaState', { sessionId, mediaState: { micEnabled: false } });
    }
  }, [micProducer, setMicProducer, rpcClient, sessionId]);

  const enableCam = useCallback(async () => {
    if (!device || !sendTransport) return;
    if (camProducer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      const track = stream.getVideoTracks()[0];
      const producer = await sendTransport.produce({ track });
      setCamProducer(producer);
      rpcClient.sendEvent('call:setMediaState', { sessionId, mediaState: { camEnabled: true } });
    } catch (err) {
      console.error('Failed to enable camera', err);
      toast.error('Не вдалося отримати доступ до камери');
    }
  }, [device, sendTransport, camProducer, setCamProducer, rpcClient, sessionId]);

  const disableCam = useCallback(() => {
    if (camProducer) {
      camProducer.track.stop();
      camProducer.close();
      rpcClient.request('call:closeProducer', { sessionId, producerId: camProducer.id }).catch(console.error);
      setCamProducer(null);
      rpcClient.sendEvent('call:setMediaState', { sessionId, mediaState: { camEnabled: false } });
    }
  }, [camProducer, setCamProducer, rpcClient, sessionId]);

  return {
    initDevice,
    initTransports,
    enableMic,
    disableMic,
    enableCam,
    disableCam,
  };
}
