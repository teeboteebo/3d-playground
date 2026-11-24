import { describe, expect, it } from 'vitest';
import { DRESSERS, FLOOR_LAMPS, PENDANTS, READING_CHAIRS, ROUND_RUGS } from './catalog';
import type { ComponentDef } from './components';
import { OFFICE, officeDef } from './office';

describe('the office as components', () => {
  it('lists the office pieces in order', () => {
    expect(OFFICE.components.map((c) => c.id)).toEqual([
      'cabinets', 'desk', 'drawers', 'desk-chair', 'reading-chair', 'dresser', 'round-rug', 'ceiling-light', 'floor-lamp',
    ]);
  });

  it('groups the workspace and the reading corner', () => {
    expect(OFFICE.groups).toEqual([
      { id: 'workspace', name: 'Workspace' },
      { id: 'corner', name: 'Reading corner' },
    ]);
    for (const id of ['desk', 'drawers', 'desk-chair'] as const) expect(officeDef(id).group).toBe('workspace');
    for (const id of ['reading-chair', 'dresser'] as const) expect(officeDef(id).group).toBe('corner');
    expect(officeDef('cabinets').group).toBeUndefined();
    for (const c of OFFICE.components) {
      expect(c.category).toBe(c.id === 'ceiling-light' || c.id === 'floor-lamp' ? 'lighting' : c.id === 'round-rug' ? 'decor' : 'furniture');
    }
  });

  it('keeps the round rug out of every group, as decor', () => {
    expect(officeDef('round-rug').category).toBe('decor');
    expect(officeDef('round-rug').group).toBeUndefined();
  });

  it('puts every component in a declared group, or none', () => {
    const ids = (OFFICE.groups ?? []).map((g) => g.id);
    for (const c of OFFICE.components as readonly ComponentDef[]) if (c.group !== undefined) expect(ids).toContain(c.group);
  });

  it('starts each piece on a variant it has', () => {
    for (const c of OFFICE.components) {
      expect(c.variants.some((v) => v.id === c.initial.variant)).toBe(true);
      expect(c.variants.some((v) => v.id === 'none')).toBe(false);
      expect(new Set(c.variants.map((v) => v.id)).size).toBe(c.variants.length);
    }
  });

  it("keeps today's default office", () => {
    expect(officeDef('ceiling-light').initial).toEqual({ shown: false, variant: PENDANTS[0].id });
    expect(officeDef('floor-lamp').initial).toEqual({ shown: false, variant: FLOOR_LAMPS[0].id });
    expect(officeDef('reading-chair').initial).toEqual({ shown: true, variant: READING_CHAIRS[0].id });
    expect(officeDef('dresser').initial).toEqual({ shown: true, variant: DRESSERS[0].id });
    expect(officeDef('round-rug').initial).toEqual({ shown: true, variant: ROUND_RUGS[0].id });
    for (const id of ['cabinets', 'desk', 'drawers', 'desk-chair'] as const) {
      expect(officeDef(id).initial.shown).toBe(true);
      expect(officeDef(id).variants).toHaveLength(1);
    }
  });
});
