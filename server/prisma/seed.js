import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Seed a demo server with a couple of channels and users so the UI has
// something to look at on first run. Idempotent per unique email.
async function main() {
  const pw = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { email: 'alice@example.com', name: 'Alice', hash: pw, icon: '🦊' },
  });
  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: { email: 'bob@example.com', name: 'Bob', hash: pw, icon: '🐺' },
  });

  const server = await prisma.server.upsert({
    where: { id: 1 },
    update: { name: 'Test Lounge' },
    create: { name: 'Test Lounge', ownerId: alice.id },
  });

  // Ensure membership join table has both users.
  for (const u of [alice, bob]) {
    await prisma.membership.upsert({
      where: { userId_serverId: { userId: u.id, serverId: server.id } },
      update: {},
      create: { userId: u.id, serverId: server.id, role: u.id === alice.id ? 'owner' : 'member' },
    });
  }

  const general = await prisma.channel.upsert({
    where: { id: 1 },
    update: { name: 'general' },
    create: { name: 'general', serverId: server.id },
  });
  await prisma.channel.upsert({
    where: { id: 2 },
    update: { name: 'random' },
    create: { name: 'random', serverId: server.id },
  });

  await prisma.message.upsert({
    where: { id: 1 },
    update: { content: 'Welcome to Mini-Discord! 👋' },
    create: {
      content: 'Welcome to Mini-Discord! 👋',
      authorId: alice.id,
      channelId: general.id,
    },
  });

  console.log('Seed complete. Login with alice@example.com / password123');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });