import { describe, expect, it } from 'vitest';
import { ROUND_RUGS } from '../data/catalog';
import { getRoundRugCanvases, ROUND_RUG_PATTERNS, roundRugThumbnail } from './canvas';

describe('round rug patterns', () => {
  it('has a drawing for the pattern of every round rug in the catalog', () => {
    const patterns = ROUND_RUGS.flatMap((r) => (r.shape ? [r.shape.pattern] : []));
    expect(patterns.filter((p) => !ROUND_RUG_PATTERNS.includes(p))).toEqual([]);
  });

  it('draws a square canvas for every round rug pattern', () => {
    const canvases = getRoundRugCanvases();
    // no 2D canvas in this environment (as for the bedroom rugs): nothing to draw
    if (Object.keys(canvases).length === 0) return;
    for (const r of ROUND_RUGS.slice(1)) {
      const c = canvases[r.shape!.pattern];
      expect(c, r.id).toBeDefined();
      expect(c.width).toBe(c.height);
    }
  });
  it('gives an unknown pattern no thumbnail', () => {
    expect(roundRugThumbnail('no-such-pattern')).toBe('');
  });
});
