import type { Asset, EngineRuntime, RunContext } from '../../core/engines/types';
import { withExtension, baseName } from '../../core/util/bytes';
import { mimeOf, extOf } from '../../core/util/blob';
import libheif from 'libheif-js';

/**
 * HEIC runtime — runs INSIDE the shared transform worker. No DOM (document/window/Image):
 * decoding goes through libheif (wasm) into an ImageData, then OffscreenCanvas re-encodes to
 * JPEG/PNG. `ctx.target` is 'jpeg' or 'png'.
 */
export function createRuntime(): EngineRuntime {
  // libheif's default export is declared untyped; keep the `any` cast confined here.
  const lib = libheif as any;

  return {
    async run(inputs: Asset[], ctx: RunContext): Promise<Asset[]> {
      const { params, onProgress } = ctx;
      onProgress(0.1);

      const input = inputs[0];

      const decoder = new lib.HeifDecoder();
      const images = decoder.decode(new Uint8Array(input.data));
      if (!images || images.length === 0) throw new Error('Could not decode this HEIC image');
      const image = images[0];

      const width = image.get_width();
      const height = image.get_height();
      const imageData = new ImageData(width, height);
      await new Promise<void>((resolve, reject) => {
        image.display(imageData, (out: ImageData | null) =>
          out ? resolve() : reject(new Error('HEIC decode failed')),
        );
      });

      const canvas = new OffscreenCanvas(width, height);
      const c = canvas.getContext('2d');
      if (!c) throw new Error('No 2D context');
      c.putImageData(imageData, 0, 0);

      const q = Number(params.quality ?? 85) / 100;
      const blob = await canvas.convertToBlob({
        type: mimeOf(ctx.target!),
        quality: ctx.target === 'jpeg' ? q : undefined,
      });
      const data = new Uint8Array(await blob.arrayBuffer());

      onProgress(1);
      return [
        {
          name: withExtension(baseName(input.name), extOf(ctx.target!)),
          formatId: ctx.target!,
          data,
        },
      ];
    },
  };
}
