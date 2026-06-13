import type { Engine } from '../../core/engines/types';

/**
 * Vector engine — rasterises SVG to PNG/JPEG (via an Image + canvas) and traces raster images
 * back to SVG (via `imagetracerjs`). Runs on the main thread because SVG decoding needs the
 * DOM image pipeline.
 *
 * Honest fidelity: raster→SVG is a vectorisation/trace, not a perfect reconstruction — great
 * for logos and flat graphics, approximate for photos. Flagged in the UI.
 */
export const vectorEngine: Engine = {
  id: 'vector',
  label: 'Vector / SVG',
  execution: 'main',
  capabilities: [
    {
      type: 'convert',
      from: ['svg'],
      to: ['png', 'jpeg'],
      cost: 2,
      quality: 0.95,
      params: [
        { key: 'scale', label: 'Scale', type: 'range', default: 1, min: 0.25, max: 8, step: 0.25, unit: '×' },
        { key: 'background', label: 'Background', type: 'select', default: 'transparent', options: [
          { value: 'transparent', label: 'Transparent (PNG)' },
          { value: 'white', label: 'White' },
        ] },
      ],
    },
    {
      type: 'convert',
      from: ['png', 'jpeg', 'webp', 'bmp', 'gif'],
      to: ['svg'],
      cost: 5,
      quality: 0.6,
      params: [
        { key: 'colors', label: 'Colours', type: 'range', default: 16, min: 2, max: 64, step: 1, help: 'More colours = closer to original, larger file.' },
      ],
    },
  ],
  async load() {
    const { createRuntime } = await import('./runtime');
    return createRuntime();
  },
};
