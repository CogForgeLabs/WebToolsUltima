import { describe, expect, it } from 'vitest';
import { TOOLS, validateCatalog } from '../registry';

describe('tool catalog', () => {
  it('advertises only tools the engines can actually perform', () => {
    const problems = validateCatalog();
    expect(problems).toEqual([]);
  });

  it('has unique tool ids', () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
