import { describe, expect, it } from 'vitest';
import {
  CORNER_CHECKED, DRESSERS, FLOOR_LAMPS, LAMPS_CHECKED, mainView, PENDANTS, READING_CHAIRS, ROUND_RUGS, viewsFor,
} from './catalog';

describe('views by room', () => {
  it('shows the apartment view and one view per room when no room is selected', () => {
    expect(viewsFor('all').map((v) => v.name)).toEqual(['Apartment', 'Foot of bed', 'Hall', 'Living room', 'Office']);
  });

  it("shows only the selected room's views", () => {
    expect(viewsFor('bedroom').map((v) => v.name)).toEqual(['Overview', 'Foot of bed', 'Wardrobe wall', 'Dresser wall', 'Top down']);
    expect(viewsFor('living').map((v) => v.name)).toEqual(['Living room', 'Sofa wall']);
  });

  it("picks each selection's main view", () => {
    expect(mainView('office').name).toBe('Office');
    expect(mainView('bedroom').name).toBe('Foot of bed');
    expect(mainView('all').name).toBe('Apartment');
  });
});

describe.each([['PENDANTS', PENDANTS, 'pendant'], ['FLOOR_LAMPS', FLOOR_LAMPS, 'floor']] as const)('%s', (_n, list, kind) => {
  it('starts with none and has unique ids', () => {
    expect(list[0].id).toBe('none');
    expect(new Set(list.map((l) => l.id)).size).toBe(list.length);
    expect(list.length).toBeGreaterThanOrEqual(4);
  });
  it('gives every product a kind, vendor, price, https link and shape', () => {
    for (const l of list.slice(1)) {
      expect(l.kind).toBe(kind);
      expect(l.vendor).not.toBe('');
      expect(l.price).not.toBe('');
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.shape).not.toBeNull();
    }
  });
});
it('covers every lamp archetype', () => {
  const types = new Set([...PENDANTS, ...FLOOR_LAMPS].flatMap((l) => (l.shape ? [l.shape.type] : [])));
  expect([...types].sort()).toEqual(['arc', 'dome', 'drum', 'globe', 'tripod', 'uplight']);
});
it('keeps pendant and floor shapes apart', () => {
  for (const l of PENDANTS.slice(1)) expect(['globe', 'dome', 'drum']).toContain(l.shape!.type);
  for (const l of FLOOR_LAMPS.slice(1)) expect(['arc', 'tripod', 'uplight']).toContain(l.shape!.type);
});
it('dates the lamp check', () => {
  expect(LAMPS_CHECKED).toMatch(/^\d{1,2} \w{3} \d{4}$/);
});

describe.each([['READING_CHAIRS', READING_CHAIRS], ['DRESSERS', DRESSERS], ['ROUND_RUGS', ROUND_RUGS]] as const)(
  '%s',
  (_n, list) => {
    it('starts with none and has unique ids', () => {
      expect(list[0].id).toBe('none');
      expect(list[0].shape).toBeNull();
      expect(new Set(list.map((l) => l.id)).size).toBe(list.length);
      expect(list.length).toBeGreaterThanOrEqual(4);
    });
    it('gives every product a vendor, price, https link and shape', () => {
      for (const l of list.slice(1)) {
        expect(l.vendor).not.toBe('');
        expect(l.price).not.toBe('');
        expect(l.url).toMatch(/^https:\/\//);
        expect(l.shape).not.toBeNull();
      }
    });
  },
);
it('keeps every dresser narrow enough for the angled wall', () => {
  for (const d of DRESSERS.slice(1)) expect(d.shape!.w).toBeLessThanOrEqual(1.1);
});
it('keeps every round rug between 1.6 and 2.0 m across', () => {
  for (const r of ROUND_RUGS.slice(1)) {
    expect(r.shape!.d).toBeGreaterThanOrEqual(1.6);
    expect(r.shape!.d).toBeLessThanOrEqual(2.0);
  }
});
it('dates the reading-corner check', () => {
  expect(CORNER_CHECKED).toMatch(/^\d{1,2} \w{3} \d{4}$/);
});
