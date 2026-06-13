import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { Asset, EngineRuntime, RunContext } from '../../core/engines/types';
import { withExtension, baseName } from '../../core/util/bytes';
import { mimeOf } from '../../core/util/blob';

async function decodeFrame(input: Asset): Promise<ImageBitmap> {
  const blob = new Blob([new Uint8Array(input.data)], { type: mimeOf(input.formatId) });
  return createImageBitmap(blob);
}

export function createRuntime(): EngineRuntime {
  return {
    async run(inputs: Asset[], ctx: RunContext): Promise<Asset[]> {
      if (inputs.length === 0) throw new Error('No frames provided');
      ctx.onProgress(0.05);

      const fps = Number(ctx.params.fps ?? 10);
      const delay = Math.max(20, Math.round(1000 / fps));
      const reqWidth = Number(ctx.params.width ?? 0);
      const loop = ctx.params.loop === false ? -1 : 0;

      // Decode the first frame to establish the aspect ratio / target size.
      const firstBmp = await decodeFrame(inputs[0]);
      const firstW = firstBmp.width;
      const firstH = firstBmp.height;
      let W: number;
      let H: number;
      if (reqWidth > 0) {
        W = reqWidth;
        H = Math.round((W * firstH) / firstW);
      } else {
        W = firstW;
        H = firstH;
      }
      W = Math.max(1, W);
      H = Math.max(1, H);

      const enc = GIFEncoder();
      const total = inputs.length;

      for (let i = 0; i < total; i++) {
        const bmp = i === 0 ? firstBmp : await decodeFrame(inputs[i]);
        const canvas = new OffscreenCanvas(W, H);
        const c = canvas.getContext('2d');
        if (!c) throw new Error('Failed to acquire 2D canvas context');
        c.drawImage(bmp, 0, 0, W, H);
        const { data } = c.getImageData(0, 0, W, H);
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        // `repeat` is only honoured on the first frame; set it there to make the GIF loop.
        enc.writeFrame(index, W, H, i === 0 ? { palette, delay, repeat: loop } : { palette, delay });
        bmp.close();
        ctx.onProgress(0.05 + (0.9 * (i + 1)) / total);
      }

      enc.finish();
      const bytes = enc.bytes();

      const first = inputs[0];
      const name = first.name ? withExtension(baseName(first.name), 'gif') : 'animation.gif';

      ctx.onProgress(1);
      return [{ name, formatId: 'gif', data: bytes }];
    },
  };
}
