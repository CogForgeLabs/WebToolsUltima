import type { Engine, ParamSpec } from '../../core/engines/types';

const levelParam: ParamSpec = {
  key: 'level',
  label: 'Compression level',
  type: 'range',
  default: 6,
  min: 0,
  max: 9,
  step: 1,
  help: '0 = store (fast), 9 = smallest.',
};

/**
 * Archive engine — zips/gzips arbitrary files (the "compress any file" tool) and extracts
 * archives back to their members. Pure-JS via `fflate`; runs in the shared transform worker.
 */
export const archiveEngine: Engine = {
  id: 'archive',
  label: 'Archive',
  execution: 'worker',
  capabilities: [
    {
      type: 'transform',
      op: 'zip',
      label: 'Zip files',
      formats: ['any'],
      outputFormat: 'zip',
      arity: 'n-1',
      params: [levelParam, { key: 'name', label: 'Archive name', type: 'text', default: 'archive' }],
    },
    {
      type: 'transform',
      op: 'extract',
      label: 'Extract archive',
      formats: ['zip'],
      outputFormat: 'any',
      arity: '1-n',
    },
    {
      type: 'transform',
      op: 'gzip',
      label: 'Gzip file',
      formats: ['any'],
      outputFormat: 'gzip',
      params: [levelParam],
    },
    {
      type: 'transform',
      op: 'gunzip',
      label: 'Un-gzip file',
      formats: ['gzip'],
      outputFormat: 'any',
    },
  ],
  async load() {
    const { createRuntime } = await import('./runtime');
    return createRuntime();
  },
};
