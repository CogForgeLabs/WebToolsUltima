import type { Asset, EngineRuntime, RunContext } from '../../core/engines/types';
import { withExtension, baseName } from '../../core/util/bytes';
import { mimeOf, extOf } from '../../core/util/blob';

const ENCODABLE = ['png', 'jpeg', 'webp'];

/** Decode an asset's bytes into an ImageBitmap, throwing a clear error on failure. */
async function decode(input: Asset): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(new Blob([input.data], { type: mimeOf(input.formatId) }));
  } catch {
    throw new Error(`Failed to decode image "${input.name}" (${input.formatId}).`);
  }
}

/** Encode an OffscreenCanvas to the given format, returning raw bytes. */
async function encode(
  canvas: OffscreenCanvas,
  formatId: string,
  quality?: number,
): Promise<Uint8Array> {
  const blob = await canvas.convertToBlob({
    type: mimeOf(formatId),
    quality: quality != null ? quality / 100 : undefined,
  });
  return new Uint8Array(await blob.arrayBuffer());
}

/** Get a 2D context from an OffscreenCanvas or throw. */
function context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire a 2D canvas context.');
  return ctx;
}

/** The encode format for a transform: keep input if encodable, else fall back to PNG. */
function transformOutFormat(inputFormat: string): string {
  return ENCODABLE.includes(inputFormat) ? inputFormat : 'png';
}

/** Build the resulting Asset from encoded bytes. */
function makeAsset(input: Asset, outFormat: string, data: Uint8Array): Asset {
  return {
    name: withExtension(baseName(input.name), extOf(outFormat)),
    formatId: outFormat,
    data,
  };
}

function num(value: string | number | boolean | undefined, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | number | boolean | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return value !== 'false' && value !== '0' && value !== '';
}

export function createRuntime(): EngineRuntime {
  return {
    async run(inputs: Asset[], ctx: RunContext): Promise<Asset[]> {
      const input = inputs[0];
      if (!input) throw new Error('No input asset provided.');
      ctx.onProgress(0.1);

      const bmp = await decode(input);

      let outFormat: string;
      let canvas: OffscreenCanvas;
      let quality: number | undefined;

      if (ctx.kind === 'convert' || ctx.kind === 'compress') {
        outFormat = ctx.target ?? input.formatId;
        quality = num(ctx.params.quality, 80);
        canvas = new OffscreenCanvas(bmp.width, bmp.height);
        const c2d = context2d(canvas);
        c2d.drawImage(bmp, 0, 0);
      } else {
        // transform
        outFormat = transformOutFormat(input.formatId);
        quality = outFormat === 'png' ? undefined : 92;
        const op = ctx.op;

        if (op === 'resize') {
          let width = num(ctx.params.width, bmp.width);
          let height = num(ctx.params.height, 0);
          const keepAspect = bool(ctx.params.keepAspect, true);
          if (width <= 0 && height <= 0) {
            width = bmp.width;
            height = bmp.height;
          } else if (keepAspect || height === 0) {
            if (width > 0) {
              height = Math.max(1, Math.round((bmp.height / bmp.width) * width));
            } else {
              width = Math.max(1, Math.round((bmp.width / bmp.height) * height));
            }
          }
          width = Math.max(1, Math.round(width));
          height = Math.max(1, Math.round(height));
          canvas = new OffscreenCanvas(width, height);
          const c2d = context2d(canvas);
          c2d.imageSmoothingEnabled = true;
          c2d.imageSmoothingQuality = 'high';
          c2d.drawImage(bmp, 0, 0, width, height);
        } else if (op === 'crop') {
          let sx = num(ctx.params.x, 0);
          let sy = num(ctx.params.y, 0);
          let sw = num(ctx.params.width, 0);
          let sh = num(ctx.params.height, 0);
          sx = Math.min(Math.max(0, Math.round(sx)), bmp.width);
          sy = Math.min(Math.max(0, Math.round(sy)), bmp.height);
          sw = Math.round(sw);
          sh = Math.round(sh);
          if (sw <= 0) sw = bmp.width - sx;
          if (sh <= 0) sh = bmp.height - sy;
          sw = Math.max(1, Math.min(sw, bmp.width - sx));
          sh = Math.max(1, Math.min(sh, bmp.height - sy));
          canvas = new OffscreenCanvas(sw, sh);
          const c2d = context2d(canvas);
          c2d.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
        } else if (op === 'rotate') {
          const angle = num(ctx.params.angle, 90);
          const swap = angle === 90 || angle === 270;
          const cw = swap ? bmp.height : bmp.width;
          const ch = swap ? bmp.width : bmp.height;
          canvas = new OffscreenCanvas(cw, ch);
          const c2d = context2d(canvas);
          c2d.translate(cw / 2, ch / 2);
          c2d.rotate((angle * Math.PI) / 180);
          c2d.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
        } else if (op === 'flip') {
          const direction = String(ctx.params.direction ?? 'horizontal');
          canvas = new OffscreenCanvas(bmp.width, bmp.height);
          const c2d = context2d(canvas);
          if (direction === 'vertical') {
            c2d.translate(0, bmp.height);
            c2d.scale(1, -1);
          } else {
            c2d.translate(bmp.width, 0);
            c2d.scale(-1, 1);
          }
          c2d.drawImage(bmp, 0, 0);
        } else if (op === 'enlarge') {
          const scale = num(ctx.params.scale, 2);
          const width = Math.max(1, Math.round(bmp.width * scale));
          const height = Math.max(1, Math.round(bmp.height * scale));
          canvas = new OffscreenCanvas(width, height);
          const c2d = context2d(canvas);
          c2d.imageSmoothingEnabled = true;
          c2d.imageSmoothingQuality = 'high';
          c2d.drawImage(bmp, 0, 0, width, height);
        } else {
          throw new Error(`Unsupported transform operation: ${String(op)}.`);
        }
      }

      const data = await encode(canvas, outFormat, quality);
      bmp.close();
      ctx.onProgress(1);
      return [makeAsset(input, outFormat, data)];
    },
  };
}
