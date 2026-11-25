import { describe, expect, it } from 'vitest';
import { FLOOR_LAMPS, FURNITURE, PENDANTS } from './catalog';
import type { ComponentDef } from './components';
import { LIVING } from './living';

const comp = (id: string) => (LIVING.components as readonly ComponentDef[]).find((c) => c.id === id)!;

describe('the living room as components', () => {
  it('lists the living-room pieces in order, under their categories', () => {
    expect(LIVING.components.map((c) => [c.id, c.category])).toEqual([
      ['ceiling-light', 'lighting'],
      ['floor-lamp', 'lighting'],
      ['sofa', 'furniture'],
      ['tv', 'furniture'],
      ['tv-bench', 'furniture'],
      ['shelving', 'furniture'],
      ['plant', 'furniture'],
      ['rug', 'decor'],
    ]);
  });

  it('keeps the ids of the furniture the scene loads', () => {
    const ids = LIVING.components.filter((c) => c.category !== 'lighting').map((c) => c.id);
    expect(ids.sort()).toEqual(FURNITURE.map((f) => f.id).sort());
  });

  it('has no none variant, and starts each piece on a variant it has', () => {
    for (const c of LIVING.components) {
      expect(c.variants.some((v) => v.id === 'none')).toBe(false);
      expect(c.variants.some((v) => v.id === c.initial.variant)).toBe(true);
      expect(new Set(c.variants.map((v) => v.id)).size).toBe(c.variants.length);
    }
  });

  it('starts with the lamps hidden, everything else shown, and the sofa in its own fabric', () => {
    expect(comp('ceiling-light').initial).toEqual({ shown: false, variant: PENDANTS[0].id });
    expect(comp('floor-lamp').initial).toEqual({ shown: false, variant: FLOOR_LAMPS[0].id });
    for (const c of LIVING.components.filter((c) => c.category !== 'lighting')) expect(c.initial.shown).toBe(true);
    expect(comp('sofa').options).toEqual([{ id: 'fabric', label: 'Fabric', kind: 'fabric', initial: 'original' }]);
    expect(comp('sofa').variants).toEqual([{ id: 'nockeby', name: 'IKEA NOCKEBY' }]);
    expect(comp('rug').variants).toEqual([{ id: 'quebec', name: 'ILVA Quebec, 250 × 350 cm' }]);
  });

  it('names the pieces', () => {
    expect(LIVING.components.map((c) => c.name)).toEqual([
      'Ceiling light', 'Floor lamp', 'Sofa', 'Frame TV', 'Sideboard', 'String shelving', 'Plant', 'Rug',
    ]);
  });
});
