import type { Engine } from '../../core/engines/types';

/**
 * HEIC engine — decodes Apple HEIC/HEIF images (which browsers can't natively render) using
 * `libheif-js` (wasm) and re-encodes to JPEG/PNG via OffscreenCanvas. Runs in the shared
 * transform worker; the wasm payload loads lazily on first use.
 */
export const heicEngine: Engine = {
  id: 'heic',
  label: 'HEIC',
  execution: 'worker',
  capabilities: [
    {
      type: 'convert',
      from: ['heic'],
      to: ['jpeg', 'png'],
      cost: 2,
      quality: 0.95,
      params: [
        { key: 'quality', label: 'Quality', type: 'range', default: 85, min: 1, max: 100, step: 1, unit: '%' },
      ],
    },
  ],
  async load() {
    const { createRuntime } = await import('./runtime');
    return createRuntime();
  },
};
