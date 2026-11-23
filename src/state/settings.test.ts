import { describe, expect, it } from 'vitest';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { DRESSERS, FLOOR_LAMPS, PENDANTS, READING_CHAIRS, ROUND_RUGS } from '../data/catalog';
import { DEFAULTS, LEGACY_STORAGE_KEY, STORAGE_KEY, applyPatch, loadSettings, sanitizeSettings, saveSettings } from './settings';

const v2 = (patch: Record<string, unknown>) => ({ version: 2, ...patch });

describe('sanitizeSettings', () => {
  it('returns defaults for empty or garbage input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULTS);
    expect(sanitizeSettings('x')).toEqual(DEFAULTS);
    expect(sanitizeSettings(v2({ time: 'noon', bedroom: { rug: 'flying-carpet', accent: 'red' } }))).toEqual(DEFAULTS);
  });

  it('keeps valid values and upper-cases the accent', () => {
    const s = sanitizeSettings(v2({ time: 'eve', bedroom: { accent: '#2f5d62', rug: 'palma', pillows: 'ink', pendant: 'off', mouldColour: 'tone' } }));
    expect(s.time).toBe('eve');
    expect(s.bedroom).toMatchObject({ accent: '#2F5D62', rug: 'palma', pillows: 'ink', pendant: 'off', mouldColour: 'tone' });
  });

  it('has no floor setting: every room uses the bedroom floor', () => {
    expect('floors' in sanitizeSettings(v2({ floors: { hall: 'light' } }))).toBe(false);
  });

  it('drops removed living-room furniture from saved hidden lists', () => {
    const s = sanitizeSettings(v2({ living: { hidden: ['armchairs', 'side-table', 'sofa'] } }));
    expect(s.living.hidden).toEqual(['sofa']);
  });

  it('replaces unknown rooms, swatches and furniture ids', () => {
    const s = sanitizeSettings(v2({ room: 'attic', walls: { living: 'chalk', office: 'neon' }, living: { hidden: ['sofa', 'piano', 3, 'sofa'] } }));
    expect(s.room).toBe('all');
    expect(s.walls.living).toBe('chalk');
    expect(s.walls.office).toBe('devine');
    expect(s.living.hidden).toEqual(['sofa']);
  });

  it('keeps a valid selected room', () => {
    expect(sanitizeSettings(v2({ room: 'living' })).room).toBe('living');
  });
});

describe('migrating flat settings from before version 2', () => {
  it('moves the bedroom fields under bedroom, with their new names', () => {
    const s = sanitizeSettings({
      accent: '#2f5d62', mould: 'tone', mouldB: 'off', mouldF: 'off', mgap: 12, mcen: 160, msw: 70,
      pendant: 'off', ward: 'ink', rug: 'rista', pillows: 'ink', art: 'hills', frame: 'oak', time: 'eve',
    });
    expect(s.time).toBe('eve');
    expect(s.bedroom).toEqual({
      accent: '#2F5D62', mouldColour: 'tone', mouldBedWall: 'off', mouldDresserWall: 'off',
      mouldSpacing: 12, mouldDado: 77, mouldWalls: DEFAULTS.bedroom.mouldWalls, pendant: 'off', wardrobes: 'ink', rug: 'rista', pillows: 'ink', art: 'hills', frame: 'oak',
    });
  });

  it('moves the hidden furniture under living', () => {
    expect(sanitizeSettings({ hidden: ['sofa', 'piano'] }).living.hidden).toEqual(['sofa']);
  });

  it("renames the office from 'end', in the selection and the wall colours", () => {
    const s = sanitizeSettings({ room: 'end', walls: { end: 'chalk' } });
    expect(s.room).toBe('office');
    expect(s.walls.office).toBe('chalk');
  });

  it('gives settings saved before rooms existed the room defaults', () => {
    const s = sanitizeSettings({ rug: 'rista' });
    expect(s.bedroom.rug).toBe('rista');
    expect(s.room).toBe('all');
    expect(s.walls).toEqual({ bedroom: 'antique', hall: 'frostrok', living: 'frostrok', office: 'devine' });
  });

  it('moves rooms off paints that were removed to their Jotun defaults', () => {
    expect(sanitizeSettings({ walls: { living: 'greige', end: 'bluegrey' } }).walls).toMatchObject({ living: 'frostrok', office: 'devine' });
  });

  it('migrates the single-file app\'s mould "off" value to white + hidden bed-wall moulding', () => {
    expect(sanitizeSettings({ mould: 'off', mouldB: 'on' }).bedroom).toMatchObject({ mouldColour: 'white', mouldBedWall: 'off' });
  });

  it("ignores the single-file app's fixed-finish keys", () => {
    expect(sanitizeSettings({ wall: 'ink', trim: 'white', floor: 'herring', oak: 'dark', size: '170x240' })).toEqual(DEFAULTS);
  });
});

