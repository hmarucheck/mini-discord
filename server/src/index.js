import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env, corsOrigin } from './lib/config.js';
import { attachSocketServer } from './socket/index.js';
import authRoutes from './routes/auth.js';
import pingRoutes from './routes/ping.js';
import serverRoutes from './routes/servers.js';
import messageRoutes from './routes/messages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(
  cors({
    origin: corsOrigin(),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api', messageRoutes);
app.use('/api', pingRoutes);

// Production: serve the built React frontend (single origin -> no CORS/cookie
// issues; the socket and API live on the same host as the page).
if (env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../../client/dist');
  app.use(express.static(dist));
  // SPA fallback: any non-API GET returns the index.html.
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Central error handler — never leak stack traces to clients in prod.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = http.createServer(app);
attachSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`API + Socket.io listening on http://localhost:${env.PORT}`);
});