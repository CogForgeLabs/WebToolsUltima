import type { Format, MagicSignature } from '../engines/types';
import { FORMATS, formatByExt, formatByMime, getFormat } from './registry';

function matchSig(bytes: Uint8Array, sig: MagicSignature): boolean {
  const { offset, bytes: pattern } = sig;
  if (offset + pattern.length > bytes.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    const expected = pattern[i];
    if (expected === -1) continue; // wildcard
    if (bytes[offset + i] !== expected) return false;
  }
  return true;
}

function ascii(bytes: Uint8Array, start: number, len: number): string {
  let s = '';
  for (let i = start; i < start + len && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

const extOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/** Resolve container families whose magic alone is ambiguous. Returns a format id or null. */
function refineContainer(bytes: Uint8Array, ext: string): string | null {
  // PK zip family: zip / docx / epub all start with "PK\x03\x04".
  if (matchSig(bytes, { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] })) {
    if (ext === 'docx') return 'docx';
    if (ext === 'epub') return 'epub';
    // Sniff the OPC/OOXML body for the docx marker or epub mimetype.
    const head = ascii(bytes, 0, Math.min(bytes.length, 2000));
    if (head.includes('word/')) return 'docx';
    if (head.includes('application/epub+zip')) return 'epub';
    return 'zip';
  }
  // ISO-BMFF "ftyp" family: heic / avif / mp4 / mov / m4a.
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4).trim().toLowerCase();
    if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1') return 'heic';
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (brand === 'qt') return 'mov';
    if (brand.startsWith('m4a')) return 'm4a';
    return 'mp4';
  }
  // RIFF family: webp / wav / avi.
  if (ascii(bytes, 0, 4) === 'RIFF') {
    const sub = ascii(bytes, 8, 4);
    if (sub === 'WEBP') return 'webp';
    if (sub === 'WAVE') return 'wav';
    if (sub === 'AVI ') return 'avi';
  }
  return null;
}

/** Loose magic scan (skips the ambiguous container families handled above). */
function magicScan(bytes: Uint8Array): Format | undefined {
  for (const f of FORMATS) {
    if (!f.magic) continue;
    for (const sig of f.magic) {
      if (matchSig(bytes, sig)) return f;
    }
  }
  return undefined;
}

/**
 * Detect a format id from raw bytes plus optional filename/MIME hints.
 *
 * Strategy: refine known container families by content, else trust a specific magic
 * signature, else fall back to the file extension, then the MIME type, then "any".
 */
export function detectFromBytes(bytes: Uint8Array, name = '', mime = ''): string {
  const ext = extOf(name);

  const refined = refineContainer(bytes, ext);
  if (refined) return refined;

  const magic = magicScan(bytes);
  if (magic) {
    // A specific magic hit wins, unless the extension names a more specific sibling that
    // shares the same magic (e.g. mkv vs webm both EBML) — prefer the extension then.
    const byExt = formatByExt(ext);
    if (byExt && byExt.kind === magic.kind && byExt.magic?.some((s) => matchSig(bytes, s))) {
      return byExt.id;
    }
    return magic.id;
  }

  const byExt = formatByExt(ext);
  if (byExt) return byExt.id;

  const byMime = formatByMime(mime);
  if (byMime) return byMime.id;

  // Heuristic text sniff for extension-less text/markup.
  if (looksLikeText(bytes)) {
    const head = ascii(bytes, 0, 200).trimStart().toLowerCase();
    if (head.startsWith('<?xml') && head.includes('<svg')) return 'svg';
    if (head.startsWith('<svg')) return 'svg';
    if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'html';
    if (head.startsWith('{') || head.startsWith('[')) return 'json';
    return 'txt';
  }

  return 'any';
}

function looksLikeText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 512);
  if (n === 0) return false;
  let printable = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128) printable++;
  }
  return printable / n > 0.85;
}

/** Read enough of a File to sniff it (first 4 KB covers every signature we use). */
export async function detectFile(file: File): Promise<string> {
  const slice = file.slice(0, 4096);
  const buf = new Uint8Array(await slice.arrayBuffer());
  return detectFromBytes(buf, file.name, file.type);
}

export function describeFormat(id: string): Format | undefined {
  return getFormat(id);
}
