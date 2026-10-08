import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const r = (p) => resolve(import.meta.dirname, p);

// Clean sandbox URLs in dev (/sandbox/board -> /sandbox/board.html), as Workers Static Assets serves them in production.
const sandboxRoutes = {
  name: 'sandbox-routes',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const m = /^\/sandbox\/([a-z]+)\/?(\?.*)?$/.exec(req.url);
      if (m) req.url = `/sandbox/${m[1]}.html${m[2] ?? ''}`;
      next();
    });
  },
};

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  appType: 'spa',
  plugins: [sandboxRoutes],
  server: {
    port: 5188, // away from the common 5173 / 8787 that other local projects tend to use
    host: true,
    fs: { allow: ['..'] },
    // the Worker API (npm run preview / wrangler dev on 8797, GS_API_PORT overrides) when it is running; the game
    // works without it
    proxy: { '/api': { target: `http://localhost:${process.env.GS_API_PORT || 8797}`, changeOrigin: true } },
  },
  worker: { format: 'es' },
  build: {
    outDir: r('dist'),
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        index: r('client/index.html'),
        'sandbox/board': r('client/sandbox/board.html'),
        'sandbox/food': r('client/sandbox/food.html'),
      },
    },
  },
});
