import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cross-Origin Isolation (COOP: same-origin + COEP: require-corp) lets ffmpeg.wasm's
// *threaded* build use SharedArrayBuffer. We apply it to the dev and preview servers ONLY,
// so threaded builds can be tested locally.
//
// PRODUCTION INTENTIONALLY DOES NOT SET THESE HEADERS. The shipped engine loads the
// single-threaded ffmpeg-core (see src/engines/ffmpeg/runtime.ts), which does not need
// SharedArrayBuffer — so isolation buys us nothing in prod. Leaving COEP: require-corp off
// also keeps the app embeddable in a cross-origin <iframe> (cognitive-industries.org currently
// links out to it, but could embed it). Only add COI to the production hosting config if we
// switch to ffmpeg-core-mt — and note that would then block iframe embedding.
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
