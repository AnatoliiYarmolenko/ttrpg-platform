export class CallRpcClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.nextRequestId = 1;
    this.pendingRequests = new Map();
    this.eventListeners = new Map();
    this.isConnecting = false;
  }

  connect() {
    if (this.ws || this.isConnecting) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.isConnecting = true;
      this.isDisconnecting = false;
      console.log('[CallRpcClient] Connecting to:', this.url);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[CallRpcClient] Connected successfully to', this.url);
        this.isConnecting = false;
        resolve();
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.emit('disconnected');
        this.cleanup();
      };

      this.ws.onerror = (err) => {
        this.isConnecting = false;
        if (!this.isDisconnecting) {
          reject(err instanceof Error ? err : new Error('WebSocket connection error'));
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.isDisconnecting = true;
      this.ws.close();
      this.cleanup();
    }
  }

  cleanup() {
    this.ws = null;
    const error = new Error('WebSocket disconnected');
    for (const { reject } of this.pendingRequests.values()) {
      reject(error);
    }
    this.pendingRequests.clear();
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Обробляємо RPC-відповідь
      if (message.type === 'call:response' || message.type === 'call:error') {
        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id);
          this.pendingRequests.delete(message.id);
          
          if (message.type === 'call:error') {
            const err = new Error(message.message || 'RPC Error');
            err.code = message.code;
            reject(err);
          } else {
            resolve(message.data);
          }
        } else if (message.type === 'call:error' && message.requestType) {
           // Асинхронна помилка без id
           console.error('Call async error:', message);
           this.emit('error', message);
        }
      } else if (message.type === 'call:event' && message.event) {
        // Обробляємо серверні події
        this.emit(message.event, message.payload);
      } else {
        this.emit(message.type, message);
      }
    } catch (err) {
      console.error('Failed to parse WS message:', err);
    }
  }

  request(method, payload = {}) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket is not connected'));
    }

    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++;
      
      const requestMsg = {
        type: 'call:request',
        id,
        method,
        payload
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(requestMsg));
      
      // Таймаут після 15 секунд
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`RPC timeout for method ${method}`));
        }
      }, 15000);
    });
  }

  // Одноразова подія без відповіді (без id)
  sendEvent(type, payload = {}) {
     if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      for (const callback of this.eventListeners.get(event)) {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in call event listener for ${event}:`, err);
        }
      }
    }
  }
}
