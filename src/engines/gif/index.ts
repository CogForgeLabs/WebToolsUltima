import type { Engine } from '../../core/engines/types';

/**
 * GIF engine — builds an animated GIF from a set of image frames using `gifenc`. Pure-JS;
 * runs in the shared transform worker. (Video↔GIF lives in the ffmpeg engine.)
 */
export const gifEngine: Engine = {
  id: 'gif',
  label: 'GIF',
  execution: 'worker',
  capabilities: [
    {
      type: 'transform',
      op: 'gif-maker',
      label: 'GIF maker',
      formats: ['png', 'jpeg', 'webp', 'bmp', 'gif'],
      outputFormat: 'gif',
      arity: 'n-1',
      params: [
        { key: 'fps', label: 'Frames per second', type: 'range', default: 10, min: 1, max: 30, step: 1 },
        { key: 'width', label: 'Width', type: 'number', default: 0, min: 0, unit: 'px', help: '0 = keep first frame width' },
        { key: 'loop', label: 'Loop forever', type: 'bool', default: true },
      ],
    },
  ],
  async load() {
    const { createRuntime } = await import('./runtime');
    return createRuntime();
  },
};
