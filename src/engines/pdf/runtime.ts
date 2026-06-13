import type { Asset, EngineRuntime, RunContext } from '../../core/engines/types';
import { baseName } from '../../core/util/bytes';
import { extOf } from '../../core/util/blob';

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, degrees } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// ── Standard page sizes (PDF points) ──────────────────────────────────────────
const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
};

/**
 * Parse a page spec like "1,3,5-8" into 0-based, clamped, unique, sorted indices.
 * Empty / whitespace-only spec => all pages [0..pageCount-1].
 */
function parsePageList(spec: string, pageCount: number): number[] {
  const trimmed = (spec ?? '').trim();
  if (!trimmed) return Array.from({ length: pageCount }, (_, i) => i);

  const out = new Set<number>();
  const clamp = (n: number) => Math.min(Math.max(n, 0), Math.max(pageCount - 1, 0));

  for (const partRaw of trimmed.split(',')) {
    const part = partRaw.trim();
    if (!part) continue;
    const dash = part.indexOf('-');
    if (dash >= 0) {
      const a = parseInt(part.slice(0, dash).trim(), 10);
      const b = parseInt(part.slice(dash + 1).trim(), 10);
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      let lo = a;
      let hi = b;
      if (lo > hi) [lo, hi] = [hi, lo];
      for (let p = lo; p <= hi; p++) {
        // input is 1-based
        const idx = clamp(p - 1);
        out.add(idx);
      }
    } else {
      const n = parseInt(part, 10);
      if (Number.isNaN(n)) continue;
      out.add(clamp(n - 1));
    }
  }

  return Array.from(out).sort((x, y) => x - y);
}

/** Render a single (1-based) page of a PDF to a canvas at the given scale. */
async function renderPage(data: Uint8Array, n: number, scale: number): Promise<HTMLCanvasElement> {
  // Clone bytes: pdfjs may detach/transfer the underlying buffer.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const c = canvas.getContext('2d')!;
  await page.render({ canvasContext: c, viewport }).promise;
  return canvas;
}

/** Export a canvas to bytes of the given MIME type. */
async function canvasToBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas.toBlob returned null'))), type, quality),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

