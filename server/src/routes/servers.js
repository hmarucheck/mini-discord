import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/servers  -> servers the current user belongs to (with their channels)
router.get('/', async (req, res, next) => {
  try {
    const servers = await prisma.server.findMany({
      where: { memberships: { some: { userId: req.user.id } } },
      include: { channels: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    });
    res.json({ servers });
  } catch (err) {
    next(err);
  }
});

// POST /api/servers  -> create a server (creator becomes owner + member)
router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Server name is required' });

    const server = await prisma.server.create({
      data: {
        name,
        ownerId: req.user.id,
        memberships: { create: { userId: req.user.id, role: 'owner' } },
      },
      include: { channels: true },
    });
    res.status(201).json({ server });
  } catch (err) {
    next(err);
  }
});

// POST /api/servers/:serverId/channels  -> add a channel to a server (member only)
router.post('/:serverId/channels', async (req, res, next) => {
  try {
    const serverId = Number(req.params.serverId);
    const name = String(req.body?.name ?? '').trim();

    if (!name) return res.status(400).json({ error: 'Channel name is required' });

    const membership = await prisma.membership.findUnique({
      where: { userId_serverId: { userId: req.user.id, serverId } },
    });
    if (!membership) return res.status(403).json({ error: 'Not a member of this server' });

    const channel = await prisma.channel.create({ data: { name, serverId } });
    res.status(201).json({ channel });
  } catch (err) {
    next(err);
  }
});

export default router;