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
COPY server/package*.json ./
RUN npm install --omit=dev && npx prisma generate --schema prisma/schema.postgres.prisma

# ---- Stage 3: runtime ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist
EXPOSE 4000
WORKDIR /app/server
# Apply migrations, then boot. (Client generator is baked into Stage 2, so no
# runtime network/generation is needed.)
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.postgres.prisma && node src/index.js"]