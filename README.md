# 💬 Mini-Discord

A miniature Discord — real user accounts, servers, chatrooms, messages, emoji reactions, and realtime multiplayer messaging. React + Node/Express + Socket.io + Prisma.

## Features
- **Auth:** real email/password sign-up, bcrypt hashing, JWT in an httpOnly cookie
- **Servers & channels:** create servers/channels, membership-gated access
- **Messages:** paginated history + send, stored in the DB
- **Reactions:** emoji reactions with live counts (add / toggle)
- **Realtime:** Socket.io rooms — messages & reactions appear instantly across all viewers; presence (who's online)
- **Profiles:** avatar emoji + bio on each user

## Tech stack
| Layer | Choice |
|-------|--------|
| Frontend | React 18 + Vite, React Router, Socket.io-client |
| Backend | Node 22, Express, Socket.io |
| DB / ORM | Prisma (SQLite locally, PostgreSQL for hosted deploys) |

## Run locally
```bash
# terminal 1 — backend (http://localhost:4000)
cd server
npm install
cp .env.example .env          # DATABASE_URL defaults to file:./dev.db
npx prisma db push --schema prisma/schema.prisma
# npx prisma db seed          # optional: demo users alice/bob + Test Lounge
npm run dev

# terminal 2 — frontend (http://localhost:5173)
cd client
npm install
npm run dev
```
Open **http://localhost:5173** → log in with `alice@example.com` / `password123` (or register a new account). Tip: open it in two browser tabs as Alice and Bob to watch realtime messaging.

## Deploy to Render (free)
The repo ships a `render.yaml` blueprint and a `Dockerfile`.
1. Push this repo to GitHub.
2. In Render: **New → Blueprint →** select this repo.
3. Render creates a free Postgres (`mini-discord-db`) and a web service, wires `DATABASE_URL`, generates `JWT_SECRET`, and applies migrations on boot.
4. Visit the assigned URL. Done.

Env vars: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV` (set automatically by Render).

## Project layout
```
client/            React frontend (Vite)
server/
  src/routes/      auth, servers, messages (REST)
  src/socket/      Socket.io realtime (rooms, broadcasts)
  src/middleware/  requireAuth
  src/lib/         prisma, jwt/bcrypt, config
  prisma/          schema (sqlite + postgres), seed, migrations
render.yaml        Render blueprint (web service + Postgres)
Dockerfile         Multi-stage build (frontend → runtime)
```
