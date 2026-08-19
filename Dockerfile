# Mini-Discord production image: builds the React frontend, then runs the
# Node/Express + Socket.io backend which serves both the API and the built UI.

# ---- Stage 1: build the frontend ----
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- Stage 2: install backend deps ----
FROM node:22-slim AS server-deps
WORKDIR /app/server
# openssl is required so Prisma can detect the libssl version (else it defaults
# to openssl-1.1.x and the engine fails to load).
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
COPY server/prisma ./prisma
RUN npm install --omit=dev && npx prisma generate --schema prisma/schema.postgres.prisma

# ---- Stage 3: runtime ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist
EXPOSE 4000
WORKDIR /app/server
# start.sh appends ?schema=public to DATABASE_URL (fixes Prisma P3019), runs
# migrations, then boots the app.
CMD ["sh", "start.sh"]