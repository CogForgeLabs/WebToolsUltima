import type { Engine } from '../../core/engines/types';

/**
 * Documents engine — converts Office/ebook documents using `mammoth` (DOCX→HTML) and
 * `epubjs` (EPUB reading), plus pdf-lib for assembling PDF output.
 *
 * Honest fidelity: DOCX→PDF and EPUB→PDF reproduce text and structure but not pixel-perfect
 * original layout; this is the hardest fully-client case and is flagged "best-effort" in the
 * UI, with high-fidelity layout on the roadmap. DOCX→HTML / DOCX→TXT are faithful.
 */
export const docsEngine: Engine = {
  id: 'docs',
  label: 'Documents',
  execution: 'main',
  capabilities: [
    { type: 'convert', from: ['docx'], to: ['html'], cost: 3, quality: 0.95 },
    { type: 'convert', from: ['docx'], to: ['txt'], cost: 3, quality: 0.9 },
    { type: 'convert', from: ['docx'], to: ['md'], cost: 3, quality: 0.85 },
    { type: 'convert', from: ['docx'], to: ['pdf'], cost: 6, quality: 0.6 },
    { type: 'convert', from: ['epub'], to: ['html'], cost: 4, quality: 0.8 },
    { type: 'convert', from: ['epub'], to: ['txt'], cost: 4, quality: 0.8 },
    { type: 'convert', from: ['html'], to: ['txt'], cost: 1, quality: 0.9 },
    { type: 'convert', from: ['md'], to: ['html'], cost: 1, quality: 0.9 },
  ],
  async load() {
    const { createRuntime } = await import('./runtime');
    return createRuntime();
  },
};
