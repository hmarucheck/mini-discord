import jwt from 'jsonwebtoken';
import { env } from '../lib/config.js';

export const COOKIE_NAME = 'mini_discord_token';

// Sign a JWT for the given user id. Payload stays minimal — we load the user
// fresh from the DB on every authed call, so we never trust stale token data.
export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Cookie options shared by set/clear. httpOnly keeps the token out of JS;
// SameSite=Lax + Secure (in prod) makes it work across the Railway domains.
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}