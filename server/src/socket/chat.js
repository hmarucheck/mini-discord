// Realtime event handlers. Rooms are named `channel:<id>` and `server:<id>`.
// Sockets emit notifications; the DB remains canonical.
export function registerChatHandlers(io, socket) {
  const uid = socket.data.userId;

  // Every socket joins a personal room so targeted events (like new invites)
  // can reach this specific user regardless of which group they're viewing.
  socket.join(`user:${uid}`);

  // Enter/leave a channel's room to receive its live messages.
  socket.on('channel:join', ({ channelId }) => {
    socket.join(`channel:${channelId}`);
  });

  socket.on('channel:leave', ({ channelId }) => {
    socket.leave(`channel:${channelId}`);
  });

  // Presence: broadcast join/leave within a server room.
  socket.on('server:join', ({ serverId }) => {
    socket.join(`server:${serverId}`);
    socket.to(`server:${serverId}`).emit('presence:update', { userId: uid, online: true });
  });

  socket.on('server:leave', ({ serverId }) => {
    socket.to(`server:${serverId}`).emit('presence:update', { userId: uid, online: false });
    socket.leave(`server:${serverId}`);
  });

  // Disconnect -> tell every server room this user was in that they went offline.
  socket.on('disconnect', () => {
    const rooms = Object.keys(socket.rooms ?? {});
    for (const r of rooms) {
      if (r.startsWith('server:')) {
        socket.to(r).emit('presence:update', { userId: uid, online: false });
      }
    }
  });
}

// Broadcast helpers called from the REST routes so a sent message / reaction
// instantly reaches every socket currently in the channel's room.
export function emitMessage(io, message) {
  io.to(`channel:${message.channelId}`).emit('message:new', { message });
}

export function emitReaction(io, { channelId, messageId, userId, emoji, reacted }) {
  io.to(`channel:${channelId}`).emit('reaction:update', {
    messageId,
    userId,
    emoji,
    reacted,
  });
}