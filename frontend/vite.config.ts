import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The dev and preview servers proxy /api to the Navigator backend so the browser
// talks to one origin (no CORS setup needed on any port). Point it elsewhere with
// NAVIGATOR_API_ORIGIN, e.g. the synthetic backend on :8001 (see README).
// `--mode demo` loads .env.demo, which starts the app in the labeled synthetic demo.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.NAVIGATOR_API_ORIGIN || 'http://127.0.0.1:8000';
  const proxy = { '/api': { target: backend, changeOrigin: true } };
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy,
      // Demo fixtures are imported straight from ../contracts so they cannot drift.
      fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    },
    preview: { port: 4173, proxy },
    build: { target: 'es2022', sourcemap: true },
  };
});
