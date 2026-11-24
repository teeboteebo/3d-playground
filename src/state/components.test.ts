import { describe, expect, it } from 'vitest';
import { READING_CHAIRS } from '../data/catalog';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import type { RoomDef } from '../data/components';
import { OFFICE } from '../data/office';
import { componentDefaults, sanitizeComponents } from './components';

describe('office components state', () => {
  it('starts every component at its initial state', () => {
    expect(componentDefaults(OFFICE)['reading-chair']).toEqual({ shown: true, variant: READING_CHAIRS[0].id, options: {} });
  });

  it.each(['gone', 'none'])('keeps the switch and falls back to the initial product for %s', (variant) => {
    expect(sanitizeComponents({ 'reading-chair': { shown: false, variant } }, OFFICE)['reading-chair']).toEqual({
      shown: false,
      variant: READING_CHAIRS[0].id,
      options: {},
    });
  });

  it('ignores unknown components and non-boolean switches', () => {
    const c = sanitizeComponents({ sofa: {}, desk: { shown: 'no' } }, OFFICE) as Record<string, unknown>;
    expect('sofa' in c).toBe(false);
    expect((c.desk as { shown: boolean }).shown).toBe(true);
  });
});

describe('component options', () => {
  const sofa: RoomDef = {
    id: 'living',
    components: [
      {
        id: 'sofa', name: 'Sofa', category: 'furniture', variants: [{ id: 'a', name: 'A' }],
        options: [{ id: 'fabric', label: 'Fabric', kind: 'fabric', initial: 'original' }],
        initial: { shown: true, variant: 'a', options: { fabric: 'original' } },
      },
      { id: 'lamp', name: 'Lamp', category: 'lighting', variants: [{ id: 'a', name: 'A' }], initial: { shown: true, variant: 'a' } },
    ],
  };
  const code = BEMZ_FABRICS[0].code;

  it('starts with the initial options', () => {
    expect(componentDefaults(sofa).sofa.options).toEqual({ fabric: 'original' });
    expect(componentDefaults(sofa).lamp.options).toEqual({});
  });

  it('fills missing or unknown option values from the initial options', () => {
    expect(sanitizeComponents({ sofa: { options: {} } }, sofa).sofa.options).toEqual({ fabric: 'original' });
    expect(sanitizeComponents({ sofa: { options: 5 } }, sofa).sofa.options).toEqual({ fabric: 'original' });
    expect(sanitizeComponents({ sofa: { options: { other: 'x' } } }, sofa).sofa.options).toEqual({ fabric: 'original' });
  });

  it('keeps a known fabric code and turns an unknown one into original', () => {
    expect(sanitizeComponents({ sofa: { options: { fabric: code } } }, sofa).sofa.options).toEqual({ fabric: code });
    expect(sanitizeComponents({ sofa: { options: { fabric: 'nope' } } }, sofa).sofa.options).toEqual({ fabric: 'original' });
    expect(sanitizeComponents({ sofa: { options: { fabric: 3 } } }, sofa).sofa.options).toEqual({ fabric: 'original' });
  });

  it('gives {} to a v3-shaped entry of a component without options', () => {
    expect(sanitizeComponents({ lamp: { shown: false, variant: 'a' } }, sofa).lamp).toEqual({ shown: false, variant: 'a', options: {} });
  });
});
