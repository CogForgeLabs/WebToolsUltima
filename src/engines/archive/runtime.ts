import { zipSync, unzipSync, gzipSync, gunzipSync } from 'fflate';
import type { Asset, EngineRuntime, RunContext } from '../../core/engines/types';
import { detectFromBytes } from '../../core/formats/detect';

/** Insert " (n)" before the extension to disambiguate a duplicate name. */
function dedupeName(name: string, seen: Set<string>): string {
  if (!seen.has(name)) {
    seen.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : '';
  let n = 1;
  let candidate = `${base} (${n})${ext}`;
  while (seen.has(candidate)) {
    n++;
    candidate = `${base} (${n})${ext}`;
  }
  seen.add(candidate);
  return candidate;
}

function zip(inputs: Asset[], ctx: RunContext): Asset[] {
  const record: Record<string, Uint8Array> = {};
  const seen = new Set<string>();
  for (const input of inputs) {
    const key = dedupeName(input.name, seen);
    record[key] = new Uint8Array(input.data);
  }
  const level = Number(ctx.params.level ?? 6);
  const out = zipSync(record, { level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
  const name = `${String(ctx.params.name || 'archive')}.zip`;
  return [{ name, formatId: 'zip', data: out }];
}

function extract(input: Asset): Asset[] {
  const files = unzipSync(new Uint8Array(input.data));
  const out: Asset[] = [];
  for (const [path, bytes] of Object.entries(files)) {
    if (path.endsWith('/')) continue;
    if (bytes.length === 0) continue;
    const fmt = detectFromBytes(bytes, path);
    out.push({ name: path, formatId: fmt, data: bytes });
  }
  if (out.length === 0) throw new Error('Archive is empty');
  return out;
}

function gzip(input: Asset, ctx: RunContext): Asset[] {
  const level = Number(ctx.params.level ?? 6);
  const out = gzipSync(new Uint8Array(input.data), {
    level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  });
  return [{ name: `${input.name}.gz`, formatId: 'gzip', data: out }];
}

function gunzip(input: Asset): Asset[] {
  const out = gunzipSync(new Uint8Array(input.data));
  const name = input.name.replace(/\.gz$/i, '') || 'file';
  return [{ name, formatId: detectFromBytes(out, name), data: out }];
}

export function createRuntime(): EngineRuntime {
  return {
    async run(inputs: Asset[], ctx: RunContext): Promise<Asset[]> {
      ctx.onProgress(0.1);
      const first = inputs[0];
      if (!first) throw new Error('No input provided');

      let result: Asset[];
      switch (ctx.op) {
        case 'zip':
          result = zip(inputs, ctx);
          break;
        case 'extract':
          result = extract(first);
          break;
        case 'gzip':
          result = gzip(first, ctx);
          break;
        case 'gunzip':
          result = gunzip(first);
          break;
        default:
          throw new Error(`Unknown archive operation: ${String(ctx.op)}`);
      }

      ctx.onProgress(1);
      return result;
    },
  };
}
