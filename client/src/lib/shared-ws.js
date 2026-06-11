class SharedWsManager {
  ws = null;
  messageListeners = new Set();
  connectionListeners = new Set();
  
  isConnected = false;
  isConnecting = false;
  
  reconnectAttempts = 0;
  maxReconnectAttempts = 8;
  initialReconnectDelay = 1000;
  maxReconnectDelay = 20000;
  reconnectTimeout = null;
  
  manualClose = false;
  fatalError = null;
  refs = 0;


  resolveUrl() {
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
    const wsBase = baseUrl.replace(/^http/, 'ws');
    return `${wsBase.replace(/\/$/, '')}/ws/chat`;
  }

  connect(isReconnect = false) {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      if (this.ws?.readyState === WebSocket.OPEN && !isReconnect) {
        this.notifyConnectionState('connected');
      }
      return;
    }

    this.manualClose = false;
    this.fatalError = null;
    this.isConnecting = true;
    
    this.notifyConnectionState(isReconnect ? 'reconnecting' : 'connecting');

    const wsUrl = this.resolveUrl();
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.isConnecting = false;
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionState('connected');
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        console.error('[SharedWS] Parse error:', e);
        return;
      }
      for (const listener of this.messageListeners) {
        listener(data);
      }
    };

    ws.onerror = (event) => {
      if (this.ws !== ws) return;
      console.warn('[SharedWS] WebSocket error:', event);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.isConnected = false;
      this.isConnecting = false;

      if (this.fatalError) {
        this.notifyConnectionState('error', this.fatalError);
        return;
      }

      if (this.manualClose) {
        this.notifyConnectionState('disconnected');
        return;
      }

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(
          this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
          this.maxReconnectDelay
        );
        
        this.notifyConnectionState('reconnecting');
        this.reconnectTimeout = setTimeout(() => {
          this.connect(true);
        }, delay);
      } else {
        this.notifyConnectionState('error', 'Failed to reconnect');
      }
    };
  }

  disconnect(isFatal = false, errorMsg = null) {
    this.manualClose = !isFatal;
    if (isFatal) {
      this.fatalError = errorMsg;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.notifyConnectionState(isFatal ? 'error' : 'disconnected', errorMsg);
  }

  send(type, payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
      return true;
    }
    return false;
  }

  subscribeMessage(callback) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  subscribeConnection(callback) {
    this.connectionListeners.add(callback);
    // Якщо підключилися до існуючого з'єднання - одразу повідомляємо статус
    if (this.isConnected) callback('connected');
    else if (this.isConnecting) callback('connecting');
    return () => this.connectionListeners.delete(callback);
  }

  notifyConnectionState(state, error = null) {
    for (const listener of this.connectionListeners) {
      listener(state, error);
    }
  }

  addRef() {
    this.refs++;
    if (this.refs === 1 || (!this.ws && !this.isConnecting && !this.reconnectTimeout)) {
      this.connect();
    }
  }

  removeRef() {
    this.refs--;
    if (this.refs <= 0) {
      this.refs = 0;
      this.disconnect(false);
    }
  }
}

export const sharedWsManager = new SharedWsManager();
