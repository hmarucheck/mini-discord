import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getIO } from '../socket/io.js';

const router = Router();
router.use(requireAuth);

// GET /api/invites  -> pending invites for the current user
router.get('/', async (req, res, next) => {
  try {
    const invites = await prisma.invite.findMany({
      where: { toUserId: req.user.id, status: 'pending' },
      include: {
        server: { select: { id: true, name: true } },
        fromUser: { select: { id: true, name: true, icon: true } },
      },
      orderBy: { id: 'desc' },
    });
    res.json({
      invites: invites.map((i) => ({
        id: i.id,
        groupId: i.server.id,
        groupName: i.server.name,
        fromName: i.fromUser.name,
        fromIcon: i.fromUser.icon,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/invites/:id/accept  -> join the group, mark accepted
router.post('/:id/accept', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const invite = await prisma.invite.findUnique({
      where: { id },
      include: { server: { include: { channels: { orderBy: { id: 'asc' } } } } },
    });
    if (!invite || invite.toUserId !== req.user.id) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Invite is no longer pending' });
    }

    // If already a member somehow, just mark accepted.
    const existing = await prisma.membership.findUnique({
      where: { userId_serverId: { userId: req.user.id, serverId: invite.serverId } },
    });

    await prisma.$transaction([
      prisma.invite.update({ where: { id }, data: { status: 'accepted' } }),
      ...(existing ? [] : [prisma.membership.create({ data: { userId: req.user.id, serverId: invite.serverId, role: 'member' } })]),
    ]);

    const members = await prisma.membership.findMany({
      where: { serverId: invite.serverId },
      include: { user: { select: { id: true, name: true, icon: true } } },
    });

    // Notify everyone already in the group's server room that a member joined.
    const io = getIO();
    if (io) {
      io.to(`server:${invite.serverId}`).emit('member:joined', {
        member: { id: req.user.id, name: req.user.name, icon: req.user.icon, role: 'member' },
      });
    }

    res.json({
      group: {
        id: invite.server.id,
        name: invite.server.name,
        icon: invite.server.icon,
        ownerId: invite.server.ownerId,
        createdAt: invite.server.createdAt,
        chats: invite.server.channels,
        members: members.map((m) => ({ ...m.user, role: m.role })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/invites/:id/decline  -> mark declined, do not join
router.post('/:id/decline', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const invite = await prisma.invite.findUnique({ where: { id } });
    if (!invite || invite.toUserId !== req.user.id) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    await prisma.invite.update({ where: { id }, data: { status: 'declined' } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;