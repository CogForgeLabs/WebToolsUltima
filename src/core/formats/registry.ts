import type { Format } from '../engines/types';

/**
 * The format graph's nodes. Each format carries the metadata needed to detect it
 * (magic bytes, extensions, MIME) and to label it in the UI.
 *
 * Magic signatures use -1 as a wildcard byte. Only the most reliable signatures are listed;
 * detection falls back to extension/MIME when no magic matches (see `detect.ts`).
 */
export const FORMATS: Format[] = [
  // ---- Images ----
  {
    id: 'png',
    label: 'PNG',
    kind: 'image',
    mime: ['image/png'],
    ext: ['png'],
    magic: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    id: 'jpeg',
    label: 'JPEG',
    kind: 'image',
    mime: ['image/jpeg'],
    ext: ['jpg', 'jpeg', 'jfif', 'jpe'],
    magic: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    id: 'webp',
    label: 'WebP',
    kind: 'image',
    mime: ['image/webp'],
    ext: ['webp'],
    magic: [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x45, 0x42, 0x50] }],
  },
  {
    id: 'gif',
    label: 'GIF',
    kind: 'image',
    mime: ['image/gif'],
    ext: ['gif'],
    magic: [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
  },
  {
    id: 'bmp',
    label: 'BMP',
    kind: 'image',
    mime: ['image/bmp'],
    ext: ['bmp'],
    magic: [{ offset: 0, bytes: [0x42, 0x4d] }],
  },
  {
    id: 'heic',
    label: 'HEIC',
    kind: 'image',
    mime: ['image/heic', 'image/heif'],
    ext: ['heic', 'heif'],
    // ftyp box with heic/heix/mif1 brand; matched loosely at offset 4.
    magic: [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
  },
  {
    id: 'avif',
    label: 'AVIF',
    kind: 'image',
    mime: ['image/avif'],
    ext: ['avif'],
    magic: [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66] }],
  },
  {
    id: 'svg',
    label: 'SVG',
    kind: 'image',
    mime: ['image/svg+xml'],
    ext: ['svg'],
  },
  {
    id: 'ico',
    label: 'ICO',
    kind: 'image',
    mime: ['image/x-icon'],
    ext: ['ico'],
    magic: [{ offset: 0, bytes: [0x00, 0x00, 0x01, 0x00] }],
  },
  {
    id: 'tiff',
    label: 'TIFF',
    kind: 'image',
    mime: ['image/tiff'],
    ext: ['tif', 'tiff'],
    magic: [
      { offset: 0, bytes: [0x49, 0x49, 0x2a, 0x00] },
      { offset: 0, bytes: [0x4d, 0x4d, 0x00, 0x2a] },
    ],
  },

  // ---- Audio ----
  {
    id: 'mp3',
    label: 'MP3',
    kind: 'audio',
    mime: ['audio/mpeg'],
    ext: ['mp3'],
    magic: [
      { offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3
      { offset: 0, bytes: [0xff, 0xfb] },
    ],
  },
  {
    id: 'wav',
    label: 'WAV',
    kind: 'audio',
    mime: ['audio/wav', 'audio/x-wav'],
    ext: ['wav'],
    magic: [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x41, 0x56, 0x45] }],
  },
  {
    id: 'ogg',
    label: 'OGG',
    kind: 'audio',
    mime: ['audio/ogg'],
    ext: ['ogg', 'oga'],
    magic: [{ offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] }],
  },
  {
    id: 'flac',
    label: 'FLAC',
    kind: 'audio',
    mime: ['audio/flac'],
    ext: ['flac'],
    magic: [{ offset: 0, bytes: [0x66, 0x4c, 0x61, 0x43] }],
  },
  {
    id: 'm4a',
    label: 'M4A',
    kind: 'audio',
    mime: ['audio/mp4', 'audio/x-m4a'],
    ext: ['m4a'],
  },
  {
    id: 'aac',
    label: 'AAC',
    kind: 'audio',
    mime: ['audio/aac'],
    ext: ['aac'],
  },

  // ---- Video ----
  {
    id: 'mp4',
    label: 'MP4',
    kind: 'video',
    mime: ['video/mp4'],
    ext: ['mp4', 'm4v'],
    magic: [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
  },
  {
    id: 'webm',
    label: 'WebM',
    kind: 'video',
    mime: ['video/webm'],
    ext: ['webm'],
    magic: [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
  },
  {
    id: 'mov',
    label: 'MOV (QuickTime)',
    kind: 'video',
    mime: ['video/quicktime'],
    ext: ['mov', 'qt'],
    magic: [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74] }],
  },
  {
    id: 'avi',
    label: 'AVI',
    kind: 'video',
    mime: ['video/x-msvideo'],
    ext: ['avi'],
    magic: [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x41, 0x56, 0x49, 0x20] }],
  },
  {
    id: 'mkv',
    label: 'MKV (Matroska)',
    kind: 'video',
    mime: ['video/x-matroska'],
    ext: ['mkv'],
    magic: [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
  },
  {
    id: 'apng',
    label: 'APNG',
    kind: 'video',
    mime: ['image/apng'],
    ext: ['apng'],
  },

  // ---- Documents ----
  {
    id: 'pdf',
    label: 'PDF',
    kind: 'document',
    mime: ['application/pdf'],
    ext: ['pdf'],
    magic: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
  },
  {
    id: 'docx',
    label: 'Word (DOCX)',
    kind: 'document',
    mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ext: ['docx'],
    // DOCX is a zip; brand detection happens at a higher level.
    magic: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  {
    id: 'txt',
    label: 'Plain text',
    kind: 'document',
    mime: ['text/plain'],
    ext: ['txt'],
  },
  {
    id: 'html',
    label: 'HTML',
    kind: 'document',
    mime: ['text/html'],
    ext: ['html', 'htm'],
  },
  {
    id: 'md',
    label: 'Markdown',
    kind: 'document',
    mime: ['text/markdown'],
    ext: ['md', 'markdown'],
  },

  // ---- Ebooks ----
  {
    id: 'epub',
    label: 'EPUB',
    kind: 'ebook',
    mime: ['application/epub+zip'],
    ext: ['epub'],
    magic: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },

  // ---- Archives ----
  {
    id: 'zip',
    label: 'ZIP',
    kind: 'archive',
    mime: ['application/zip'],
    ext: ['zip'],
    magic: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
  {
    id: 'gzip',
    label: 'GZIP',
    kind: 'archive',
    mime: ['application/gzip'],
    ext: ['gz'],
    magic: [{ offset: 0, bytes: [0x1f, 0x8b] }],
  },
  {
    id: 'tar',
    label: 'TAR',
    kind: 'archive',
    mime: ['application/x-tar'],
    ext: ['tar'],
    magic: [{ offset: 257, bytes: [0x75, 0x73, 0x74, 0x61, 0x72] }],
  },

  // ---- Data ----
  {
    id: 'json',
    label: 'JSON',
    kind: 'data',
    mime: ['application/json'],
    ext: ['json'],
  },
  {
    id: 'csv',
    label: 'CSV',
    kind: 'data',
    mime: ['text/csv'],
    ext: ['csv'],
  },
  {
    /** Special pseudo-format representing "any file" — used as the source node for the
     *  generic file compressor / archiver, which accept anything. */
    id: 'any',
    label: 'Any file',
    kind: 'data',
    mime: ['application/octet-stream'],
    ext: [],
  },
];

const BY_ID = new Map(FORMATS.map((f) => [f.id, f]));
const BY_EXT = new Map<string, Format>();
const BY_MIME = new Map<string, Format>();
for (const f of FORMATS) {
  for (const e of f.ext) if (!BY_EXT.has(e)) BY_EXT.set(e, f);
  for (const m of f.mime) if (!BY_MIME.has(m)) BY_MIME.set(m, f);
}

export function getFormat(id: string): Format | undefined {
  return BY_ID.get(id);
}

export function formatByExt(ext: string): Format | undefined {
  return BY_EXT.get(ext.toLowerCase().replace(/^\./, ''));
}

export function formatByMime(mime: string): Format | undefined {
  return BY_MIME.get(mime.split(';')[0].trim().toLowerCase());
}

export function formatsByKind(kind: Format['kind']): Format[] {
  return FORMATS.filter((f) => f.kind === kind);
}

export function formatLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id.toUpperCase();
}
