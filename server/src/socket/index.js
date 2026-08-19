import { Server } from 'socket.io';
import { env } from '../lib/config.js';
import { cookieParserJwt } from './socketAuth.js';
import { registerChatHandlers } from './chat.js';
import { setIO } from './io.js';

// attachSocketServer wires Socket.io onto an already-running HTTP server.
// setupSocketAuth is called with the same io instance during bootstrap.
export function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGINS,
      credentials: true,
    },
  });

  // Expose io to REST routes so they can broadcast realtime events.
  setIO(io);

  // Authenticate every socket against the JWT cookie before it can join rooms.
  io.use(cookieParserJwt);

  io.on('connection', (socket) => {
    // Join a presence room per server so others see this user as online.
    registerChatHandlers(io, socket);
  });

  return io;
}