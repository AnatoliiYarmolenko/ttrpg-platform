function createRoomManager() {
  const rooms = new Map();

  const joinRoom = (chatId, socket) => {
    if (!chatId || !socket) {
      return;
    }

    let room = rooms.get(chatId);
    if (!room) {
      room = new Set();
      rooms.set(chatId, room);
    }

    room.add(socket);
  };

  const leaveRoom = (chatId, socket) => {
    const room = rooms.get(chatId);
    if (!room || !socket) {
      return;
    }

    room.delete(socket);

    if (room.size === 0) {
      rooms.delete(chatId);
    }
  };

  const leaveAll = (socket) => {
    if (!socket) {
      return;
    }

    for (const [chatId, room] of rooms.entries()) {
      if (room.delete(socket) && room.size === 0) {
        rooms.delete(chatId);
      }
    }
  };

  const broadcast = (chatId, payload) => {
    const room = rooms.get(chatId);
    if (!room || room.size === 0) {
      return;
    }

    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);

    for (const socket of room) {
      if (socket.readyState === socket.OPEN) {
        socket.send(data);
      }
    }
  };

  const broadcastExcept = (chatId, payload, excludedSocket) => {
    const room = rooms.get(chatId);
    if (!room || room.size === 0) {
      return;
    }

    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);

    for (const socket of room) {
      if (socket === excludedSocket) {
        continue;
      }
      if (socket.readyState === socket.OPEN) {
        socket.send(data);
      }
    }
  };

  const roomSize = (chatId) => {
    const room = rooms.get(chatId);
    return room ? room.size : 0;
  };

  return {
    joinRoom,
    leaveRoom,
    leaveAll,
    broadcast,
    broadcastExcept,
    roomSize,
  };
}

module.exports = {
  createRoomManager,
};
