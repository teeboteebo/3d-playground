import { describe, expect, it } from 'vitest';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { DRESSERS, FLOOR_LAMPS, PENDANTS, READING_CHAIRS, ROUND_RUGS } from '../data/catalog';
import { OFFICE } from '../data/office';
import { DEFAULTS, type Settings, LEGACY_STORAGE_KEY, STORAGE_KEY, applyPatch, loadSettings, sanitizeSettings, saveSettings } from './settings';
import { SHOP_DEFAULTS } from './mouldShop';

const v2 = (patch: Record<string, unknown>) => ({ version: 2, ...patch });
const allShown = { sofa: true, tv: true, 'tv-bench': true, shelving: true, plant: true, rug: true };
/** which living-room furniture pieces are shown */
const shownIn = (s: Settings) =>
  Object.fromEntries(Object.entries(s.living.components).filter(([id]) => id in allShown).map(([id, c]) => [id, c.shown]));

describe('sanitizeSettings', () => {
  it('returns defaults for empty or garbage input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULTS);
    expect(sanitizeSettings('x')).toEqual(DEFAULTS);
    expect(sanitizeSettings(v2({ time: 'noon', bedroom: { rug: 'flying-carpet', accent: 'red' } }))).toEqual(DEFAULTS);
  });

  it('gives the default office for a malformed one', () => {
    expect(sanitizeSettings({ version: 3, office: 'x' }).office).toEqual(DEFAULTS.office);
    expect(sanitizeSettings({ version: 3, office: { components: [] } }).office).toEqual(DEFAULTS.office);
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
    expect(shownIn(s)).toEqual({ ...allShown, sofa: false });
  });

  it('replaces unknown rooms, swatches and furniture ids', () => {
    const s = sanitizeSettings(v2({ room: 'attic', walls: { living: 'chalk', office: 'neon' }, living: { hidden: ['sofa', 'piano', 3, 'sofa'] } }));
    expect(s.room).toBe('all');
    expect(s.walls.living).toBe('chalk');
    expect(s.walls.office).toBe('devine');
    expect(shownIn(s)).toEqual({ ...allShown, sofa: false });
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
    expect(shownIn(sanitizeSettings({ hidden: ['sofa', 'piano'] }))).toEqual({ ...allShown, sofa: false });
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

describe('office settings', () => {
  const P = PENDANTS[0].id, D2 = DRESSERS[1].id;
  it('migrates the version 2 office', () => {
    const c = sanitizeSettings({
      version: 2,
      office: { pendant: P, floorLamp: 'none', readingChair: 'none', dresser: D2, roundRug: 'gone' },
    }).office.components;
    expect(c['ceiling-light']).toEqual({ shown: true, variant: P, options: {} });
    expect(c['floor-lamp']).toEqual({ shown: false, variant: FLOOR_LAMPS[0].id, options: {} });
    expect(c['reading-chair']).toEqual({ shown: false, variant: READING_CHAIRS[0].id, options: {} });
    expect(c.dresser).toEqual({ shown: true, variant: D2, options: {} });
    expect(c['round-rug']).toEqual({ shown: true, variant: ROUND_RUGS[0].id, options: {} });
  });
  it('migrates a version 1 save to the default office', () => {
    expect(sanitizeSettings({ room: 'living' }).office).toEqual(DEFAULTS.office);
  });
  it('reads version 4 as saved', () => {
    expect(sanitizeSettings(DEFAULTS)).toEqual(DEFAULTS);
    expect(DEFAULTS.version).toBe(4);
  });
  it('renames the office pendant', () => {
    const v3 = { version: 3, office: { components: { pendant: { shown: true, variant: P } } } };
    const c = sanitizeSettings(v3).office.components;
    expect(c['ceiling-light']).toEqual({ shown: true, variant: P, options: {} });
    expect('pendant' in c).toBe(false);
    expect(Object.keys(c)).toEqual(OFFICE.components.map((x) => x.id));
  });
  it('merges a patch into one component', () => {
    const s = applyPatch(DEFAULTS, { office: { components: { desk: { shown: false } } } });
    expect(s.office.components).toEqual({ ...DEFAULTS.office.components, desk: { ...DEFAULTS.office.components.desk, shown: false } });
  });
});

describe('living room components', () => {
  const P = PENDANTS[0].id;
  const F = BEMZ_FABRICS[0].code;
  const living = (l: object, version = 2) => sanitizeSettings({ version, living: l }).living;
  it('defaults the lamps to hidden, the furniture to shown and the sofa to its own fabric', () => {
    const c = sanitizeSettings(null).living.components;
    expect(c['ceiling-light'].shown).toBe(false);
    expect(c['floor-lamp'].shown).toBe(false);
    expect(c.sofa).toEqual({ shown: true, variant: 'nockeby', options: { fabric: 'original' } });
    expect(c.rug.shown).toBe(true);
  });
  it('migrates the version 3 living room', () => {
    const l = sanitizeSettings({
      version: 3,
      living: { hidden: ['sofa', 'plant'], pendant: P, floorLamp: 'none', sofaFabric: F, mouldColour: 'tone', mouldSpacing: 12 },
    }).living;
    expect(l.components.sofa).toEqual({ shown: false, variant: 'nockeby', options: { fabric: F } });
    expect(l.components.plant.shown).toBe(false);
    expect(l.components.tv.shown).toBe(true);
    expect(l.components['ceiling-light']).toEqual({ shown: true, variant: P, options: {} });
    expect(l.components['floor-lamp'].shown).toBe(false);
    expect(l).toMatchObject({ mouldColour: 'tone', mouldSpacing: 12 });
    for (const old of ['hidden', 'pendant', 'floorLamp', 'sofaFabric']) expect(old in l).toBe(false);
  });
  it('loads a version 2 design saved before lamps existed unchanged', () => {
    const old = { version: 2, room: 'living', time: 'eve', walls: DEFAULTS.walls, bedroom: DEFAULTS.bedroom, living: { hidden: ['sofa'] } };
    const s = sanitizeSettings(old);
    expect(s.living.components.sofa).toEqual({ ...DEFAULTS.living.components.sofa, shown: false });
    expect(s).toEqual({ ...DEFAULTS, room: 'living', time: 'eve', living: { ...DEFAULTS.living, components: { ...DEFAULTS.living.components, sofa: s.living.components.sofa } } });
  });
  it('keeps valid lamp ids and hides unknown ones', () => {
    const c = living({ pendant: P, floorLamp: 'gone' }).components;
    expect(c['ceiling-light']).toMatchObject({ shown: true, variant: P });
    expect(c['floor-lamp']).toMatchObject({ shown: false, variant: FLOOR_LAMPS[0].id });
  });
  it('keeps a known Bemz fabric code, and the original', () => {
    expect(living({ sofaFabric: F }).components.sofa.options.fabric).toBe(F);
    expect(living({ sofaFabric: 'original' }).components.sofa.options.fabric).toBe('original');
  });
  it('falls back to the original fabric for unknown codes, non-strings and missing values', () => {
    expect(living({ sofaFabric: 'XXX999' }).components.sofa.options.fabric).toBe('original');
    expect(living({ sofaFabric: 42 }).components.sofa.options.fabric).toBe('original');
    expect(living({}).components.sofa.options.fabric).toBe('original');
  });
  it('sanitises a saved version 4 living room', () => {
    const c = living({ components: { sofa: { shown: false, variant: 'x', options: { fabric: F } }, rug: 'x' } }, 4).components;
    expect(c.sofa).toEqual({ shown: false, variant: 'nockeby', options: { fabric: F } });
    expect(c.rug).toEqual(DEFAULTS.living.components.rug);
  });
  it('merges a patch into one living component, options included', () => {
    const s = applyPatch(DEFAULTS, { living: { components: { sofa: { options: { fabric: F } }, plant: { shown: false } } } });
    expect(s.living.components.sofa).toEqual({ shown: true, variant: 'nockeby', options: { fabric: F } });
    expect(s.living.components.plant.shown).toBe(false);
    expect(s.living.components.tv).toEqual(DEFAULTS.living.components.tv);
    expect(s.living.mouldSpacing).toBe(DEFAULTS.living.mouldSpacing);
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
    const b = sanitizeSettings({ version: 2, bedroom: { mouldWalls: { dresser: { columns: 0, fixedPosition: 'bed' }, bed: { columns: 0, fixedPosition: 'bed' } } } }).bedroom.mouldWalls;
    expect(b.dresser.columns).toBe(1);
    expect(b.dresser.fixedPosition).toBe('even');
    expect(b.bed.columns).toBe(1);
    expect(b.bed.fixedPosition).toBe('bed');
  });
  it('starts a dresser wall saved as three sections from the one-wall default', () => {
    const b = sanitizeSettings({
      version: 2,
      bedroom: { mouldWalls: { bed: { columns: 5 }, dresserWindow: { columns: 2 }, dresserMiddle: { columns: 1 }, dresserCorner: { columns: 1 } } },
    }).bedroom.mouldWalls;
    expect(Object.keys(b)).toEqual(['bed', 'dresser']);
    expect(b.dresser).toEqual(DEFAULTS.bedroom.mouldWalls.dresser);
    expect(b.bed.columns).toBe(5);
  });
});

describe('moulding shop settings', () => {
  it('starts from the shop defaults', () => {
    expect(sanitizeSettings({ version: 2 }).mouldShop).toEqual(SHOP_DEFAULTS);
    expect(DEFAULTS.mouldShop).toEqual(SHOP_DEFAULTS);
  });
  it('keeps a saved shop through save and load', () => {
    const shop = { ...SHOP_DEFAULTS, joins: true, panel: { ...SHOP_DEFAULTS.panel, lengths: [{ length: 240, price: 89 }] } };
    const s = { ...DEFAULTS, mouldShop: shop };
    saveSettings(s);
    expect(loadSettings().mouldShop).toEqual(shop);
  });
});
