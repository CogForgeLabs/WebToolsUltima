import type { Asset, EngineRuntime, RunContext } from '../../core/engines/types';
import { withExtension, baseName } from '../../core/util/bytes';
import { extOf } from '../../core/util/blob';
import * as mammoth from 'mammoth';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}
const enc = (s: string) => new TextEncoder().encode(s);
const dec = (u: Uint8Array) => new TextDecoder().decode(u);

/** Wrap an HTML body fragment in a complete, standalone HTML document. */
function htmlDoc(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title></head><body>${body}</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a PDF from plain text with a best-effort word-wrapped layout.
 * NOTE: best-effort text layout; high-fidelity rendering on the roadmap.
 */
async function textToPdf(rawText: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const fontSize = 11;
  const lineHeight = 15;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const drawLine = (text: string) => {
    if (y < margin + lineHeight) newPage();
    page.drawText(text, { x: margin, y, size: fontSize, font });
    y -= lineHeight;
  };

  // Word-wrap a single paragraph to the content width.
  const wrapParagraph = (paragraph: string): string[] => {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= contentWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // Hard-break words that are themselves wider than the content width.
        if (font.widthOfTextAtSize(word, fontSize) > contentWidth) {
          let chunk = '';
          for (const ch of word) {
            const next = chunk + ch;
            if (font.widthOfTextAtSize(next, fontSize) > contentWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk = next;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const paragraphs = rawText.split('\n');
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      // Preserve blank lines as vertical spacing.
      if (y < margin + lineHeight) newPage();
      y -= lineHeight;
      continue;
    }
    for (const line of wrapParagraph(paragraph)) drawLine(line);
  }

  return await pdf.save();
}

/** Minimal, best-effort Markdown → HTML converter. */
function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  // Inline: escape first, then apply inline formatting on the escaped text.
  const inline = (text: string): string => {
    let t = escapeHtml(text);
    t = t.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
    t = t.replace(/\*\*([^*]+)\*\*/g, (_m, b) => `<strong>${b}</strong>`);
    t = t.replace(/\*([^*]+)\*/g, (_m, i) => `<em>${i}</em>`);
    return t;
  };

  type ListState = { type: 'ul' | 'ol'; items: string[] } | null;
  let list: ListState = null;
  let para: string[] = [];

  const flushList = () => {
    if (!list) return;
    const inner = list.items.map((i) => `<li>${i}</li>`).join('');
    out.push(`<${list.type}>${inner}</${list.type}>`);
    list = null;
  };
  const flushPara = () => {
    if (para.length === 0) return;
    out.push(`<p>${para.map((l) => inline(l)).join('<br>')}</p>`);
    para = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (line.trim().length === 0) {
      flushList();
      flushPara();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      flushPara();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const ulMatch = /^[-*]\s+(.*)$/.exec(line);
    if (ulMatch) {
      flushPara();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(inline(ulMatch[1]));
      continue;
    }

    const olMatch = /^\d+\.\s+(.*)$/.exec(line);
    if (olMatch) {
      flushPara();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(inline(olMatch[1]));
      continue;
    }

    // Plain text line — part of a paragraph.
    flushList();
    para.push(line);
  }
  flushList();
  flushPara();

  return out.join('\n');
}

/** Resolve a relative href against an OPF directory path. */
function resolvePath(opfDir: string, href: string): string {
  // Strip any fragment.
  const clean = href.split('#')[0];
  if (!opfDir) return normalizePath(clean);
  return normalizePath(`${opfDir}/${clean}`);
}

function normalizePath(path: string): string {
  const parts = path.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

interface EpubExtract {
  html: string[];
  text: string[];
}

/** Parse an EPUB (ZIP) and extract per-spine-item body HTML and text. */
function extractEpub(data: Uint8Array): EpubExtract {
  const files = unzipSync(new Uint8Array(data));
  const parser = new DOMParser();

  const htmlParts: string[] = [];
  const textParts: string[] = [];

  const parseDoc = (bytes: Uint8Array) => {
    const doc = parser.parseFromString(strFromU8(bytes), 'text/html');
    return doc.body;
  };

  try {
    const containerBytes = files['META-INF/container.xml'];
    if (!containerBytes) throw new Error('no container.xml');
    const containerDoc = parser.parseFromString(strFromU8(containerBytes), 'application/xml');
    const rootfile = containerDoc.querySelector('rootfile');
    const opfPath = rootfile?.getAttribute('full-path');
    if (!opfPath) throw new Error('no rootfile full-path');

    const opfBytes = files[normalizePath(opfPath)];
    if (!opfBytes) throw new Error('opf not found');
    const opfDoc = parser.parseFromString(strFromU8(opfBytes), 'application/xml');

    const slash = opfPath.lastIndexOf('/');
    const opfDir = slash >= 0 ? opfPath.slice(0, slash) : '';

    // manifest: id -> resolved href
    const manifest = new Map<string, string>();
    opfDoc.querySelectorAll('manifest > item').forEach((item) => {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (id && href) manifest.set(id, resolvePath(opfDir, href));
    });

    // spine order
    const idrefs: string[] = [];
    opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
      const idref = ref.getAttribute('idref');
      if (idref) idrefs.push(idref);
    });

    for (const idref of idrefs) {
      try {
        const path = manifest.get(idref);
        if (!path) continue;
        const bytes = files[path];
        if (!bytes) continue;
        const body = parseDoc(bytes);
        if (!body) continue;
        htmlParts.push(body.innerHTML);
        const text = body.textContent ?? '';
        if (text.trim().length > 0) textParts.push(text);
      } catch {
        // Skip individual unreadable spine items.
      }
    }
  } catch {
    // Fallback: concatenate every (x)html entry in the zip.
    htmlParts.length = 0;
    textParts.length = 0;
    for (const name of Object.keys(files)) {
      if (!/\.(xhtml|html|htm)$/i.test(name)) continue;
      try {
        const body = parseDoc(files[name]);
        if (!body) continue;
        htmlParts.push(body.innerHTML);
        const text = body.textContent ?? '';
        if (text.trim().length > 0) textParts.push(text);
      } catch {
        // Skip.
      }
    }
  }

  return { html: htmlParts, text: textParts };
}

export function createRuntime(): EngineRuntime {
  return {
    async run(inputs: Asset[], ctx: RunContext): Promise<Asset[]> {
      const input = inputs[0];
      ctx.onProgress(0.1);

      const from = ctx.inputFormat;
      const target = ctx.target;
      let result: string | Uint8Array;

      if (from === 'docx' && target === 'html') {
        const { value } = await mammoth.convertToHtml({ arrayBuffer: toArrayBuffer(input.data) });
        result = htmlDoc(baseName(input.name), value);
      } else if (from === 'docx' && target === 'txt') {
        const { value } = await mammoth.extractRawText({ arrayBuffer: toArrayBuffer(input.data) });
        result = value;
      } else if (from === 'docx' && target === 'md') {
        const m = mammoth as unknown as {
          convertToMarkdown?: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        };
        if (typeof m.convertToMarkdown === 'function') {
          const { value } = await m.convertToMarkdown({ arrayBuffer: toArrayBuffer(input.data) });
          result = value;
        } else {
          // Plain text is valid markdown.
          const { value } = await mammoth.extractRawText({ arrayBuffer: toArrayBuffer(input.data) });
          result = value;
        }
      } else if (from === 'docx' && target === 'pdf') {
        const { value: rawText } = await mammoth.extractRawText({
          arrayBuffer: toArrayBuffer(input.data),
        });
        result = await textToPdf(rawText);
      } else if (from === 'epub' && (target === 'html' || target === 'txt')) {
        const extracted = extractEpub(input.data);
        if (target === 'html') {
          if (extracted.html.length === 0) throw new Error('No readable content found in EPUB');
          result = htmlDoc(baseName(input.name), extracted.html.join('\n'));
        } else {
          if (extracted.text.length === 0) throw new Error('No readable content found in EPUB');
          result = extracted.text.join('\n\n');
        }
      } else if (from === 'html' && target === 'txt') {
        const doc = new DOMParser().parseFromString(dec(input.data), 'text/html');
        result = doc.body?.textContent ?? '';
      } else if (from === 'md' && target === 'html') {
        result = htmlDoc(baseName(input.name), markdownToHtml(dec(input.data)));
      } else {
        throw new Error(`Unsupported document conversion ${ctx.inputFormat}→${ctx.target}`);
      }

      ctx.onProgress(1);

      const data = typeof result === 'string' ? enc(result) : result;
      return [
        {
          name: withExtension(baseName(input.name), extOf(target!)),
          formatId: target!,
          data,
        },
      ];
    },
  };
}
