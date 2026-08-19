import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Simple health/ping endpoint — used to verify the API + DB round-trip.
router.get('/ping', async (_req, res) => {
  const dbOk = await prisma.$queryRaw`SELECT 1`.catch(() => null);
  res.json({
    ok: true,
    db: dbOk ? 'connected' : 'unreachable',
    time: new Date().toISOString(),
  });
});

export default router;