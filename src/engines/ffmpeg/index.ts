import type { Engine, ParamSpec } from '../../core/engines/types';

const VIDEO_IN = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
const AUDIO_IN = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];

const audioQuality: ParamSpec = {
  key: 'audioBitrate',
  label: 'Audio bitrate',
  type: 'select',
  default: '192k',
  options: [
    { value: '320k', label: '320 kbps' },
    { value: '256k', label: '256 kbps' },
    { value: '192k', label: '192 kbps' },
    { value: '128k', label: '128 kbps' },
    { value: '96k', label: '96 kbps' },
  ],
};

/**
 * Media engine — the heavy hitter. Wraps `@ffmpeg/ffmpeg` (wasm, ~30 MB) for video/audio
 * conversion, compression, video↔GIF, and trim/crop. Runs on the main thread; ffmpeg manages
 * its own worker internally. The wasm core is fetched only when one of these tools first runs.
 *
 * Convert capabilities are split by media kind so the planner never creates nonsensical edges
 * (e.g. audio → video).
 */
export const ffmpegEngine: Engine = {
  id: 'ffmpeg',
  label: 'Media (FFmpeg)',
  execution: 'main',
  capabilities: [
    { type: 'convert', from: VIDEO_IN, to: ['mp4', 'webm'], cost: 8, quality: 0.85 },
    { type: 'convert', from: VIDEO_IN, to: ['mp3', 'wav', 'ogg', 'm4a'], cost: 8, quality: 0.85, params: [audioQuality] },
    { type: 'convert', from: AUDIO_IN, to: ['mp3', 'wav', 'ogg', 'm4a'], cost: 6, quality: 0.9, params: [audioQuality] },
    { type: 'convert', from: VIDEO_IN, to: ['gif'], cost: 9, quality: 0.7, params: [
      { key: 'fps', label: 'FPS', type: 'range', default: 12, min: 1, max: 30, step: 1 },
      { key: 'width', label: 'Width', type: 'number', default: 480, min: 0, unit: 'px', help: '0 = original' },
    ] },
    { type: 'convert', from: ['gif'], to: ['mp4', 'webm'], cost: 7, quality: 0.85 },
    {
      type: 'compress',
      formats: ['mp4', 'webm', 'mp3', 'wav', 'ogg'],
      params: [
        {
          key: 'crf',
          label: 'Video quality (CRF)',
          type: 'range',
          default: 28,
          min: 18,
          max: 40,
          step: 1,
          help: 'Higher = smaller/lower quality (video only).',
        },
        audioQuality,
      ],
    },
    {
      type: 'transform',
      op: 'trim',
      label: 'Trim video',
      formats: VIDEO_IN,
      outputFormat: 'same',
      params: [
        { key: 'start', label: 'Start (seconds)', type: 'number', default: 0, min: 0, unit: 's' },
        { key: 'duration', label: 'Duration (seconds)', type: 'number', default: 10, min: 0, unit: 's', help: '0 = to end' },
      ],
    },
    {
      type: 'transform',
      op: 'crop-video',
      label: 'Crop video',
      formats: VIDEO_IN,
      outputFormat: 'same',
      params: [
        { key: 'x', label: 'X', type: 'number', default: 0, min: 0, unit: 'px' },
        { key: 'y', label: 'Y', type: 'number', default: 0, min: 0, unit: 'px' },
        { key: 'width', label: 'Width', type: 'number', default: 640, min: 1, unit: 'px' },
        { key: 'height', label: 'Height', type: 'number', default: 480, min: 1, unit: 'px' },
      ],
    },
  ],
  async load() {
    const { createRuntime } = await import('./runtime');
    return createRuntime();
  },
};
