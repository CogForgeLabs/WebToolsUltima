import type { FormatKind, ParamSpec, Params, Task, TransformArity } from '../core/engines/types';
import { getFormat, formatsByKind } from '../core/formats/registry';
import { compressorsFor, convertEdges, findTransform, reachableTargets } from '../core/engines/registry';
import type { CategoryId } from './categories';

export type ToolKind = 'convert' | 'compress' | 'transform' | 'widget';

export interface ToolDef {
  id: string;
  name: string;
  category: CategoryId;
  kind: ToolKind;
  keywords: string[];
  description: string;
  /** Explicit accepted format ids. */
  accept: string[];
  /** Also accept any format of this kind (in addition to `accept`). */
  acceptKind?: FormatKind;
  /** Allow selecting more than one file (batch, or required for n-1 ops). */
  multiple?: boolean;
  // convert
  target?: string;
  /** Candidate targets the user can pick from (generic converters). */
  targetChoices?: string[];
  // transform
  op?: string;
  arity?: TransformArity;
  // ui
  badge?: string;
  /** Widget id for non-file "instant" tools (see ui/widgets/registry). */
  widget?: string;
}

/** Image formats we can produce as conversion targets. */
const IMAGE_TARGETS = ['png', 'jpeg', 'webp', 'svg', 'pdf', 'gif'];
const AUDIO_TARGETS = ['mp3', 'wav', 'ogg', 'm4a'];
const VIDEO_TARGETS = ['mp4', 'webm', 'gif', 'mp3'];

