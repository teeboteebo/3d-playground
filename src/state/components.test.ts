import { describe, expect, it } from 'vitest';
import { READING_CHAIRS } from '../data/catalog';
import { OFFICE } from '../data/office';
import { componentDefaults, drawn, sanitizeComponents } from './components';

describe('office components state', () => {
  it('starts every component at its initial state', () => {
    expect(componentDefaults(OFFICE)['reading-chair']).toEqual({ shown: true, variant: READING_CHAIRS[1].id });
  });

  it.each(['gone', 'none'])('keeps the switch and falls back to the initial product for %s', (variant) => {
    expect(sanitizeComponents({ 'reading-chair': { shown: false, variant } }, OFFICE)['reading-chair']).toEqual({
      shown: false,
      variant: READING_CHAIRS[1].id,
    });
  });

  it('ignores unknown components and non-boolean switches', () => {
    const c = sanitizeComponents({ sofa: {}, desk: { shown: 'no' } }, OFFICE) as Record<string, unknown>;
    expect('sofa' in c).toBe(false);
    expect((c.desk as { shown: boolean }).shown).toBe(true);
  });

  it('draws nothing for a hidden piece', () => {
    expect(drawn({ shown: false, variant: 'x' })).toBe('none');
    expect(drawn({ shown: true, variant: 'x' })).toBe('x');
  });
});
