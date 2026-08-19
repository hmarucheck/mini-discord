// A single authenticated Socket.io connection for the whole app.
import { io } from 'socket.io-client';

let socket = null;

export function connectSocket() {
  if (socket && socket.connected) return socket;
  socket = io('/', {
    withCredentials: true, // send the httpOnly auth cookie on the socket handshake
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}