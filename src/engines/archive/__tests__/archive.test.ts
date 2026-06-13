import { describe, expect, it } from 'vitest';
import { createRuntime } from '../runtime';
import type { Asset, RunContext } from '../../../core/engines/types';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (u: Uint8Array) => new TextDecoder().decode(u);
const ctx = (op: string, over: Partial<RunContext> = {}): RunContext => ({
  kind: 'transform',
  op,
  params: {},
  inputFormat: 'txt',
  onProgress: () => {},
  ...over,
});

describe('archive engine (zip round-trip)', () => {
  const rt = createRuntime();

  it('zips multiple files then extracts them back', async () => {
    const inputs: Asset[] = [
      { name: 'a.txt', formatId: 'txt', data: enc('hello') },
      { name: 'b.txt', formatId: 'txt', data: enc('world') },
    ];
    const [zip] = await rt.run(inputs, ctx('zip', { params: { name: 'bundle', level: 6 } }));
    expect(zip.formatId).toBe('zip');
    expect(zip.name).toBe('bundle.zip');

    const extracted = await rt.run([zip], ctx('extract', { inputFormat: 'zip' }));
    const byName = Object.fromEntries(extracted.map((a) => [a.name, dec(a.data)]));
    expect(byName['a.txt']).toBe('hello');
    expect(byName['b.txt']).toBe('world');
  });

  it('gzips and gunzips a single file', async () => {
    const [gz] = await rt.run([{ name: 'note.txt', formatId: 'txt', data: enc('compress me') }], ctx('gzip'));
    expect(gz.formatId).toBe('gzip');
    const [back] = await rt.run([gz], ctx('gunzip', { inputFormat: 'gzip' }));
    expect(dec(back.data)).toBe('compress me');
  });
});