describe('applyPatch', () => {
  it('merges a room patch into that room, keeping its other fields', () => {
    const s = applyPatch(DEFAULTS, { time: 'eve', bedroom: { rug: 'palma' } });
    expect(s.time).toBe('eve');
    expect(s.bedroom).toEqual({ ...DEFAULTS.bedroom, rug: 'palma' });
    expect(s.living).toEqual(DEFAULTS.living);
  });
});

describe('load/save', () => {
  it('round-trips through storage', () => {
    const s = applyPatch(DEFAULTS, { bedroom: { rug: 'rista' } });
    saveSettings(s);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(s);
    expect(loadSettings()).toEqual(s);
  });

  it('reads settings saved under the old key when there are none under the new one', () => {
    localStorage.clear();
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ rug: 'rista', room: 'end' }));
    expect(loadSettings()).toMatchObject({ room: 'office', bedroom: { rug: 'rista' } });
  });

  it('survives corrupt JSON and throwing storage', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    expect(loadSettings()).toEqual(DEFAULTS);
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(loadSettings(throwing)).toEqual(DEFAULTS);
    expect(() => saveSettings(DEFAULTS, throwing)).not.toThrow();
  });
});

describe('living room moulding settings', () => {
  it('gives the living room moulding defaults, also to designs saved before it existed', () => {
    const s = sanitizeSettings({ version: 2, living: { hidden: [] } });
    expect(s.living).toMatchObject({
      mouldColour: 'white', mouldSofaWall: 'on', mouldTvWall: 'on', mouldSpacing: 8, mouldDado: 77,
    });
  });
});

describe('lamp settings', () => {
  const P = PENDANTS[1].id, F = FLOOR_LAMPS[1].id;
  it('defaults every lamp to none', () => {
    const s = sanitizeSettings(null);
    expect(s.living).toMatchObject({ pendant: 'none', floorLamp: 'none' });
    expect(s.office).toMatchObject({ pendant: 'none', floorLamp: 'none' });
  });
  it('loads a version 2 design saved before lamps existed unchanged', () => {
    const old = { version: 2, room: 'living', time: 'eve', walls: DEFAULTS.walls, bedroom: DEFAULTS.bedroom, living: { hidden: ['sofa'] } };
    expect(sanitizeSettings(old)).toEqual({ ...DEFAULTS, room: 'living', time: 'eve', living: { ...DEFAULTS.living, hidden: ['sofa'] } });
  });
  it('keeps valid lamp ids and drops unknown ones', () => {
    const s = sanitizeSettings({ version: 2, living: { pendant: P, floorLamp: 'gone' }, office: { pendant: 'gone', floorLamp: F } });
    expect(s.living).toMatchObject({ pendant: P, floorLamp: 'none' });
    expect(s.office).toMatchObject({ pendant: 'none', floorLamp: F });
  });
  it('does not accept a floor lamp id as a pendant', () => {
    expect(sanitizeSettings({ version: 2, office: { pendant: F } }).office.pendant).toBe('none');
  });
  it('patches one office lamp without touching the other', () => {
    const s = applyPatch({ ...DEFAULTS, office: { ...DEFAULTS.office, pendant: P, floorLamp: F } }, { office: { pendant: 'none' } });
    expect(s.office).toEqual({ ...DEFAULTS.office, pendant: 'none', floorLamp: F });
  });
});

describe('reading corner settings', () => {
  const C = READING_CHAIRS[1].id, D = DRESSERS[1].id, R = ROUND_RUGS[1].id;
  const o = (office: object) => sanitizeSettings({ version: 2, office }).office;
  it('defaults to the first chair, dresser and rug', () => {
    expect(DEFAULTS.office).toEqual({ pendant: 'none', floorLamp: 'none', readingChair: C, dresser: D, roundRug: R });
    expect(sanitizeSettings(null).office).toEqual(DEFAULTS.office);
  });
  it('gives a saved office with only lamps the three defaults', () => {
    expect(o({ pendant: PENDANTS[1].id })).toEqual({ ...DEFAULTS.office, pendant: PENDANTS[1].id });
  });
  it("keeps 'none' as no piece", () => {
    expect(o({ readingChair: 'none', dresser: 'none', roundRug: 'none' }))
      .toMatchObject({ readingChair: 'none', dresser: 'none', roundRug: 'none' });
  });
  it('replaces an unknown id with the default', () => {
    expect(o({ readingChair: 'gone', dresser: 3, roundRug: 'nope' })).toMatchObject({ readingChair: C, dresser: D, roundRug: R });
  });
  it('checks each id only against its own list', () => {
    expect(o({ readingChair: D, dresser: R, roundRug: C })).toMatchObject({ readingChair: C, dresser: D, roundRug: R });
  });
  it('patches one piece without touching the other fields', () => {
    expect(applyPatch(DEFAULTS, { office: { dresser: 'none' } }).office).toEqual({ ...DEFAULTS.office, dresser: 'none' });
  });
});

