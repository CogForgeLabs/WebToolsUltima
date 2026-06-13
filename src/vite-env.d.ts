/// <reference types="vite/client" />

declare module 'imagetracerjs';
declare module 'libheif-js';

declare module 'gifenc' {
  /** An RGB or RGBA palette entry. */
  export type GifPaletteColor = number[];
  export type GifPalette = GifPaletteColor[];

  export interface GifFrameOptions {
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    palette?: GifPalette | null;
    /** -1 = play once, 0 = loop forever, >0 = repeat count. Honoured on the first frame. */
    repeat?: number;
    colorDepth?: number;
    dispose?: number;
    first?: boolean;
  }

  export interface GifEncoderInstance {
    reset(): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    writeHeader(): void;
    writeFrame(
      index: Uint8Array | number[],
      width: number,
      height: number,
      opts?: GifFrameOptions,
    ): void;
  }

  export interface GifEncoderOptions {
    initialCapacity?: number;
    auto?: boolean;
  }

  export function GIFEncoder(opt?: GifEncoderOptions): GifEncoderInstance;

  export type QuantizeFormat = 'rgb565' | 'rgb444' | 'rgba4444';
  export interface QuantizeOptions {
    format?: QuantizeFormat;
    clearAlpha?: boolean;
    clearAlphaColor?: number;
    clearAlphaThreshold?: number;
    oneBitAlpha?: boolean | number;
  }

  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): GifPalette;

  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: QuantizeFormat,
  ): Uint8Array;

  const GIFEncoderDefault: typeof GIFEncoder;
  export default GIFEncoderDefault;
}
