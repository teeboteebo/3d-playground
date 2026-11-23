import { describe, expect, it } from 'vitest';
import { SHOP_DEFAULTS } from '../state/mouldShop';
import { mouldProfile, mouldRoom } from './mouldProfile';

describe('mouldProfile', () => {
  it('makes the rail the panel profile by default', () => {
    const p = mouldProfile(SHOP_DEFAULTS);
    expect(p.frameWidth).toBeCloseTo(0.028);
    expect(p.frameDepth).toBeCloseTo(0.012);
    expect(p.railHeight).toBeCloseTo(0.028);
    expect(p.railDepth).toBeCloseTo(0.012);
  });
  it('uses the rail product when the rail is separate', () => {
    const p = mouldProfile({ ...SHOP_DEFAULTS, railSeparate: true });
    expect(p.railHeight).toBeCloseTo(0.04);
    expect(p.railDepth).toBeCloseTo(0.014);
    expect(p.frameWidth).toBeCloseTo(0.028);
  });
  it('follows a wider panel product', () => {
    const p = mouldProfile({ ...SHOP_DEFAULTS, panel: { ...SHOP_DEFAULTS.panel, width: 50, depth: 20 } });
    expect(p).toMatchObject({ frameWidth: 0.05, frameDepth: 0.02, railHeight: 0.05, railDepth: 0.02 });
  });
});

describe('mouldRoom', () => {
  it('carries the room spacing and dado and the rail height in cm', () => {
    const r = mouldRoom({ mouldSpacing: 8, mouldDado: 77 }, SHOP_DEFAULTS);
    expect(r.spacing).toBe(8);
    expect(r.dado).toBe(77);
    expect(r.rail).toBeCloseTo(2.8);
  });
});