describe('living room sofa fabric', () => {
  const f = (living: object) => sanitizeSettings({ version: 2, living }).living.sofaFabric;
  it('defaults to the original sofa fabric', () => {
    expect(DEFAULTS.living.sofaFabric).toBe('original');
    expect(sanitizeSettings(null).living.sofaFabric).toBe('original');
  });
  it('keeps a known Bemz fabric code', () => {
    expect(f({ sofaFabric: BEMZ_FABRICS[0].code })).toBe(BEMZ_FABRICS[0].code);
  });
  it("keeps 'original' as the sofa's own fabric", () => {
    expect(f({ sofaFabric: 'original' })).toBe('original');
  });
  it('falls back to the original fabric for unknown codes, non-strings and missing values', () => {
    expect(f({ sofaFabric: 'XXX999' })).toBe('original');
    expect(f({ sofaFabric: 42 })).toBe('original');
    expect(f({})).toBe('original');
  });
});

describe('moulding spacing settings', () => {
  it('maps a legacy bedroom gap to the spacing, with default walls', () => {
    const b = sanitizeSettings({ version: 2, bedroom: { mouldGap: 12 } }).bedroom;
    expect(b.mouldSpacing).toBe(12);
    expect(b.mouldWalls).toEqual(DEFAULTS.bedroom.mouldWalls);
  });
  it('caps a legacy gap so the lower row survives, but never caps a saved spacing', () => {
    expect(sanitizeSettings({ version: 2, bedroom: { mouldGap: 30 } }).bedroom.mouldSpacing).toBe(22);
    expect(sanitizeSettings({ mgap: 30 }).bedroom.mouldSpacing).toBe(22);
    expect(sanitizeSettings({ version: 2, living: { mouldSofaGap: 30 } }).living.mouldSpacing).toBe(22);
    expect(sanitizeSettings({ version: 2, bedroom: { mouldSpacing: 30 } }).bedroom.mouldSpacing).toBe(30);
  });
  it('maps legacy sofa gap and columns', () => {
    const l = sanitizeSettings({ version: 2, living: { mouldSofaGap: 14, mouldSofaColumns: 7 } }).living;
    expect(l.mouldSpacing).toBe(14);
    expect(l.mouldWalls.sofa.columns).toBe(7);
  });
  it('maps a version 1 save', () => {
    expect(sanitizeSettings({ mgap: 12 }).bedroom.mouldSpacing).toBe(12);
  });
  it('ignores the legacy fields when mouldWalls is present', () => {
    const l = sanitizeSettings({ version: 2, living: { mouldSofaGap: 14, mouldSofaColumns: 7, mouldWalls: {} } }).living;
    expect(l.mouldSpacing).toBe(DEFAULTS.living.mouldSpacing);
    expect(l.mouldWalls.sofa.columns).toBe(5);
  });
  it('clamps dado, defaulting to 77, and rejects junk', () => {
    expect(DEFAULTS.bedroom.mouldDado).toBe(77);
    expect(sanitizeSettings({ version: 2, bedroom: { mouldDado: 10 } }).bedroom.mouldDado).toBe(60);
    expect(sanitizeSettings({ version: 2, living: { mouldDado: 500 } }).living.mouldDado).toBe(110);
    expect(sanitizeSettings({ version: 2, living: { mouldDado: 'x', mouldSpacing: NaN } }).living).toMatchObject({ mouldDado: 77, mouldSpacing: 8 });
  });
  it('sanitises each wall with its own minimum and bed rule', () => {
    const b = sanitizeSettings({ version: 2, bedroom: { mouldWalls: { dresserMiddle: { columns: 0 }, bed: { columns: 0, fixedPosition: 'bed' }, dresserWindow: { fixedPosition: 'bed' } } } }).bedroom.mouldWalls;
    expect(b.dresserMiddle.columns).toBe(0);
    expect(b.bed.columns).toBe(1);
    expect(b.dresserWindow.fixedPosition).toBe('even');
  });
});
