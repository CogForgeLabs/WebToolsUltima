import type { Engine } from '../../core/engines/types';

/**
 * Data engine — lightweight, dependency-free structured-data conversions (JSON ↔ CSV).
 * Runs on the main thread (trivial CPU cost).
 */
export const dataEngine: Engine = {
  id: 'data',
  label: 'Data',
  execution: 'main',
  capabilities: [
    {
      type: 'convert',
      from: ['json'],
      to: ['csv'],
      cost: 1,
      quality: 0.95,
      params: [{ key: 'delimiter', label: 'Delimiter', type: 'select', default: ',', options: [
        { value: ',', label: 'Comma' },
        { value: ';', label: 'Semicolon' },
        { value: '\t', label: 'Tab' },
      ] }],
    },
    {
      type: 'convert',
      from: ['csv'],
      to: ['json'],
      cost: 1,
      quality: 0.95,
      params: [{ key: 'delimiter', label: 'Delimiter', type: 'select', default: ',', options: [
        { value: ',', label: 'Comma' },
        { value: ';', label: 'Semicolon' },
        { value: '\t', label: 'Tab' },
      ] }],
    },
  ],
  async load() {
    const { createRuntime } = await import('./runtime');
    return createRuntime();
  },
};
