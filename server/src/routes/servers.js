import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getIO } from '../socket/io.js';

const router = Router();
router.use(requireAuth);

// A "group" is a set of members + one or more chats (formerly channel).
// Joining a group requires an invite that the recipient accepts.

// GET /api/servers  -> groups the current user belongs to (with chats + members)
router.get('/', async (req, res, next) => {
  try {
    const servers = await prisma.server.findMany({
      where: { memberships: { some: { userId: req.user.id } } },
      include: {
        channels: { orderBy: { id: 'asc' } },
        memberships: { include: { user: { select: { id: true, name: true, icon: true } } } },
      },
      orderBy: { id: 'asc' },
    });
    const groups = servers.map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      ownerId: s.ownerId,
      createdAt: s.createdAt,
      chats: s.channels,
      members: s.memberships.map((m) => ({ ...m.user, role: m.role })),
    }));
    res.json({ servers: groups });
  } catch (err) {
    next(err);
  }
});

// POST /api/servers  -> create a group (creator is owner + a default chat)
router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Group name is required' });

    const server = await prisma.server.create({
      data: {
        name,
        ownerId: req.user.id,
        memberships: { create: { userId: req.user.id, role: 'owner' } },
        channels: { create: { name: 'general' } },
      },
      include: { channels: true, memberships: { include: { user: { select: { id: true, name: true, icon: true } } } } },
    });

    const group = {
      id: server.id,
      name: server.name,
      icon: server.icon,
      ownerId: server.ownerId,
      createdAt: server.createdAt,
      chats: server.channels,
      members: server.memberships.map((m) => ({ ...m.user, role: m.role })),
    };
    res.status(201).json({ server: group });
  } catch (err) {
    next(err);
  }
});

// POST /api/servers/:serverId/members  -> add someone by username (direct)
router.post('/:serverId/members', async (req, res, next) => {
  try {
    const serverId = Number(req.params.serverId);
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    if (!username) return res.status(400).json({ error: 'Username is required' });

    // Only members of the group can add others.
    const inviter = await prisma.membership.findUnique({
      where: { userId_serverId: { userId: req.user.id, serverId } },
    });
    if (!inviter) return res.status(403).json({ error: 'Not a member of this group' });

    // Find the user by username (case-insensitive, DB-agnostic).
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true, icon: true } });
    const target = allUsers.find((u) => u.name.toLowerCase() === username);
    if (!target) return res.status(404).json({ error: 'No user with that username' });
    if (target.id === req.user.id) return res.status(400).json({ error: "That's you!" });

    const existing = await prisma.membership.findUnique({
      where: { userId_serverId: { userId: target.id, serverId } },
    });
    if (existing) return res.status(409).json({ error: 'Already a member' });

    await prisma.membership.create({
      data: { userId: target.id, serverId, role: 'member' },
    });

    const group = await prisma.server.findUnique({ where: { id: serverId } });

    // Realtime: tell everyone in the group that a new member joined, and the
    // added user's own open sockets so their view refreshes too.
    const io = getIO();
    if (io) {
      const member = { id: target.id, name: target.name, icon: target.icon, role: 'member' };
      io.to(`server:${serverId}`).emit('member:joined', { member });
      io.to(`user:${target.id}`).emit('group:added', {
        groupId: serverId,
        groupName: group?.name ?? '',
      });
    }

    res.status(201).json({ member: { id: target.id, name: target.name, icon: target.icon, role: 'member' } });
  } catch (err) {
    next(err);
  }
});

// POST /api/servers/:serverId/chats  -> add a chat to a group (member only)
router.post('/:serverId/chats', async (req, res, next) => {
  try {
    const serverId = Number(req.params.serverId);
    const name = String(req.body?.name ?? '').trim();

    if (!name) return res.status(400).json({ error: 'Chat name is required' });

    const membership = await prisma.membership.findUnique({
      where: { userId_serverId: { userId: req.user.id, serverId } },
    });
    if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

    const chat = await prisma.channel.create({ data: { name, serverId } });
    res.status(201).json({ chat });
  } catch (err) {
    next(err);
  }
});

export default router;