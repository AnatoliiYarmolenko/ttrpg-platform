/**
 * Клас для зберігання стану одного учасника дзвінка.
 * Зберігає transports, producers, та consumers для конкретного користувача.
 */
class CallPeerState {
  constructor({ userId, socketId, user = null }) {
    this.userId = userId;
    this.socketId = socketId; // WS socket ID для зворотного зв'язку (останній підключений)
    this.socketIds = new Set([socketId]); // Усі активні підключення/вкладки користувача
    this.username = user?.username || user?.displayName || null;
    this.avatarUrl = user?.avatarUrl || user?.avatar || null;
    this.joinedAt = Date.now();
    // transportId -> Transport
    this.transports = new Map();
    // producerId -> Producer
    this.producers = new Map();
    // consumerId -> Consumer
    this.consumers = new Map();
    // Стан медіа: мікрофон та камера увімкнені/вимкнені
    this.mediaState = {
      micEnabled: false,
      camEnabled: false
    };
  }

  get summary() {
    return {
      userId: this.userId,
      username: this.username,
      avatarUrl: this.avatarUrl,
      mediaState: this.mediaState,
      producers: Array.from(this.producers.values()).map(p => ({ id: p.id, kind: p.kind })),
      joinedAt: this.joinedAt
    };
  }

  addTransport(transport) {
    this.transports.set(transport.id, transport);
  }

  getTransport(transportId) {
    return this.transports.get(transportId);
  }

  removeTransport(transportId) {
    const transport = this.transports.get(transportId);
    if (transport) {
      transport.close();
      this.transports.delete(transportId);
    }
  }

  addProducer(producer) {
    this.producers.set(producer.id, producer);
    this.updateMediaState();
  }

  getProducer(producerId) {
    return this.producers.get(producerId);
  }

  removeProducer(producerId) {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.close();
      this.producers.delete(producerId);
      this.updateMediaState();
    }
  }

  updateMediaState() {
    this.mediaState.micEnabled = Array.from(this.producers.values()).some(p => p.kind === 'audio');
    this.mediaState.camEnabled = Array.from(this.producers.values()).some(p => p.kind === 'video');
  }

  addConsumer(consumer) {
    this.consumers.set(consumer.id, consumer);
  }

  getConsumer(consumerId) {
    return this.consumers.get(consumerId);
  }

  removeConsumer(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(consumerId);
    }
  }

  closeAll() {
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();

    for (const transport of this.transports.values()) {
      transport.close();
    }
    this.transports.clear();
    
    this.mediaState.micEnabled = false;
    this.mediaState.camEnabled = false;
    this.socketIds.clear();
  }
}

module.exports = {
  CallPeerState
};