export function createRuntime(): EngineRuntime {
  return {
    async run(inputs: Asset[], ctx: RunContext): Promise<Asset[]> {
      if (inputs.length === 0) throw new Error('PDF engine: no input files provided.');
      const { kind, onProgress } = ctx;

      // ── CONVERT ───────────────────────────────────────────────────────────
      if (kind === 'convert') {
        const target = ctx.target;

        // PDF → image (one asset per page)
        if (target === 'jpeg' || target === 'png') {
          const input = inputs[0];
          const scale = Number(ctx.params.scale ?? 2);
          const mime = target === 'png' ? 'image/png' : 'image/jpeg';
          const ext = extOf(target);

          // Determine page count up front.
          const data = new Uint8Array(input.data);
          const doc = await pdfjs.getDocument({ data }).promise;
          const pageCount = doc.numPages;

          const pages = parsePageList(String(ctx.params.pages ?? ''), pageCount);
          if (pages.length === 0) throw new Error('No pages selected for conversion.');

          const out: Asset[] = [];
          for (let i = 0; i < pages.length; i++) {
            const n = pages[i] + 1; // 1-based
            const canvas = await renderPage(input.data, n, scale);
            const bytes = await canvasToBytes(canvas, mime, target === 'jpeg' ? 0.9 : undefined);
            out.push({
              name: `${baseName(input.name)}-p${n}.${ext}`,
              formatId: target,
              data: bytes,
            });
            onProgress((i + 1) / pages.length);
          }
          return out;
        }

        // image(s) → single PDF
        if (target === 'pdf') {
          const pdf = await PDFDocument.create();
          const pageSize = String(ctx.params.pageSize ?? 'fit');
          const MARGIN = 36;

          for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const isPng = input.formatId === 'png';
            const img = isPng
              ? await pdf.embedPng(new Uint8Array(input.data))
              : await pdf.embedJpg(new Uint8Array(input.data));

            if (pageSize === 'fit') {
              const page = pdf.addPage([img.width, img.height]);
              page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
            } else {
              const [pw, ph] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.a4;
              const page = pdf.addPage([pw, ph]);
              const availW = pw - MARGIN * 2;
              const availH = ph - MARGIN * 2;
              const scale = Math.min(availW / img.width, availH / img.height, 1);
              const w = img.width * scale;
              const h = img.height * scale;
              page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
            }
            onProgress((i + 1) / inputs.length);
          }

          const bytes = await pdf.save();
          return [{ name: `${baseName(inputs[0].name)}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
        }

        throw new Error(`PDF engine: unsupported convert target "${String(target)}".`);
      }

      // ── COMPRESS (rasterising compressor) ──────────────────────────────────
      // NOTE: This rasterises every page to JPEG and rebuilds the PDF. It discards
      // vector/text content, so it is best for scanned / image-heavy documents and
      // can dramatically reduce their size.
      if (kind === 'compress') {
        const input = inputs[0];
        const q = Number(ctx.params.imageQuality ?? 60) / 100;
        const renderScale = 1.5;

        const data = new Uint8Array(input.data);
        const doc = await pdfjs.getDocument({ data }).promise;
        const pageCount = doc.numPages;

        const out = await PDFDocument.create();
        for (let i = 0; i < pageCount; i++) {
          const n = i + 1;
          const canvas = await renderPage(input.data, n, renderScale);
          const jpegBytes = await canvasToBytes(canvas, 'image/jpeg', q);
          const img = await out.embedJpg(jpegBytes);
          const page = out.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
          onProgress((i + 1) / pageCount);
        }

        const bytes = await out.save();
        return [{ name: `${baseName(input.name)}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
      }

      // ── TRANSFORM ─────────────────────────────────────────────────────────
      if (kind === 'transform') {
        const op = ctx.op;

        // merge: many inputs → one PDF
        if (op === 'merge') {
          const out = await PDFDocument.create();
          for (let i = 0; i < inputs.length; i++) {
            const d = await PDFDocument.load(new Uint8Array(inputs[i].data));
            const pages = await out.copyPages(d, d.getPageIndices());
            pages.forEach((p) => out.addPage(p));
            onProgress((i + 1) / inputs.length);
          }
          const bytes = await out.save();
          return [{ name: `${baseName(inputs[0].name)}-merged.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
        }

        const input = inputs[0];
        const base = baseName(input.name);

        // split: each page or by ranges
        if (op === 'split') {
          const src = await PDFDocument.load(new Uint8Array(input.data));
          const pageCount = src.getPageCount();
          const mode = String(ctx.params.mode ?? 'each');
          const out: Asset[] = [];

          if (mode === 'ranges') {
            const spec = String(ctx.params.ranges ?? '').trim();
            const ranges: number[][] = [];
            for (const partRaw of spec.split(',')) {
              const part = partRaw.trim();
              if (!part) continue;
              const dash = part.indexOf('-');
              let lo: number;
              let hi: number;
              if (dash >= 0) {
                lo = parseInt(part.slice(0, dash).trim(), 10);
                hi = parseInt(part.slice(dash + 1).trim(), 10);
              } else {
                lo = hi = parseInt(part, 10);
              }
              if (Number.isNaN(lo) || Number.isNaN(hi)) continue;
              if (lo > hi) [lo, hi] = [hi, lo];
              const indices: number[] = [];
              for (let p = lo; p <= hi; p++) {
                const idx = p - 1; // 1-based -> 0-based
                if (idx >= 0 && idx < pageCount) indices.push(idx);
              }
              if (indices.length) ranges.push(indices);
            }
            if (ranges.length === 0) throw new Error('No valid ranges provided for split.');

            for (let i = 0; i < ranges.length; i++) {
              const part = await PDFDocument.create();
              const pages = await part.copyPages(src, ranges[i]);
              pages.forEach((p) => part.addPage(p));
              const bytes = await part.save();
              out.push({ name: `${base}-${i + 1}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) });
              onProgress((i + 1) / ranges.length);
            }
          } else {
            // each page → its own PDF
            for (let i = 0; i < pageCount; i++) {
              const part = await PDFDocument.create();
              const [p] = await part.copyPages(src, [i]);
              part.addPage(p);
              const bytes = await part.save();
              out.push({ name: `${base}-${i + 1}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) });
              onProgress((i + 1) / pageCount);
            }
          }
          return out;
        }

        // rotate
        if (op === 'rotate') {
          const src = await PDFDocument.load(new Uint8Array(input.data));
          const angle = Number(ctx.params.angle);
          const pages = parsePageList(String(ctx.params.pages ?? ''), src.getPageCount());
          for (let i = 0; i < pages.length; i++) {
            const p = src.getPage(pages[i]);
            p.setRotation(degrees((p.getRotation().angle + angle) % 360));
            onProgress((i + 1) / pages.length);
          }
          const bytes = await src.save();
          return [{ name: `${base}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
        }

        // crop (margins in points)
        if (op === 'crop') {
          const src = await PDFDocument.load(new Uint8Array(input.data));
          const top = Number(ctx.params.top ?? 0);
          const right = Number(ctx.params.right ?? 0);
          const bottom = Number(ctx.params.bottom ?? 0);
          const left = Number(ctx.params.left ?? 0);
          const pages = src.getPages();
          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            page.setCropBox(left, bottom, Math.max(1, width - left - right), Math.max(1, height - top - bottom));
            onProgress((i + 1) / pages.length);
          }
          const bytes = await src.save();
          return [{ name: `${base}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
        }

        // organize: reorder pages, 1-based order list
        if (op === 'organize') {
          const src = await PDFDocument.load(new Uint8Array(input.data));
          const spec = String(ctx.params.order ?? '').trim();
          if (!spec) {
            const bytes = await src.save();
            return [{ name: `${base}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
          }
          const pageCount = src.getPageCount();
          const order: number[] = [];
          for (const partRaw of spec.split(',')) {
            const part = partRaw.trim();
            if (!part) continue;
            const n = parseInt(part, 10);
            if (Number.isNaN(n)) continue;
            const idx = n - 1;
            if (idx >= 0 && idx < pageCount) order.push(idx);
          }
          if (order.length === 0) throw new Error('No valid page order provided.');

          const out = await PDFDocument.create();
          const pages = await out.copyPages(src, order);
          pages.forEach((p) => out.addPage(p));
          const bytes = await out.save();
          return [{ name: `${base}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
        }

        // remove-pages: keep the complement
        if (op === 'remove-pages') {
          const src = await PDFDocument.load(new Uint8Array(input.data));
          const pageCount = src.getPageCount();
          const remove = new Set(parsePageList(String(ctx.params.pages ?? ''), pageCount));
          const keep: number[] = [];
          for (let i = 0; i < pageCount; i++) if (!remove.has(i)) keep.push(i);
          if (keep.length === 0) throw new Error('Removing these pages would leave an empty document.');

          const out = await PDFDocument.create();
          const pages = await out.copyPages(src, keep);
          pages.forEach((p) => out.addPage(p));
          const bytes = await out.save();
          return [{ name: `${base}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
        }

        // extract-pages: keep selected
        if (op === 'extract-pages') {
          const src = await PDFDocument.load(new Uint8Array(input.data));
          const pageCount = src.getPageCount();
          const keep = parsePageList(String(ctx.params.pages ?? ''), pageCount);
          if (keep.length === 0) throw new Error('No pages selected to extract.');

          const out = await PDFDocument.create();
          const pages = await out.copyPages(src, keep);
          pages.forEach((p) => out.addPage(p));
          const bytes = await out.save();
          return [{ name: `${base}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
        }

        // flatten form fields
        if (op === 'flatten') {
          const src = await PDFDocument.load(new Uint8Array(input.data));
          try {
            src.getForm().flatten();
          } catch {
            // No form / already flat — ignore.
          }
          const bytes = await src.save();
          return [{ name: `${base}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
        }

        // resize all pages to a standard size
        if (op === 'resize') {
          const src = await PDFDocument.load(new Uint8Array(input.data));
          const size = String(ctx.params.size ?? 'a4');
          const [w, h] = PAGE_SIZES[size] ?? PAGE_SIZES.a4;
          const pages = src.getPages();
          for (let i = 0; i < pages.length; i++) {
            pages[i].setSize(w, h);
            onProgress((i + 1) / pages.length);
          }
          const bytes = await src.save();
          return [{ name: `${base}.pdf`, formatId: 'pdf', data: new Uint8Array(bytes) }];
        }

        // extract-images (best-effort) → many PNGs
        if (op === 'extract-images') {
          const data = new Uint8Array(input.data);
          const doc = await pdfjs.getDocument({ data }).promise;
          const pageCount = doc.numPages;
          const out: Asset[] = [];
          const seen = new Set<string>();
          let imgIndex = 0;

          const OPS = pdfjs.OPS as Record<string, number>;
          const paintImage = OPS.paintImageXObject;
          const paintImageRepeat = OPS.paintImageXObjectRepeat;

          for (let i = 0; i < pageCount; i++) {
            const n = i + 1;
            try {
              const page = await doc.getPage(n);
              const opList = await page.getOperatorList();
              for (let j = 0; j < opList.fnArray.length; j++) {
                const fn = opList.fnArray[j];
                if (fn !== paintImage && fn !== paintImageRepeat) continue;
                const args = opList.argsArray[j];
                const name = args && args[0];
                if (typeof name !== 'string' || seen.has(name)) continue;
                seen.add(name);
                try {
                  const img = await new Promise<unknown>((res) => {
                    try {
                      page.objs.get(name, (o: unknown) => res(o));
                    } catch {
                      res(null);
                    }
                  });
                  const obj = img as
                    | { width?: number; height?: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray | Uint8Array }
                    | null;
                  if (!obj || !obj.width || !obj.height) continue;
                  const w = obj.width;
                  const h = obj.height;
                  const canvas = document.createElement('canvas');
                  canvas.width = w;
                  canvas.height = h;
                  const c = canvas.getContext('2d')!;
                  if (obj.bitmap) {
                    c.drawImage(obj.bitmap, 0, 0);
                  } else if (obj.data) {
                    // pdfjs raw image data can be RGB or RGBA. Normalise to RGBA.
                    const src = obj.data;
                    const rgba = new Uint8ClampedArray(w * h * 4);
                    if (src.length === w * h * 4) {
                      rgba.set(src);
                    } else if (src.length === w * h * 3) {
                      for (let p = 0, q = 0; p < src.length; p += 3, q += 4) {
                        rgba[q] = src[p];
                        rgba[q + 1] = src[p + 1];
                        rgba[q + 2] = src[p + 2];
                        rgba[q + 3] = 255;
                      }
                    } else {
                      continue;
                    }
                    c.putImageData(new ImageData(rgba, w, h), 0, 0);
                  } else {
                    continue;
                  }
                  const bytes = await canvasToBytes(canvas, 'image/png');
                  out.push({ name: `${base}-img${++imgIndex}.png`, formatId: 'png', data: bytes });
                } catch {
                  // Skip this image object.
                }
              }
            } catch {
              // Skip this page — one bad page shouldn't abort the whole job.
            }
            onProgress((i + 1) / pageCount);
          }

          // Fallback: no embedded images found → render each page to PNG.
          if (out.length === 0) {
            for (let i = 0; i < pageCount; i++) {
              const n = i + 1;
              try {
                const canvas = await renderPage(input.data, n, 2);
                const bytes = await canvasToBytes(canvas, 'image/png');
                out.push({ name: `${base}-p${n}.png`, formatId: 'png', data: bytes });
              } catch {
                // Skip bad page.
              }
              onProgress((i + 1) / pageCount);
            }
          }

          if (out.length === 0) throw new Error('No images could be extracted from this PDF.');
          return out;
        }

        throw new Error(`PDF engine: unsupported transform op "${String(op)}".`);
      }

      throw new Error(`PDF engine: unsupported run kind "${String(kind)}".`);
    },
  };
}
