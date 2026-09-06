// Test-only Vite config: same app, but proxies /api to the test backend
// port (BACKEND_PORT) instead of the dev API's :3001, so this suite can
// run alongside a developer's own `npm run dev` without colliding.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { BACKEND_PORT, FRONTEND_PORT } from './lib/ports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, '..'),
  plugins: [react()],
  server: {
    port: FRONTEND_PORT,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${BACKEND_PORT}`,
    },
  },
});