export const TOOLS: ToolDef[] = [
  // ───────────────────────── Convert ─────────────────────────
  {
    id: 'image-converter',
    name: 'Image Converter',
    category: 'convert',
    kind: 'convert',
    keywords: ['image', 'convert', 'png', 'jpg', 'webp'],
    description: 'Convert between PNG, JPG, WebP, SVG, GIF and PDF.',
    accept: [],
    acceptKind: 'image',
    multiple: true,
    targetChoices: IMAGE_TARGETS,
  },
  {
    id: 'audio-converter',
    name: 'Audio Converter',
    category: 'convert',
    kind: 'convert',
    keywords: ['audio', 'convert', 'mp3', 'wav', 'ogg'],
    description: 'Convert between MP3, WAV, OGG and M4A.',
    accept: [],
    acceptKind: 'audio',
    multiple: true,
    targetChoices: AUDIO_TARGETS,
  },
  {
    id: 'video-converter',
    name: 'Video Converter',
    category: 'convert',
    kind: 'convert',
    keywords: ['video', 'convert', 'mp4', 'webm', 'gif'],
    description: 'Convert between MP4, WebM, animated GIF — or extract the audio.',
    accept: [],
    acceptKind: 'video',
    multiple: true,
    targetChoices: VIDEO_TARGETS,
  },
  {
    id: 'pdf-converter',
    name: 'PDF Converter',
    category: 'convert',
    kind: 'convert',
    keywords: ['pdf', 'convert', 'jpg', 'png'],
    description: 'Turn PDF pages into images, or images into a PDF.',
    accept: ['pdf', 'jpeg', 'png'],
    multiple: true,
    targetChoices: ['jpeg', 'png', 'pdf'],
  },
  {
    id: 'document-converter',
    name: 'Document Converter',
    category: 'convert',
    kind: 'convert',
    keywords: ['document', 'docx', 'word', 'html', 'txt', 'pdf', 'epub'],
    description: 'Convert Word, HTML, Markdown and EPUB documents.',
    accept: ['docx', 'epub', 'html', 'md'],
    multiple: true,
    targetChoices: ['pdf', 'html', 'txt', 'md'],
    badge: 'Best-effort layout',
  },

  // Named convert presets (source-pinned)
  preset('webp-to-png', 'WEBP to PNG', 'convert', ['webp'], 'png'),
  preset('webp-to-jpg', 'WEBP to JPG', 'convert', ['webp'], 'jpeg'),
  preset('png-to-jpg', 'PNG to JPG', 'convert', ['png'], 'jpeg'),
  preset('jpg-to-png', 'JPG to PNG', 'convert', ['jpeg'], 'png'),
  preset('heic-to-jpg', 'HEIC to JPG', 'convert', ['heic'], 'jpeg'),
  preset('heic-to-png', 'HEIC to PNG', 'convert', ['heic'], 'png'),
  preset('png-to-svg', 'PNG to SVG', 'convert', ['png'], 'svg', 'Vectorises (trace)'),
  preset('svg-to-png', 'SVG to PNG', 'convert', ['svg'], 'png'),
  preset('pdf-to-jpg', 'PDF to JPG', 'convert', ['pdf'], 'jpeg', undefined, true),
  preset('jpg-to-pdf', 'JPG to PDF', 'convert', ['jpeg', 'png'], 'pdf', undefined, true),
  preset('docx-to-pdf', 'DOCX to PDF', 'convert', ['docx'], 'pdf', 'Best-effort layout'),
  preset('mp4-to-mp3', 'MP4 to MP3', 'convert', ['mp4', 'webm', 'mov', 'avi', 'mkv'], 'mp3'),
  preset('mov-to-mp4', 'MOV to MP4', 'convert', ['mov'], 'mp4'),
  preset('mp4-to-gif', 'MP4 to GIF', 'convert', ['mp4', 'webm', 'mov', 'avi', 'mkv'], 'gif'),
  preset('gif-to-mp4', 'GIF to MP4', 'convert', ['gif'], 'mp4'),
  preset('mp3-to-ogg', 'MP3 to OGG', 'convert', ['mp3'], 'ogg'),
  preset('wav-to-mp3', 'WAV to MP3', 'convert', ['wav'], 'mp3'),
  preset('json-to-csv', 'JSON to CSV', 'convert', ['json'], 'csv'),
  preset('csv-to-json', 'CSV to JSON', 'convert', ['csv'], 'json'),

  // ───────────────────────── Compress ─────────────────────────
  compressTool('image-compressor', 'Image Compressor', ['jpeg', 'png', 'webp'], 'image', 'Shrink JPG, PNG and WebP images.'),
  compressTool('jpeg-compressor', 'JPEG Compressor', ['jpeg'], undefined, 'Reduce JPG file size.'),
  compressTool('png-compressor', 'PNG Compressor', ['png'], undefined, 'Reduce PNG file size.'),
  compressTool('pdf-compressor', 'PDF Compressor', ['pdf'], undefined, 'Shrink PDFs (rasterising compressor — best for scans).'),
  compressTool('video-compressor', 'Video Compressor', ['mp4', 'webm'], undefined, 'Re-encode video at a smaller bitrate.'),
  compressTool('mp3-compressor', 'MP3 Compressor', ['mp3'], undefined, 'Lower the MP3 bitrate to save space.'),
  compressTool('wav-compressor', 'WAV Compressor', ['wav'], undefined, 'Compress WAV audio.'),
  {
    id: 'file-compressor',
    name: 'File Compressor',
    category: 'compress',
    kind: 'transform',
    op: 'zip',
    arity: 'n-1',
    keywords: ['compress', 'zip', 'file', 'any', 'archive'],
    description: 'Bundle any files into a compressed .zip archive.',
    accept: [],
    acceptKind: 'data',
    multiple: true,
  },

  // ───────────────────────── Modify ─────────────────────────
  transformTool('resize-image', 'Resize Image', 'resize', 'image', 'Set new pixel dimensions.'),
  transformTool('crop-image', 'Crop Image', 'crop', 'image', 'Cut out a rectangular region.'),
  transformTool('rotate-image', 'Rotate Image', 'rotate', 'image', 'Rotate by 90°, 180° or 270°.'),
  transformTool('flip-image', 'Flip Image', 'flip', 'image', 'Mirror horizontally or vertically.'),
  transformTool('enlarge-image', 'Image Enlarger', 'enlarge', 'image', 'Upscale an image.'),
  {
    id: 'gif-maker',
    name: 'GIF Maker',
    category: 'modify',
    kind: 'transform',
    op: 'gif-maker',
    arity: 'n-1',
    keywords: ['gif', 'animation', 'frames'],
    description: 'Combine images into an animated GIF.',
    accept: ['png', 'jpeg', 'webp', 'bmp', 'gif'],
    multiple: true,
  },
  {
    id: 'pdf-merge',
    name: 'PDF Merge',
    category: 'modify',
    kind: 'transform',
    op: 'merge',
    arity: 'n-1',
    keywords: ['pdf', 'merge', 'combine', 'join'],
    description: 'Combine several PDFs into one.',
    accept: ['pdf'],
    multiple: true,
  },
  transformTool('pdf-split', 'PDF Split', 'split', undefined, 'Split a PDF into separate files.', ['pdf']),
  transformTool('pdf-rotate', 'Rotate PDF', 'rotate', undefined, 'Rotate PDF pages.', ['pdf']),
  transformTool('pdf-crop', 'Crop PDF', 'crop', undefined, 'Trim PDF page margins.', ['pdf']),
  transformTool('pdf-organize', 'Organize PDF', 'organize', undefined, 'Reorder PDF pages.', ['pdf']),
  transformTool('pdf-remove-pages', 'PDF Page Remover', 'remove-pages', undefined, 'Delete pages from a PDF.', ['pdf']),
  transformTool('pdf-extract-pages', 'Extract Pages from PDF', 'extract-pages', undefined, 'Keep only selected pages.', ['pdf']),
  transformTool('pdf-flatten', 'Flatten PDF', 'flatten', undefined, 'Flatten form fields and annotations.', ['pdf']),
  transformTool('pdf-resize', 'Resize PDF', 'resize', undefined, 'Change PDF page size.', ['pdf']),
  transformTool('pdf-extract-images', 'Extract Images from PDF', 'extract-images', undefined, 'Pull images out of a PDF.', ['pdf']),
  transformTool('trim-video', 'Trim Video', 'trim', 'video', 'Cut a clip from a video.'),
  transformTool('crop-video', 'Crop Video', 'crop-video', 'video', 'Crop the video frame.'),

  // ───────────────────────── Text & Code ─────────────────────────
  widgetTool('base64', 'Base64 Encode / Decode', 'text', 'base64', ['base64', 'encode', 'decode'], 'Encode text to Base64 or decode it back.'),
  widgetTool('url-encode', 'URL Encode / Decode', 'text', 'url', ['url', 'encode', 'percent', 'uri'], 'Percent-encode or decode URL components.'),
  widgetTool('json-format', 'JSON Formatter', 'text', 'json', ['json', 'beautify', 'minify', 'format', 'validate'], 'Beautify, minify and validate JSON.'),
  widgetTool('hash', 'Hash Generator', 'text', 'hash', ['hash', 'sha', 'sha256', 'checksum'], 'SHA-1/256/384/512 hashes of any text.'),
  widgetTool('case', 'Case Converter', 'text', 'case', ['case', 'uppercase', 'camel', 'snake', 'kebab'], 'Convert text between UPPER, Title, camelCase, snake_case and more.'),
  widgetTool('count', 'Word & Character Counter', 'text', 'count', ['count', 'words', 'characters', 'lines'], 'Count words, characters, lines and bytes.'),

  // ───────────────────────── Generate ─────────────────────────
  widgetTool('uuid', 'UUID Generator', 'generate', 'uuid', ['uuid', 'guid', 'id', 'random'], 'Generate random v4 UUIDs.'),
  widgetTool('password', 'Password Generator', 'generate', 'password', ['password', 'random', 'secure'], 'Generate strong random passwords.'),
  widgetTool('lorem', 'Lorem Ipsum', 'generate', 'lorem', ['lorem', 'ipsum', 'placeholder', 'dummy', 'text'], 'Generate placeholder text.'),

  // ───────────────────────── Calculate ─────────────────────────
  widgetTool('unit-converter', 'Unit Converter', 'calculate', 'unit', ['unit', 'length', 'weight', 'temperature'], 'Convert length, weight, temperature and more.'),
  widgetTool('time-converter', 'Time Converter', 'calculate', 'time', ['time', 'timezone', 'duration', 'unix'], 'Convert durations and timestamps.'),
];

