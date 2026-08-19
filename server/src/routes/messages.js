import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getIO } from '../socket/io.js';
import { emitMessage, emitReaction } from '../socket/chat.js';

const router = Router();

// NOTE: requireAuth is applied per-route below (not router-wide) so this router
// mounted at /api does not accidentally block public endpoints like /api/ping.

// Shared: resolve a channel and confirm the user is a member of its server.
async function assertMembership(req, channelId) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { server: { include: { memberships: { where: { userId: req.user.id } } } } },
  });
  if (!channel || channel.server.memberships.length === 0) {
    return { channel: null };
  }
  return { channel };
}

// GET /api/channels/:id/messages  -> paginated messages for a channel
router.get('/channels/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const channelId = Number(req.params.id);
    const { channel } = await assertMembership(req, channelId);
    if (!channel) return res.status(403).json({ error: 'Not a member of this channel' });

    const before = req.query.before ? Number(req.query.before) : undefined;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);

    const messages = await prisma.message.findMany({
      where: { channelId, ...(before ? { id: { lt: before } } : {}) },
      include: { author: { select: { id: true, name: true, icon: true } }, reactions: true },
      orderBy: { id: 'desc' },
      take: limit,
    });

    // Return ascending so the client renders oldest-first.
    res.json({ messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
});

// POST /api/channels/:id/messages  -> send a message
router.post('/channels/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const channelId = Number(req.params.id);
    const content = String(req.body?.content ?? '').trim();
    if (!content) return res.status(400).json({ error: 'Message content is required' });

    const { channel } = await assertMembership(req, channelId);
    if (!channel) return res.status(403).json({ error: 'Not a member of this channel' });

    const message = await prisma.message.create({
      data: { content, authorId: req.user.id, channelId },
      include: { author: { select: { id: true, name: true, icon: true } }, reactions: true },
    });

    // Push the new message to everyone in this channel's room in realtime.
    const io = getIO();
    if (io) emitMessage(io, message);

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/:id/reactions  -> toggle a reaction on a message
router.post('/messages/:id/reactions', requireAuth, async (req, res, next) => {
  try {
    const messageId = Number(req.params.id);
    const emoji = String(req.body?.emoji ?? '').trim();
    if (!emoji) return res.status(400).json({ error: 'emoji is required' });

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const existing = await prisma.reaction.findUnique({
      where: { userId_messageId_emoji: { userId: req.user.id, messageId, emoji } },
    });

    let reacted;
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      reacted = false;
    } else {
      await prisma.reaction.create({
        data: { emoji, userId: req.user.id, messageId },
      });
      reacted = true;
    }

    // Let everyone in the channel see the reaction update in realtime.
    const io = getIO();
    if (io) {
      emitReaction(io, { channelId: message.channelId, messageId, userId: req.user.id, emoji, reacted });
    }

    res.json({ reacted });
  } catch (err) {
    next(err);
  }
});

export default router;