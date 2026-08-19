import { prisma } from '../lib/prisma.js';
import { verifyToken, COOKIE_NAME } from '../lib/auth.js';

// requireAuth middleware: reads the httpOnly cookie, verifies the JWT, loads the
// user, and attaches req.user. On failure responds 401 and does not proceed.
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token && verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
  });
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  req.user = user;
  next();
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    icon: user.icon,
    bio: user.bio,
    createdAt: user.createdAt,
  };
}