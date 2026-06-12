export class CallRpcClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.nextRequestId = 1;
    this.pendingRequests = new Map();
    this.eventListeners = new Map();
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 8;
    this.initialReconnectDelay = 1000;
    this.maxReconnectDelay = 20000;
    this.reconnectTimeout = null;
    this.shouldReconnect = true;
  }

  connect() {
    if (this.ws || this.isConnecting) return Promise.resolve();
    this.shouldReconnect = true;
    return this.openSocket(false);
  }

  openSocket(isReconnect) {
    return new Promise((resolve, reject) => {
      this.isConnecting = true;
      this.isDisconnecting = false;
      console.log(`[CallRpcClient] ${isReconnect ? 'Reconnecting' : 'Connecting'} to:`, this.url);
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        console.log('[CallRpcClient] Connected successfully to', this.url);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (isReconnect) this.emit('reconnected');
        resolve();
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.isConnecting = false;
        this.ws = null;
        this.cleanup();
        this.handleUnexpectedClose();
      };

      ws.onerror = (err) => {
        if (this.ws !== ws) return;
        this.isConnecting = false;
        if (!this.isDisconnecting && !isReconnect) {
          reject(err instanceof Error ? err : new Error('WebSocket connection error'));
        }
      };

      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        this.handleMessage(event.data);
      };
    });
  }

  handleUnexpectedClose() {
    if (!this.shouldReconnect || this.isDisconnecting) {
      this.emit('disconnected');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectDelay
      );
      this.emit('reconnecting', { attempt: this.reconnectAttempts });
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        if (!this.shouldReconnect) return;
        this.openSocket(true).catch(() => {});
      }, delay);
    } else {
      this.emit('disconnected');
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.isDisconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
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
           console.error('Call async error:', message);
           this.emit('error', message);
        }
      } else if (message.type === 'call:event' && message.event) {
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
      
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`RPC timeout for method ${method}`));
        }
      }, 15000);
    });
  }

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