function widgetTool(id: string, name: string, category: CategoryId, widget: string, keywords: string[], description: string): ToolDef {
  return { id, name, category, kind: 'widget', widget, keywords: [name.toLowerCase(), ...keywords], description, accept: [] };
}

function preset(
  id: string,
  name: string,
  category: CategoryId,
  accept: string[],
  target: string,
  badge?: string,
  multiple = false,
): ToolDef {
  return {
    id,
    name,
    category,
    kind: 'convert',
    keywords: [name.toLowerCase(), ...accept, target],
    description: `Convert ${accept.map((a) => getFormat(a)?.label ?? a).join('/')} to ${getFormat(target)?.label ?? target}.`,
    accept,
    target,
    multiple,
    badge,
  };
}

function compressTool(id: string, name: string, accept: string[], acceptKind: FormatKind | undefined, description: string): ToolDef {
  return {
    id,
    name,
    category: 'compress',
    kind: 'compress',
    keywords: [name.toLowerCase(), 'compress', 'shrink', ...accept],
    description,
    accept,
    acceptKind,
    multiple: true,
  };
}

function transformTool(
  id: string,
  name: string,
  op: string,
  acceptKind: FormatKind | undefined,
  description: string,
  accept: string[] = [],
): ToolDef {
  const cap = findTransform(op)?.capability;
  return {
    id,
    name,
    category: 'modify',
    kind: 'transform',
    op,
    arity: cap?.arity ?? '1-1',
    keywords: [name.toLowerCase(), op],
    description,
    accept,
    acceptKind,
    multiple: cap?.arity !== 'n-1' ? true : true,
  };
}

