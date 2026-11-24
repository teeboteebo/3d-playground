import { describe, expect, it } from 'vitest';
import { ARTS, FRAMES, PILLOW_SETS, RUGS, WARDROBES } from './catalog';
import { BEDROOM, bedroomDef } from './bedroom';
import type { ChipChoice, ComponentDef } from './components';
import { DEFAULTS } from '../state/settings';
import { componentDefaults, sanitizeComponents } from '../state/components';

const comps = BEDROOM.components as readonly ComponentDef[];

/** the choices of a chips option of a bedroom piece */
function choicesOf(piece: Parameters<typeof bedroomDef>[0], option: string): readonly ChipChoice[] {
  const o = bedroomDef(piece).options?.find((x) => x.id === option);
  if (o?.kind !== 'chips') throw new Error(`${piece} has no chips option ${option}`);
  return o.choices;
}

describe('the bedroom as components', () => {
  it('has the ten slots, in their categories', () => {
    expect(comps.map((c) => [c.id, c.category])).toEqual([
      ['ceiling-light', 'lighting'],
      ['bedside-lamps', 'lighting'],
      ['bed', 'furniture'],
      ['bench', 'furniture'],
      ['bedside-tables', 'furniture'],
      ['dresser', 'furniture'],
      ['wardrobes', 'furniture'],
      ['mirror', 'decor'],
      ['painting', 'decor'],
      ['rug', 'decor'],
    ]);
  });

  it('has no group, and no catalog lamp: the room builds its own lights', () => {
    expect(BEDROOM.components.some((c) => 'group' in c || 'lamp' in c)).toBe(false);
  });

  it('has no none variant, and starts each piece on a variant it has', () => {
    for (const c of comps) {
      expect(c.variants.some((v) => v.id === 'none')).toBe(false);
      expect(c.variants.some((v) => v.id === c.initial.variant)).toBe(true);
      expect(new Set(c.variants.map((v) => v.id)).size).toBe(c.variants.length);
    }
  });

  it('is looked up by id', () => {
    expect(bedroomDef('bench').name).toBe('Bench');
    expect(() => bedroomDef('sofa' as never)).toThrow();
  });
});

describe('the bedroom products', () => {
  it('has one fixed product for each piece but the rug', () => {
    expect(comps.filter((c) => c.id !== 'rug').map((c) => c.variants.map((v) => v.name))).toEqual([
      ['IKEA GULLSUDARE'],
      ['Mio Adina'],
      ['IKEA TONSTAD, 160 × 200 cm'],
      ['ILVA Amigo'],
      ['AC Design Cholet'],
      ['Mio TOVA'],
      ['Built-in Pax'],
      ['Full-length mirror'],
      ['Framed painting'],
    ]);
  });

  it('offers the catalog rugs with their details, and no bare floor', () => {
    const rug = bedroomDef('rug');
    const rugs = RUGS.filter((r) => r.id !== 'none');
    expect(rug.variants.map((v) => v.id)).toEqual(rugs.map((r) => r.id));
    for (const [i, v] of rug.variants.entries()) {
      expect(v).toMatchObject({ name: rugs[i].name, vendor: rugs[i].vendor, price: rugs[i].price, sizes: rugs[i].sizes, stock: rugs[i].stock, st: rugs[i].st, url: rugs[i].url });
      expect(v.url).toMatch(/^https:\/\//);
      expect(v.sizes).toBe('200×300');
    }
  });
});

describe('the bedroom at the start', () => {
  const start = componentDefaults<string>(BEDROOM);

  it('shows every piece, on the choices the bedroom starts with today', () => {
    const b = DEFAULTS.bedroom;
    expect(Object.values(start).every((s) => s.shown)).toBe(b.pendant === 'on');
    expect(start.rug.variant).toBe(b.rug);
    expect(start.bed.options).toEqual({ pillows: b.pillows });
    expect(start.wardrobes.options).toEqual({ colour: b.wardrobes });
    expect(start.painting.options).toEqual({ art: b.art, frame: b.frame });
    expect(start.dresser.options).toEqual({});
  });

  it('offers every pillow set, art, frame and wardrobe colour the bedroom has', () => {
    const ids = (piece: Parameters<typeof bedroomDef>[0], opt: string) => choicesOf(piece, opt).map((c) => c.id);
    expect(ids('bed', 'pillows')).toEqual(PILLOW_SETS.map((p) => p.id));
    expect(ids('painting', 'art')).toEqual(ARTS.map((a) => a.id));
    expect(ids('painting', 'frame')).toEqual(FRAMES.map((f) => f.id));
    expect(ids('wardrobes', 'colour')).toEqual(WARDROBES.map((w) => w.id));
  });

  it('lets the Accent pillows follow the accent colour, and no other choice', () => {
    const choices = choicesOf('bed', 'pillows');
    expect(choices.filter((c) => c.followsAccent).map((c) => c.id)).toEqual(['clay']);
    expect(choices.find((c) => c.id === 'clay')!.hex).toBeUndefined();
  });

  it('keeps a saved choice and takes the start for one it does not know', () => {
    const saved = { bed: { options: { pillows: 'ink' } }, painting: { options: { art: 'hills', frame: 'gold' } }, wardrobes: { options: { colour: 'x' } } };
    const s = sanitizeComponents<string>(saved, BEDROOM);
    expect(s.bed.options).toEqual({ pillows: 'ink' });
    expect(s.painting.options).toEqual({ art: 'hills', frame: 'brass' });
    expect(s.wardrobes.options).toEqual({ colour: 'wall' });
  });
});
