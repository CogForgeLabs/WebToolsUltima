import type { Engine, ParamSpec } from '../../core/engines/types';

const RASTER_DECODE = ['png', 'jpeg', 'webp', 'bmp', 'gif', 'ico', 'avif', 'tiff'];
const RASTER_ENCODE = ['png', 'jpeg', 'webp'];

const qualityParam: ParamSpec = {
  key: 'quality',
  label: 'Quality',
  type: 'range',
  default: 80,
  min: 1,
  max: 100,
  step: 1,
  unit: '%',
  help: 'Lower quality = smaller file. Applies to JPEG/WebP output.',
};

/**
 * Canvas Image engine — decodes any browser-renderable raster image via `createImageBitmap`
 * inside an OffscreenCanvas and re-encodes to PNG/JPEG/WebP. Also provides format-preserving
 * compression and the geometric transforms (resize/crop/rotate/flip/enlarge).
 *
 * Runs in the shared transform worker; no external dependencies.
 */
export const canvasImageEngine: Engine = {
  id: 'canvas-image',
  label: 'Canvas Image',
  execution: 'worker',
  capabilities: [
    {
      type: 'convert',
      from: RASTER_DECODE,
      to: RASTER_ENCODE,
      cost: 1,
      quality: 0.9,
      params: [qualityParam],
    },
    {
      type: 'compress',
      formats: ['jpeg', 'webp', 'png'],
      params: [qualityParam],
    },
    {
      type: 'transform',
      op: 'resize',
      label: 'Resize image',
      formats: RASTER_DECODE,
      outputFormat: 'same',
      params: [
        { key: 'width', label: 'Width', type: 'number', default: 1280, min: 1, unit: 'px' },
        { key: 'height', label: 'Height', type: 'number', default: 0, min: 0, unit: 'px', help: '0 = auto from aspect ratio' },
        { key: 'keepAspect', label: 'Keep aspect ratio', type: 'bool', default: true },
      ],
    },
    {
      type: 'transform',
      op: 'crop',
      label: 'Crop image',
      formats: RASTER_DECODE,
      outputFormat: 'same',
      params: [
        { key: 'x', label: 'X', type: 'number', default: 0, min: 0, unit: 'px' },
        { key: 'y', label: 'Y', type: 'number', default: 0, min: 0, unit: 'px' },
        { key: 'width', label: 'Width', type: 'number', default: 0, min: 0, unit: 'px', help: '0 = to right edge' },
        { key: 'height', label: 'Height', type: 'number', default: 0, min: 0, unit: 'px', help: '0 = to bottom edge' },
      ],
    },
    {
      type: 'transform',
      op: 'rotate',
      label: 'Rotate image',
      formats: RASTER_DECODE,
      outputFormat: 'same',
      params: [
        {
          key: 'angle',
          label: 'Angle',
          type: 'select',
          default: '90',
          options: [
            { value: '90', label: '90° clockwise' },
            { value: '180', label: '180°' },
            { value: '270', label: '90° counter-clockwise' },
          ],
        },
      ],
    },
    {
      type: 'transform',
      op: 'flip',
      label: 'Flip image',
      formats: RASTER_DECODE,
      outputFormat: 'same',
      params: [
        {
          key: 'direction',
          label: 'Direction',
          type: 'select',
          default: 'horizontal',
          options: [
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
          ],
        },
      ],
    },
    {
      type: 'transform',
      op: 'enlarge',
      label: 'Enlarge image',
      formats: RASTER_DECODE,
      outputFormat: 'same',
      params: [
        { key: 'scale', label: 'Scale factor', type: 'range', default: 2, min: 1, max: 8, step: 0.5, unit: '×' },
      ],
    },
  ],
  async load() {
    const { createRuntime } = await import('./runtime');
    return createRuntime();
  },
};