// ───────────────────────── Lookups & resolution ─────────────────────────

const BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

export function toolById(id: string): ToolDef | undefined {
  return BY_ID.get(id);
}

export function toolsByCategory(category: CategoryId): ToolDef[] {
  return TOOLS.filter((t) => t.category === category);
}

export function searchTools(query: string): ToolDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return TOOLS;
  return TOOLS.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q)),
  );
}

/** Does this tool accept a file of the given detected format? */
export function toolAccepts(tool: ToolDef, formatId: string): boolean {
  if (tool.accept.includes(formatId)) return true;
  if (tool.acceptKind) {
    if (tool.acceptKind === 'data') return true; // file compressor accepts anything
    return getFormat(formatId)?.kind === tool.acceptKind;
  }
  return false;
}

/** The set of accepted format ids (for the dropzone hint), expanded from acceptKind. */
export function acceptedFormats(tool: ToolDef): string[] {
  const set = new Set(tool.accept);
  if (tool.acceptKind && tool.acceptKind !== 'data') {
    for (const f of formatsByKind(tool.acceptKind)) set.add(f.id);
  }
  return [...set];
}

/** Target formats actually reachable from the given input (for converters). */
export function resolveTargets(tool: ToolDef, inputFormat: string): string[] {
  if (tool.kind !== 'convert') return [];
  if (tool.target) return [tool.target];
  const reachable = reachableTargets(inputFormat);
  return (tool.targetChoices ?? []).filter((t) => t !== inputFormat && reachable.has(t));
}

/** Param specs to show in the UI, resolved from the matching capability. */
export function resolveParams(tool: ToolDef, inputFormat: string, target?: string): ParamSpec[] {
  if (tool.kind === 'convert') {
    const to = target ?? tool.target;
    if (!to) return [];
    // Prefer the capability that directly encodes the chosen target.
    const edge = convertEdges().find((e) => e.to === to && (e.from === inputFormat || true) && e.capability.params);
    return edge?.capability.params ?? [];
  }
  if (tool.kind === 'compress') {
    return compressorsFor(inputFormat)[0]?.capability.params ?? [];
  }
  if (tool.kind === 'transform' && tool.op) {
    return findTransform(tool.op)?.capability.params ?? [];
  }
  return [];
}

/** Build the executable Task for a tool invocation. */
export function buildTask(tool: ToolDef, params: Params, target?: string): Task {
  switch (tool.kind) {
    case 'convert': {
      const to = target ?? tool.target;
      if (!to) throw new Error('No conversion target chosen.');
      return { kind: 'convert', target: to, params };
    }
    case 'compress':
      return { kind: 'compress', params };
    case 'transform':
      return { kind: 'transform', op: tool.op!, params };
    case 'widget':
      throw new Error('Widget tools do not run pipelines.');
  }
}

/**
 * Dev-time assertion (CLAUDE rule 5): every pipeline tool must be performable by the engines.
 * Returns a list of human-readable problems; empty means the catalog is sound.
 */
export function validateCatalog(): string[] {
  const problems: string[] = [];
  for (const tool of TOOLS) {
    if (tool.kind === 'widget') continue;
    const sample = tool.accept[0] ?? (tool.acceptKind ? formatsByKind(tool.acceptKind)[0]?.id : undefined);
    if (!sample) {
      problems.push(`${tool.id}: no sample input format`);
      continue;
    }
    if (tool.kind === 'convert') {
      const targets = tool.target ? [tool.target] : resolveTargets(tool, sample);
      if (targets.length === 0) problems.push(`${tool.id}: no reachable target from ${sample}`);
    } else if (tool.kind === 'compress') {
      if (compressorsFor(sample).length === 0) problems.push(`${tool.id}: no compressor for ${sample}`);
    } else if (tool.kind === 'transform') {
      const found = tool.op ? findTransform(tool.op) : undefined;
      if (!found) problems.push(`${tool.id}: unknown transform op "${tool.op}"`);
    }
  }
  return problems;
}
