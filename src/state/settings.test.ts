import { describe, expect, it } from 'vitest';
import { FLOOR_LAMPS, PENDANTS } from '../data/catalog';
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

  it('clamps slider values and falls back for zero/NaN', () => {
    const b = (bedroom: Record<string, unknown>) => sanitizeSettings(v2({ bedroom })).bedroom;
    expect(b({ mouldGap: 99, mouldCentre: 1, mouldSide: 'abc' })).toMatchObject({ mouldGap: 30, mouldCentre: 150, mouldSide: 68 });
    expect(b({ mouldGap: 0 })).toMatchObject({ mouldGap: 8 });
    expect(b({ mouldGap: '12' })).toMatchObject({ mouldGap: 12 });
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
      accent: '#2F5D62', mouldColour: 'tone', mouldBedWall: 'off', mouldDresserWall: 'off', mouldGap: 12, mouldCentre: 160,
      mouldSide: 70, pendant: 'off', wardrobes: 'ink', rug: 'rista', pillows: 'ink', art: 'hills', frame: 'oak',
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
      mouldColour: 'white', mouldSofaWall: 'on', mouldTvWall: 'on', mouldGap: 8, mouldCentre: 180, mouldSide: 68,
      mouldSofaColumns: 5, mouldSofaGap: 8,
    });
  });
  it('clamps living moulding sizes to the slider ranges', () => {
    expect(sanitizeSettings({ version: 2, living: { mouldCentre: 999, mouldGap: -3 } }).living)
      .toMatchObject({ mouldCentre: 200, mouldGap: 4 });
  });
});

describe('living room sofa-wall grid settings', () => {
  const l = (living: object) => sanitizeSettings({ version: 2, living }).living;
  it('clamps the column count to 2-10 and rounds it to an integer', () => {
    expect(l({ mouldSofaColumns: 99 }).mouldSofaColumns).toBe(10);
    expect(l({ mouldSofaColumns: 1 }).mouldSofaColumns).toBe(2);
    expect(l({ mouldSofaColumns: 6.6 }).mouldSofaColumns).toBe(7);
    expect(l({ mouldSofaColumns: 'abc' }).mouldSofaColumns).toBe(5);
  });
  it('clamps the sofa-wall gap to 4-30', () => {
    expect(l({ mouldSofaGap: 99 }).mouldSofaGap).toBe(30);
    expect(l({ mouldSofaGap: 1 }).mouldSofaGap).toBe(4);
    expect(l({ mouldSofaGap: 12 }).mouldSofaGap).toBe(12);
  });
});

describe('lamp settings', () => {
  const P = PENDANTS[1].id, F = FLOOR_LAMPS[1].id;
  it('defaults every lamp to none', () => {
    const s = sanitizeSettings(null);
    expect(s.living).toMatchObject({ pendant: 'none', floorLamp: 'none' });
    expect(s.office).toEqual({ pendant: 'none', floorLamp: 'none' });
  });
  it('loads a version 2 design saved before lamps existed unchanged', () => {
    const old = { version: 2, room: 'living', time: 'eve', walls: DEFAULTS.walls, bedroom: DEFAULTS.bedroom, living: { hidden: ['sofa'] } };
    expect(sanitizeSettings(old)).toEqual({ ...DEFAULTS, room: 'living', time: 'eve', living: { ...DEFAULTS.living, hidden: ['sofa'] } });
  });
  it('keeps valid lamp ids and drops unknown ones', () => {
    const s = sanitizeSettings({ version: 2, living: { pendant: P, floorLamp: 'gone' }, office: { pendant: 'gone', floorLamp: F } });
    expect(s.living).toMatchObject({ pendant: P, floorLamp: 'none' });
    expect(s.office).toEqual({ pendant: 'none', floorLamp: F });
  });
  it('does not accept a floor lamp id as a pendant', () => {
    expect(sanitizeSettings({ version: 2, office: { pendant: F } }).office.pendant).toBe('none');
  });
  it('patches one office lamp without touching the other', () => {
    const s = applyPatch({ ...DEFAULTS, office: { pendant: P, floorLamp: F } }, { office: { pendant: 'none' } });
    expect(s.office).toEqual({ pendant: 'none', floorLamp: F });
  });
});
