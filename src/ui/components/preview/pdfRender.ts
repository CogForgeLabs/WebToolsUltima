import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfPageRender {
  canvas: HTMLCanvasElement;
  /** Page size in PDF points (scale 1), used to map overlays back to crop margins. */
  widthPt: number;
  heightPt: number;
  pageCount: number;
}

/** Render a single PDF page to a canvas, fitted to `maxWidth` CSS pixels. */
export async function renderPdfPage(data: Uint8Array, pageNum = 1, maxWidth = 700): Promise<PdfPageRender> {
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
  const page = await doc.getPage(Math.min(pageNum, doc.numPages));
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, maxWidth / base.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context for PDF preview');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, widthPt: base.width, heightPt: base.height, pageCount: doc.numPages };
}

export async function bytesFrom(file?: File, url?: string): Promise<Uint8Array> {
  if (file) return new Uint8Array(await file.arrayBuffer());
  if (url) return new Uint8Array(await (await fetch(url)).arrayBuffer());
  throw new Error('No source for bytes');
}
