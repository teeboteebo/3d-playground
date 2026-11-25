import { describe, expect, it } from 'vitest';
import { READING_CHAIRS } from '../data/catalog';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import type { RoomDef } from '../data/components';
import { OFFICE } from '../data/office';
import { componentDefaults, patchComponents, sanitizeComponents } from './components';

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
        initial: { shown: true, variant: 'a' },
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

  it('takes an option\'s initial value as its only default, for a new room, a damaged save and a reset', () => {
    const picked: RoomDef = {
      id: 'living',
      components: [
        {
          id: 'sofa', name: 'Sofa', category: 'furniture', variants: [{ id: 'a', name: 'A' }],
          options: [{ id: 'fabric', label: 'Fabric', kind: 'fabric', initial: code }],
          initial: { shown: true, variant: 'a' },
        },
      ],
    };
    expect(componentDefaults(picked).sofa.options).toEqual({ fabric: code });
    expect(sanitizeComponents({ sofa: { options: { fabric: 'nope' } } }, picked).sofa.options).toEqual({ fabric: code });
  });
});

describe('patching components', () => {
  const states = componentDefaults<string>(OFFICE);
  const code = BEMZ_FABRICS[0].code;
  const other = BEMZ_FABRICS[1].code;
  const twoOptions: RoomDef = {
    id: 'living',
    components: [
      {
        id: 'sofa', name: 'Sofa', category: 'furniture', variants: [{ id: 'a', name: 'A' }],
        options: [
          { id: 'fabric', label: 'Fabric', kind: 'fabric', initial: 'original' },
          { id: 'cushions', label: 'Cushions', kind: 'fabric', initial: 'original' },
        ],
        initial: { shown: true, variant: 'a' },
      },
    ],
  };

  it('changes only the fields and options it names', () => {
    const start = componentDefaults<string>(twoOptions);
    const one = patchComponents(twoOptions, start, { sofa: { options: { fabric: other } } });
    expect(one.sofa).toEqual({ shown: true, variant: 'a', options: { fabric: other, cushions: 'original' } });
    const two = patchComponents(twoOptions, one, { sofa: { options: { cushions: code } } });
    expect(two.sofa.options).toEqual({ fabric: other, cushions: code });
    expect(patchComponents(twoOptions, two, { sofa: { shown: false } }).sofa).toEqual({ ...two.sofa, shown: false });
  });

  it.each(['gone', 'constructor', 'toString', '__proto__', 'hasOwnProperty'])('ignores %s, which is no component of the room', (id) => {
    const patch = JSON.parse(`{"${id}":{"shown":false,"options":{"x":"y"}}}`);
    const next = patchComponents(OFFICE, states, patch);
    expect(next).toEqual(states);
    expect(Object.keys(next).sort()).toEqual(Object.keys(states).sort());
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
  });

  it.each(['other', 'constructor', '__proto__'])('ignores the option %s, which the component does not have', (id) => {
    const patch = { sofa: JSON.parse(`{"options":{"${id}":"x"}}`) };
    expect(patchComponents(twoOptions, componentDefaults<string>(twoOptions), patch).sofa.options).toEqual({
      fabric: 'original', cushions: 'original',
    });
  });

  it('does not take an undefined field as a change', () => {
    const next = patchComponents(OFFICE, states, { desk: { shown: undefined, variant: undefined } });
    expect(next.desk).toEqual(states.desk);
  });

  it('reads no saved state from an inherited name', () => {
    const saved = JSON.parse('{"constructor":{"shown":false},"__proto__":{"shown":false}}');
    expect(sanitizeComponents(saved, OFFICE)).toEqual(states);
  });
});
