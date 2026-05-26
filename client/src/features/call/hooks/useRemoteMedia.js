import { useEffect, useCallback } from 'react';
import { useCallStore } from '@/stores/useCallStore';

export function useRemoteMedia({ rpcClient, sessionId }) {
  const { addConsumer, removeConsumer } = useCallStore();

  const consumeTrack = useCallback(async (producerId, userId) => {
    const { device, recvTransport } = useCallStore.getState();
    if (!device || !recvTransport || !rpcClient) return;

    try {
      const { id, kind, rtpParameters } = await rpcClient.request('call:consume', {
        sessionId,
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities
      });

      const consumer = await recvTransport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        appData: { userId }
      });

      addConsumer(consumer);

      // Потрібно відновити consumer, бо mediasoup за замовчуванням стартує їх на паузі
      await rpcClient.request('call:resume', { sessionId, consumerId: consumer.id });
      consumer.resume();
      
    } catch (err) {
      console.error('Failed to consume track:', err);
    }
  }, [rpcClient, sessionId, addConsumer]);

  useEffect(() => {
    if (!rpcClient) return;

    // Слухаємо нові producer-и, які додають інші учасники
    const onNewProducer = (payload) => {
      consumeTrack(payload.producerId, payload.userId);
    };

    const onConsumerClosed = (payload) => {
      const consumer = useCallStore.getState().consumers.get(payload.consumerId);
      if (consumer) {
        consumer.close();
        removeConsumer(payload.consumerId);
      }
    };

    rpcClient.on('call:newProducer', onNewProducer);
    rpcClient.on('call:consumerClosed', onConsumerClosed);

    return () => {
      rpcClient.off('call:newProducer', onNewProducer);
      rpcClient.off('call:consumerClosed', onConsumerClosed);
    };
  }, [rpcClient, consumeTrack, removeConsumer]);

  return {
    consumeTrack
  };
}
