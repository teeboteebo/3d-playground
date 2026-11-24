import { describe, expect, it } from 'vitest';
import { SHOP_DEFAULTS, SHOP_LIMITS, sanitizeShop } from './mouldShop';

describe('sanitizeShop', () => {
  it('gives the defaults for nothing', () => {
    expect(sanitizeShop(undefined)).toEqual(SHOP_DEFAULTS);
    expect(sanitizeShop('junk')).toEqual(SHOP_DEFAULTS);
  });

  it('starts with the agreed defaults', () => {
    expect(SHOP_DEFAULTS.panel).toEqual({ name: '', width: 28, depth: 12, lengths: [] });
    expect(SHOP_DEFAULTS.rail).toEqual({ name: '', width: 40, depth: 14, lengths: [] });
    expect(SHOP_DEFAULTS).toMatchObject({ railSeparate: false, kerf: 3, spare: true, joins: false, minPiece: 20 });
  });

  it('clamps widths, depths, kerf and minimum piece to their limits', () => {
    const s = sanitizeShop({ panel: { width: 1, depth: 999 }, kerf: 50, minPiece: 1 });
    expect(s.panel.width).toBe(SHOP_LIMITS.width.min);
    expect(s.panel.depth).toBe(SHOP_LIMITS.depth.max);
    expect(s.kerf).toBe(SHOP_LIMITS.kerf.max);
    expect(s.minPiece).toBe(SHOP_LIMITS.minPiece.min);
  });

  it('falls back to the default for a non-numeric value', () => {
    const s = sanitizeShop({ panel: { width: 'wide', depth: null }, kerf: '', minPiece: NaN });
    expect(s.panel.width).toBe(28);
    expect(s.panel.depth).toBe(12);
    expect(s.kerf).toBe(3);
    expect(s.minPiece).toBe(20);
  });

  it('drops lengths that are missing, not finite or not above zero', () => {
    const s = sanitizeShop({
      panel: { lengths: [{ price: 5 }, { length: Infinity, price: 5 }, { length: 0, price: 5 }, { length: -3, price: 5 }, { length: 240, price: 89 }] },
    });
    expect(s.panel.lengths).toEqual([{ length: 240, price: 89 }]);
  });

  it('turns an empty, null or negative price into 0', () => {
    const s = sanitizeShop({ panel: { lengths: [{ length: 100, price: '' }, { length: 200, price: null }, { length: 300, price: -4 }] } });
    expect(s.panel.lengths.map((l) => l.price)).toEqual([0, 0, 0]);
  });

  it('keeps the cheapest of duplicate lengths, caps the list at 10 and sorts it ascending', () => {
    const dup = sanitizeShop({ panel: { lengths: [{ length: 300, price: 1 }, { length: 240, price: 2 }, { length: 300, price: 9 }] } });
    expect(dup.panel.lengths).toEqual([{ length: 240, price: 2 }, { length: 300, price: 1 }]);
    const cheaper = sanitizeShop({ panel: { lengths: [{ length: 240, price: 109 }, { length: 240, price: 89 }] } });
    expect(cheaper.panel.lengths).toEqual([{ length: 240, price: 89 }]);
    const many = sanitizeShop({ panel: { lengths: Array.from({ length: 14 }, (_, i) => ({ length: 20 + i * 10, price: i })) } });
    expect(many.panel.lengths).toHaveLength(SHOP_LIMITS.lengths);
  });

  it('accepts only real booleans', () => {
    const s = sanitizeShop({ railSeparate: 'yes', spare: 0, joins: true });
    expect(s.railSeparate).toBe(false);
    expect(s.spare).toBe(true);
    expect(s.joins).toBe(true);
  });

  it('keeps a valid shop as it is', () => {
    const shop = {
      panel: { name: 'Pine', width: 35, depth: 15, lengths: [{ length: 240, price: 89 }] },
      railSeparate: true,
      rail: { name: 'Rail', width: 45, depth: 18, lengths: [{ length: 270, price: 120 }] },
      kerf: 2, spare: false, joins: true, minPiece: 25,
    };
    expect(sanitizeShop(shop)).toEqual(shop);
  });
});
