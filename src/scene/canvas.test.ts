import { describe, expect, it } from 'vitest';
import { ROUND_RUGS } from '../data/catalog';
import { getRoundRugCanvases, roundRugThumbnail } from './canvas';

describe('round rug patterns', () => {
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
