import cookie from 'cookie';
import { verifyToken, COOKIE_NAME } from '../lib/auth.js';

// Socket.io middleware: parses the JWT cookie that JS cookie-parser handles for
// HTTP routes (socket.io has its own handshake, so we parse manually here).
export function cookieParserJwt(socket, next) {
  try {
    const header = socket.handshake.headers.cookie;
    if (!header) return next(new Error('Not authenticated'));

    const parsed = cookie.parse(header);
    const payload = verifyToken(parsed[COOKIE_NAME]);
    if (!payload) return next(new Error('Not authenticated'));

    socket.data.userId = Number(payload.sub);
    next();
  } catch (err) {
    next(new Error('Not authenticated'));
  }
}