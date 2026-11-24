import { describe, expect, it } from 'vitest';
import { DRESSERS, FLOOR_LAMPS, PENDANTS, READING_CHAIRS, ROUND_RUGS } from './catalog';
import { OFFICE, officeDef } from './office';

const get = (id: Parameters<typeof officeDef>[0]) => officeDef(id);

describe('the office as components', () => {
  it('lists the office pieces in order', () => {
    expect(OFFICE.components.map((c) => c.id)).toEqual([
      'cabinets', 'desk', 'drawers', 'desk-chair', 'reading-chair', 'dresser', 'round-rug', 'pendant', 'floor-lamp',
    ]);
  });

  it('groups the workspace and the reading corner', () => {
    expect(OFFICE.groups).toEqual([
      { id: 'workspace', name: 'Workspace' },
      { id: 'corner', name: 'Reading corner' },
    ]);
    for (const id of ['desk', 'drawers', 'desk-chair'] as const) expect(get(id).group).toBe('workspace');
    for (const id of ['reading-chair', 'dresser', 'round-rug'] as const) expect(get(id).group).toBe('corner');
    expect(get('cabinets').group).toBeUndefined();
    for (const c of OFFICE.components) {
      expect(c.category).toBe(c.id === 'pendant' || c.id === 'floor-lamp' ? 'lighting' : 'furniture');
    }
  });

  it('starts each piece on a variant it has', () => {
    for (const c of OFFICE.components) {
      expect(c.variants.some((v) => v.id === c.initial.variant)).toBe(true);
      expect(c.variants.some((v) => v.id === 'none')).toBe(false);
      expect(new Set(c.variants.map((v) => v.id)).size).toBe(c.variants.length);
    }
  });

  it("keeps today's default office", () => {
    expect(get('pendant').initial).toEqual({ shown: false, variant: PENDANTS[1].id });
    expect(get('floor-lamp').initial).toEqual({ shown: false, variant: FLOOR_LAMPS[1].id });
    expect(get('reading-chair').initial).toEqual({ shown: true, variant: READING_CHAIRS[1].id });
    expect(get('dresser').initial).toEqual({ shown: true, variant: DRESSERS[1].id });
    expect(get('round-rug').initial).toEqual({ shown: true, variant: ROUND_RUGS[1].id });
    for (const id of ['cabinets', 'desk', 'drawers', 'desk-chair'] as const) {
      expect(get(id).initial.shown).toBe(true);
      expect(get(id).variants).toHaveLength(1);
    }
  });
});
