/**
 * Клас для зберігання стану одного учасника дзвінка.
 * Зберігає transports, producers, та consumers для конкретного користувача.
 */
class CallPeerState {
  constructor({ userId, socketId }) {
    this.userId = userId;
    this.socketId = socketId; // WS socket ID для зворотного зв'язку
    this.joinedAt = Date.now();
    // transportId -> Transport
    this.transports = new Map();
    // producerId -> Producer
    this.producers = new Map();
    // consumerId -> Consumer
    this.consumers = new Map();
    // Стан медіа: мікрофон та камера увімкнені/вимкнені
    this.mediaState = {
      audio: false,
      video: false
    };
  }

  get summary() {
    return {
      userId: this.userId,
      mediaState: this.mediaState,
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
    if (producer.kind === 'audio') {
      this.mediaState.audio = true;
    } else if (producer.kind === 'video') {
      this.mediaState.video = true;
    }
  }

  getProducer(producerId) {
    return this.producers.get(producerId);
  }

  removeProducer(producerId) {
    const producer = this.producers.get(producerId);
    if (producer) {
      if (producer.kind === 'audio') {
        this.mediaState.audio = false;
      } else if (producer.kind === 'video') {
        this.mediaState.video = false;
      }
      producer.close();
      this.producers.delete(producerId);
    }
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
    
    this.mediaState.audio = false;
    this.mediaState.video = false;
  }
}

module.exports = {
  CallPeerState
};
