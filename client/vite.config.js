import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, forward /api and /socket.io to the Express server (port 4000).
// In prod, the backend serves the built dist/, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
});