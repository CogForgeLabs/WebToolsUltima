import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cross-Origin Isolation headers are required for ffmpeg.wasm's threaded build to use
// SharedArrayBuffer. They are applied to both the dev server and the preview server.
// For production hosting, configure the equivalent headers on your static host/CDN.
const crossOriginIsolation = {
  name: 'cross-origin-isolation',
  configureServer(server: { middlewares: { use: (fn: (req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });
  },
  configurePreviewServer(server: { middlewares: { use: (fn: (req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), crossOriginIsolation],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // These ship their own wasm / workers; let them resolve at runtime instead of being
    // pre-bundled (avoids esbuild choking on the wasm assets).
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'libheif-js'],
  },
  build: {
    target: 'es2022',
  },
});
