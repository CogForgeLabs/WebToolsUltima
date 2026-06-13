import type { Asset, EngineRuntime, RunContext } from '../../core/engines/types';
import { withExtension, baseName } from '../../core/util/bytes';
import { mimeOf, extOf } from '../../core/util/blob';

/**
 * Vector runtime — runs on the MAIN thread (DOM available).
 *  - SVG → PNG/JPEG: rasterise via Image + canvas at the chosen scale.
 *  - raster → SVG: trace via imagetracerjs.
 */
export function createRuntime(): EngineRuntime {
  return {
    async run(inputs: Asset[], ctx: RunContext): Promise<Asset[]> {
      const { params, onProgress } = ctx;
      onProgress(0.1);

      const input = inputs[0];

      // Case A — SVG → PNG/JPEG.
      if (
        ctx.kind === 'convert' &&
        ctx.inputFormat === 'svg' &&
        (ctx.target === 'png' || ctx.target === 'jpeg')
      ) {
        const svgText = new TextDecoder().decode(input.data);
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error('Invalid SVG'));
          img.src = url;
        });

        const scale = Number(params.scale ?? 1);
        const w = Math.max(1, Math.round((img.naturalWidth || img.width || 512) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || img.height || 512) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const c = canvas.getContext('2d')!;
        if (ctx.target === 'jpeg' || params.background === 'white') {
          c.fillStyle = '#ffffff';
          c.fillRect(0, 0, w, h);
        }
        c.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);

        const out: Blob = await new Promise((r) =>
          canvas.toBlob((b) => r(b!), mimeOf(ctx.target!), 0.92),
        );
        onProgress(1);
        return [
          {
            name: withExtension(baseName(input.name), extOf(ctx.target!)),
            formatId: ctx.target!,
            data: new Uint8Array(await out.arrayBuffer()),
          },
        ];
      }

      // Case B — raster → SVG (trace).
      if (ctx.kind === 'convert' && ctx.target === 'svg') {
        const bmp = await createImageBitmap(
          new Blob([new Uint8Array(input.data)], { type: mimeOf(input.formatId) }),
        );
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const c = canvas.getContext('2d')!;
        c.drawImage(bmp, 0, 0);
        const imageData = c.getImageData(0, 0, bmp.width, bmp.height);

        const ImageTracer = (await import('imagetracerjs')).default as any;
        const svgstr: string = ImageTracer.imagedataToSVG(imageData, {
          numberofcolors: Number(params.colors ?? 16),
        });

        onProgress(1);
        return [
          {
            name: withExtension(baseName(input.name), 'svg'),
            formatId: 'svg',
            data: new TextEncoder().encode(svgstr),
          },
        ];
      }

      throw new Error('Unsupported vector conversion');
    },
  };
}
