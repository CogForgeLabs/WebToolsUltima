import { describe, expect, it } from 'vitest';
import { plan } from '../plan';

describe('planner — any→any graph search', () => {
  it('finds a direct convert edge (WEBP → PNG)', () => {
    const r = plan('webp', { kind: 'convert', target: 'png' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pipeline).toHaveLength(1);
      expect(r.pipeline[0].target).toBe('png');
    }
  });

  it('chains a multi-hop path automatically (HEIC → PNG → PDF)', () => {
    const r = plan('heic', { kind: 'convert', target: 'pdf' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pipeline.length).toBeGreaterThanOrEqual(2);
      expect(r.pipeline[r.pipeline.length - 1].target).toBe('pdf');
      expect(r.pipeline[0].engineId).toBe('heic');
    }
  });

  it('rejects converting a file to its own format', () => {
    const r = plan('png', { kind: 'convert', target: 'png' });
    expect(r.ok).toBe(false);
  });

  it('rejects an unreachable target (MP3 → PNG)', () => {
    const r = plan('mp3', { kind: 'convert', target: 'png' });
    expect(r.ok).toBe(false);
  });

  it('plans a compress task when a compressor exists', () => {
    const r = plan('jpeg', { kind: 'compress' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pipeline[0].kind).toBe('compress');
  });

  it('plans a transform op (PDF merge)', () => {
    const r = plan('pdf', { kind: 'transform', op: 'merge' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pipeline[0].op).toBe('merge');
      expect(r.pipeline[0].arity).toBe('n-1');
    }
  });
});
