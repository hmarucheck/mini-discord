#!/bin/sh
# Production startup: ensures DATABASE_URL declares an explicit schema before
# touching Prisma, syncs the Postgres schema, then boots the app.
# We use `db push` (not `migrate deploy`) because the checked-in migration is
# SQLite-dialect; db push reconciles the Postgres schema directly.

case "$DATABASE_URL" in
  *\?*) export DATABASE_URL="${DATABASE_URL}&schema=public" ;;
  *)    export DATABASE_URL="${DATABASE_URL}?schema=public" ;;
esac

npx prisma db push --schema prisma/schema.postgres.prisma --accept-data-loss
exec node src/index.js