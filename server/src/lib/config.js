import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  // Origin(s) allowed to talk to this API (frontend dev server and/or deployed client).
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};