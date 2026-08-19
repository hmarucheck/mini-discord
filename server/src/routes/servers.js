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

// POST /api/servers/:serverId/members  -> send an invite by username (pending)
router.post('/:serverId/members', async (req, res, next) => {
  try {
    const serverId = Number(req.params.serverId);
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    if (!username) return res.status(400).json({ error: 'Username is required' });

    // Inviter must be a member, and only owners may invite.
    const inviter = await prisma.membership.findUnique({
      where: { userId_serverId: { userId: req.user.id, serverId } },
    });
    if (!inviter) return res.status(403).json({ error: 'Not a member of this group' });
    if (inviter.role !== 'owner') {
      return res.status(403).json({ error: 'Only the group owner can invite' });
    }

    // Find the invitee by username (case-insensitive, DB-agnostic).
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true, icon: true } });
    const invitee = allUsers.find((u) => u.name.toLowerCase() === username);
    if (!invitee) return res.status(404).json({ error: 'No user with that username' });
    if (invitee.id === req.user.id) return res.status(400).json({ error: "That's you!" });

    const existing = await prisma.membership.findUnique({
      where: { userId_serverId: { userId: invitee.id, serverId } },
    });
    if (existing) return res.status(409).json({ error: 'Already a member' });

    // Don't stack duplicate pending invites.
    const dup = await prisma.invite.findFirst({
      where: { serverId, toUserId: invitee.id, status: 'pending' },
    });
    if (dup) return res.status(409).json({ error: 'Invite already sent & waiting' });

    const invite = await prisma.invite.create({
      data: { serverId, fromUserId: req.user.id, toUserId: invitee.id, status: 'pending' },
    });
    const group = await prisma.server.findUnique({ where: { id: serverId } });

    // Realtime: tell the invitee's open sockets we invited them.
    const io = getIO();
    if (io) {
      io.to(`user:${invitee.id}`).emit('invite:new', {
        inviteId: invite.id,
        groupName: group?.name ?? '',
        fromName: req.user.name,
      });
    }

    res.status(201).json({ inviteId: invite.id });
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