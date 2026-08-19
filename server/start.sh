#!/bin/sh
# Production startup: ensures DATABASE_URL declares an explicit schema before
# running Prisma migrations (fixes Prisma error P3019 "data source URL must use
# a query parameter 'schema'"). Render's generated URL doesn't include one.

case "$DATABASE_URL" in
  *\?*) export DATABASE_URL="${DATABASE_URL}&schema=public" ;;
  *)    export DATABASE_URL="${DATABASE_URL}?schema=public" ;;
esac

npx prisma migrate deploy --schema prisma/schema.postgres.prisma
exec node src/index.js
