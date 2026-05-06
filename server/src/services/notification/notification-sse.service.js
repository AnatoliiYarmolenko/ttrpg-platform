/**
 * SSE (Server-Sent Events) Manager for Notifications
 * MVP-13: Real-time notification delivery
 */

class NotificationSSEService {
  constructor() {
    // Map userId -> Set of response objects
    this.connections = new Map();
    // Heartbeat interval reference
    this.heartbeatInterval = null;
    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Register new SSE connection for user
   * @param {number} userId - User ID
   * @param {Object} res - Express response object with SSE headers
   */
  registerConnection(userId, res) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    const userConnections = this.connections.get(userId);
    userConnections.add(res);

    // Remove connection when client disconnects
    res.on('close', () => {
      this.removeConnection(userId, res);
    });

    res.on('error', () => {
      this.removeConnection(userId, res);
    });

    // Send initial connection success
    this.sendToConnection(res, {
      type: 'connected',
      timestamp: new Date().toISOString(),
    });

    console.log(`[SSE] User ${userId} connected. Total connections: ${this.getTotalConnections()}`);
  }

  /**
   * Remove SSE connection for user
   * @param {number} userId - User ID
   * @param {Object} res - Express response object
   */
  removeConnection(userId, res) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(res);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
    console.log(`[SSE] User ${userId} disconnected. Total connections: ${this.getTotalConnections()}`);
  }

  /**
   * Push notification to specific user
   * @param {number} userId - User ID
   * @param {Object} payload - Notification payload
   */
  pushToUser(userId, payload) {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      return false;
    }

    const message = {
      type: 'notification',
      data: payload,
      timestamp: new Date().toISOString(),
    };

    let sentCount = 0;
    userConnections.forEach((res) => {
      try {
        this.sendToConnection(res, message);
        sentCount++;
      } catch (error) {
        console.error(`[SSE] Failed to send to user ${userId}:`, error.message);
        this.removeConnection(userId, res);
      }
    });

    return sentCount > 0;
  }

  /**
   * Push to multiple users
   * @param {number[]} userIds - Array of user IDs
   * @param {Object} payload - Notification payload
   */
  pushToUsers(userIds, payload) {
    let totalSent = 0;
    userIds.forEach((userId) => {
      if (this.pushToUser(userId, payload)) {
        totalSent++;
      }
    });
    return totalSent;
  }

  /**
   * Send message to specific connection
   * @param {Object} res - Express response object
   * @param {Object} data - Data to send
   */
  sendToConnection(res, data) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  /**
   * Start heartbeat to keep connections alive
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // 30 seconds

    if (typeof this.heartbeatInterval.unref === 'function') {
      this.heartbeatInterval.unref();
    }

    console.log('[SSE] Heartbeat started (30s interval)');
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat ping to all connections
   */
  sendHeartbeat() {
    const heartbeat = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    };

    this.connections.forEach((userConnections, userId) => {
      userConnections.forEach((res) => {
        try {
          this.sendToConnection(res, heartbeat);
        } catch (error) {
          console.error(`[SSE] Heartbeat failed for user ${userId}:`, error.message);
          this.removeConnection(userId, res);
        }
      });
    });
  }

  /**
   * Get total number of active connections
   */
  getTotalConnections() {
    let total = 0;
    this.connections.forEach((userConnections) => {
      total += userConnections.size;
    });
    return total;
  }

  /**
   * Get number of connected users (unique)
   */
  getConnectedUsersCount() {
    return this.connections.size;
  }

  /**
   * Check if user has active connections
   * @param {number} userId - User ID
   */
  isUserConnected(userId) {
    const userConnections = this.connections.get(userId);
    return userConnections && userConnections.size > 0;
  }
}

// Singleton instance
module.exports = new NotificationSSEService();
