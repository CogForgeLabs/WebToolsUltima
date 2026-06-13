import type { Engine, ParamSpec } from '../../core/engines/types';

const pagesParam: ParamSpec = {
  key: 'pages',
  label: 'Pages',
  type: 'text',
  default: '',
  help: 'e.g. 1,3,5-8. Empty = all pages.',
};

/**
 * PDF engine — uses `pdf-lib` for structural edits (merge/split/rotate/...) and `pdfjs-dist`
 * for rendering pages to images. Runs on the main thread; pdfjs spins up its own worker.
 *
 * Compression here is a rasterising compressor: pages are rendered to JPEG at the chosen
 * quality and rebuilt into a PDF — a large win for scanned/image-heavy documents.
 */
export const pdfEngine: Engine = {
  id: 'pdf',
  label: 'PDF',
  execution: 'main',
  capabilities: [
    // Render PDF pages to raster (one image per page → multiple outputs, zipped by executor).
    {
      type: 'convert',
      from: ['pdf'],
      to: ['jpeg', 'png'],
      cost: 3,
      quality: 0.85,
      params: [
        { key: 'scale', label: 'Resolution', type: 'range', default: 2, min: 1, max: 4, step: 0.5, unit: '×' },
        pagesParam,
      ],
    },
    // Images → a single PDF (one image per page).
    {
      type: 'convert',
      from: ['jpeg', 'png'],
      to: ['pdf'],
      cost: 3,
      quality: 0.95,
      params: [
        {
          key: 'pageSize',
          label: 'Page size',
          type: 'select',
          default: 'fit',
          options: [
            { value: 'fit', label: 'Fit to image' },
            { value: 'a4', label: 'A4' },
            { value: 'letter', label: 'Letter' },
          ],
        },
      ],
    },
    {
      type: 'compress',
      formats: ['pdf'],
      params: [
        { key: 'imageQuality', label: 'Image quality', type: 'range', default: 60, min: 10, max: 95, step: 5, unit: '%' },
      ],
    },
    { type: 'transform', op: 'merge', label: 'Merge PDFs', formats: ['pdf'], outputFormat: 'pdf', arity: 'n-1' },
    {
      type: 'transform',
      op: 'split',
      label: 'Split PDF',
      formats: ['pdf'],
      outputFormat: 'pdf',
      arity: '1-n',
      params: [
        {
          key: 'mode',
          label: 'Split mode',
          type: 'select',
          default: 'each',
          options: [
            { value: 'each', label: 'Each page → its own PDF' },
            { value: 'ranges', label: 'By ranges' },
          ],
        },
        { key: 'ranges', label: 'Ranges', type: 'text', default: '', help: 'e.g. 1-3,4-6 (for "By ranges")' },
      ],
    },
    {
      type: 'transform',
      op: 'rotate',
      label: 'Rotate PDF',
      formats: ['pdf'],
      outputFormat: 'pdf',
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
        pagesParam,
      ],
    },
    {
      type: 'transform',
      op: 'crop',
      label: 'Crop PDF',
      formats: ['pdf'],
      outputFormat: 'pdf',
      params: [
        { key: 'top', label: 'Top margin', type: 'number', default: 0, min: 0, unit: 'pt' },
        { key: 'right', label: 'Right margin', type: 'number', default: 0, min: 0, unit: 'pt' },
        { key: 'bottom', label: 'Bottom margin', type: 'number', default: 0, min: 0, unit: 'pt' },
        { key: 'left', label: 'Left margin', type: 'number', default: 0, min: 0, unit: 'pt' },
      ],
    },
    {
      type: 'transform',
      op: 'organize',
      label: 'Organize PDF',
      formats: ['pdf'],
      outputFormat: 'pdf',
      params: [{ key: 'order', label: 'Page order', type: 'text', default: '', help: 'New order, e.g. 3,1,2. Empty = unchanged.' }],
    },
    {
      type: 'transform',
      op: 'remove-pages',
      label: 'Remove PDF pages',
      formats: ['pdf'],
      outputFormat: 'pdf',
      params: [{ ...pagesParam, help: 'Pages to remove, e.g. 2,4-5.' }],
    },
    {
      type: 'transform',
      op: 'extract-pages',
      label: 'Extract PDF pages',
      formats: ['pdf'],
      outputFormat: 'pdf',
      params: [{ ...pagesParam, help: 'Pages to keep, e.g. 1-3,7.' }],
    },
    { type: 'transform', op: 'flatten', label: 'Flatten PDF', formats: ['pdf'], outputFormat: 'pdf' },
    {
      type: 'transform',
      op: 'resize',
      label: 'Resize PDF',
      formats: ['pdf'],
      outputFormat: 'pdf',
      params: [
        {
          key: 'size',
          label: 'Target size',
          type: 'select',
          default: 'a4',
          options: [
            { value: 'a4', label: 'A4' },
            { value: 'letter', label: 'Letter' },
            { value: 'legal', label: 'Legal' },
          ],
        },
      ],
    },
    // NOTE: Protect / Unlock (password encryption) need a PDF crypto layer that pdf-lib does
    // not provide; tracked on the roadmap (qpdf-wasm) rather than shipped as a broken tool.
    {
      type: 'transform',
      op: 'extract-images',
      label: 'Extract images from PDF',
      formats: ['pdf'],
      outputFormat: 'png',
      arity: '1-n',
    },
  ],
  async load() {
    const { createRuntime } = await import('./runtime');
    return createRuntime();
  },
};
