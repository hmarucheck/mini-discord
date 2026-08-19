import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken, COOKIE_NAME } from '../lib/auth.js';
import { requireAuth, publicUser } from '../middleware/auth.js';
import { cookieOptions } from '../lib/auth.js';

const router = Router();

// POST /api/auth/register  -> create user, set auth cookie
router.post('/register', async (req, res, next) => {
  try {
    const { email, name, password } = req.body ?? {};

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'email, name and password are required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, name: String(name).trim(), hash },
    });

    res.cookie(COOKIE_NAME, signToken(user.id), cookieOptions());
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login  -> verify creds, set auth cookie
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(String(password), user.hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.cookie(COOKIE_NAME, signToken(user.id), cookieOptions());
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout  -> clear the auth cookie
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ ok: true });
});

// GET /api/auth/me  -> current session user (requireAuth)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;