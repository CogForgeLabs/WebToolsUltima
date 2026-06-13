import type { Asset, EngineRuntime, RunContext } from '../../core/engines/types';
import { withExtension, baseName } from '../../core/util/bytes';
import { extOf } from '../../core/util/blob';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// Single-thread ffmpeg-core loaded from a pinned CDN (unpkg). This can be
// self-hosted from our own origin to get full offline support / privacy — the
// only change needed is the `base` URL below.
let ff: FFmpeg | null = null;
let loadPromise: Promise<unknown> | null = null;
let currentProgress: ((f: number) => void) | null = null;

async function getFF(): Promise<FFmpeg> {
  if (!ff) {
    ff = new FFmpeg();
    ff.on('progress', ({ progress }) =>
      currentProgress?.(Math.max(0.05, Math.min(0.99, progress))),
    );
  }
  if (!loadPromise) {
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
    loadPromise = ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }
  await loadPromise;
  return ff;
}

const VIDEO = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv']);

function buildArgs(
  ctx: RunContext,
  i: string,
  o: string,
  outExt: string,
): string[] {
  const p = ctx.params;
  const isVideoInput = VIDEO.has(ctx.inputFormat);

  if (
    ctx.kind === 'convert' &&
    (ctx.target === 'mp4' || ctx.target === 'webm') &&
    isVideoInput
  ) {
    return ['-i', i, o];
  }

  if (
    ctx.kind === 'convert' &&
    (ctx.target === 'mp3' ||
      ctx.target === 'wav' ||
      ctx.target === 'ogg' ||
      ctx.target === 'm4a')
  ) {
    return ['-i', i, '-vn', '-b:a', String(p.audioBitrate ?? '192k'), o];
  }

  if (ctx.kind === 'convert' && ctx.target === 'gif') {
    const fps = Number(p.fps ?? 12);
    const w = Number(p.width ?? 480);
    const vf =
      w > 0 ? `fps=${fps},scale=${w}:-1:flags=lanczos` : `fps=${fps}`;
    return ['-i', i, '-vf', vf, o];
  }

  if (
    ctx.kind === 'convert' &&
    ctx.inputFormat === 'gif' &&
    (ctx.target === 'mp4' || ctx.target === 'webm')
  ) {
    return ['-i', i, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', o];
  }

  if (ctx.kind === 'compress') {
    if (VIDEO.has(outExt)) {
      if (outExt === 'webm') {
        return [
          '-i',
          i,
          '-c:v',
          'libvpx-vp9',
          '-crf',
          String(p.crf ?? 28),
          '-b:v',
          '0',
          '-c:a',
          'libopus',
          o,
        ];
      }
      return [
        '-i',
        i,
        '-c:v',
        'libx264',
        '-crf',
        String(p.crf ?? 28),
        '-preset',
        'medium',
        '-c:a',
        'aac',
        '-b:a',
        String(p.audioBitrate ?? '128k'),
        o,
      ];
    }
    return ['-i', i, '-b:a', String(p.audioBitrate ?? '128k'), o];
  }

  if (ctx.kind === 'transform' && ctx.op === 'trim') {
    const s = Number(p.start ?? 0);
    const d = Number(p.duration ?? 0);
    return [
      '-ss',
      String(s),
      ...(d > 0 ? ['-t', String(d)] : []),
      '-i',
      i,
      '-c',
      'copy',
      o,
    ];
  }

  if (ctx.kind === 'transform' && ctx.op === 'crop-video') {
    return [
      '-i',
      i,
      '-vf',
      `crop=${Number(p.width)}:${Number(p.height)}:${Number(p.x)}:${Number(p.y)}`,
      o,
    ];
  }

  throw new Error(
    `Unsupported ffmpeg task: ${ctx.kind}/${ctx.op}/${ctx.target}`,
  );
}

export function createRuntime(): EngineRuntime {
  return {
    async run(inputs: Asset[], ctx: RunContext): Promise<Asset[]> {
      currentProgress = ctx.onProgress;
      ctx.onProgress(0.05);

      const inExt = extOf(ctx.inputFormat) || 'bin';
      const outFmt = ctx.target ?? ctx.inputFormat;
      const outExt = extOf(outFmt) || inExt;

      const f = await getFF();
      const inName = `in_${Date.now()}.${inExt}`;
      const outName = `out_${Date.now()}.${outExt}`;

      await f.writeFile(inName, new Uint8Array(inputs[0].data));
      const args = buildArgs(ctx, inName, outName, outExt);
      await f.exec(args);
      const data = await f.readFile(outName);

      try {
        await f.deleteFile(inName);
        await f.deleteFile(outName);
      } catch {
        // best-effort cleanup of the in-memory FS
      }

      ctx.onProgress(1);
      return [
        {
          name: withExtension(baseName(inputs[0].name), outExt),
          formatId: outFmt,
          data: new Uint8Array(data as Uint8Array),
        },
      ];
    },
  };
}
