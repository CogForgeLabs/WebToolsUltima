import { describe, expect, it } from 'vitest';
import { createRuntime } from '../runtime';
import type { RunContext } from '../../../core/engines/types';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (u: Uint8Array) => new TextDecoder().decode(u);
const ctx = (over: Partial<RunContext>): RunContext => ({
  kind: 'convert',
  params: { delimiter: ',' },
  inputFormat: 'json',
  onProgress: () => {},
  ...over,
});

describe('data engine (JSON ↔ CSV)', () => {
  const rt = createRuntime();

  it('converts JSON array → CSV with a header row', async () => {
    const json = JSON.stringify([{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
    const out = await rt.run([{ name: 'd.json', formatId: 'json', data: enc(json) }], ctx({ target: 'csv' }));
    expect(out[0].formatId).toBe('csv');
    const text = dec(out[0].data);
    expect(text.split(/\r?\n/)[0]).toBe('a,b');
    expect(text).toContain('2,y');
  });

  it('round-trips CSV → JSON', async () => {
    const csv = 'a,b\r\n1,x\r\n2,y';
    const out = await rt.run([{ name: 'd.csv', formatId: 'csv', data: enc(csv) }], ctx({ target: 'json', inputFormat: 'csv' }));
    expect(out[0].formatId).toBe('json');
    const parsed = JSON.parse(dec(out[0].data));
    expect(parsed).toEqual([{ a: '1', b: 'x' }, { a: '2', b: 'y' }]);
  });
});
