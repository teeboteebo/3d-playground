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
  Object.fromEntries(Object.entries(s.rooms.living.components).filter(([id]) => id in allShown).map(([id, c]) => [id, c.shown]));

describe('sanitizeSettings', () => {
  it('returns defaults for empty or garbage input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULTS);
    expect(sanitizeSettings('x')).toEqual(DEFAULTS);
    expect(sanitizeSettings(v2({ time: 'noon', bedroom: { rug: 'flying-carpet', accent: 'red' } }))).toEqual(DEFAULTS);
  });

  it('gives the default office for a malformed one', () => {
    expect(sanitizeSettings({ version: 3, office: 'x' }).rooms.office).toEqual(DEFAULTS.rooms.office);
    expect(sanitizeSettings({ version: 3, office: { components: [] } }).rooms.office).toEqual(DEFAULTS.rooms.office);
  });

  it('keeps valid values and upper-cases the accent', () => {
    const s = sanitizeSettings(v2({ time: 'eve', bedroom: { accent: '#2f5d62', rug: 'palma', pillows: 'ink', pendant: 'off', mouldColour: 'tone' } }));
    expect(s.time).toBe('eve');
    const { accent, moulding, components } = s.rooms.bedroom;
    expect(accent).toBe('#2F5D62');
    expect(moulding.mouldColour).toBe('tone');
    expect(components.rug).toMatchObject({ shown: true, variant: 'palma' });
    expect(components.bed.options.pillows).toBe('ink');
    expect(components['ceiling-light'].shown).toBe(false);
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
    expect(s.rooms.living.paint).toBe('chalk');
    expect(s.rooms.office.paint).toBe('devine');
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
    expect(s.rooms.bedroom.accent).toBe('#2F5D62');
    expect(s.rooms.bedroom.moulding).toEqual({
      mouldColour: 'tone', mouldBedWall: 'off', mouldDresserWall: 'off', mouldSpacing: 12, mouldDado: 77, mouldWalls: DEFAULTS.rooms.bedroom.moulding.mouldWalls,
    });
    const c = s.rooms.bedroom.components;
    expect(c['ceiling-light'].shown).toBe(false);
    expect(c.wardrobes.options).toEqual({ colour: 'ink' });
    expect(c.rug).toMatchObject({ shown: true, variant: 'rista' });
    expect(c.bed.options).toEqual({ pillows: 'ink' });
    expect(c.painting.options).toEqual({ art: 'hills', frame: 'oak' });
  });

  it('moves the hidden furniture under living', () => {
    expect(shownIn(sanitizeSettings({ hidden: ['sofa', 'piano'] }))).toEqual({ ...allShown, sofa: false });
  });

  it("renames the office from 'end', in the selection and the wall colours", () => {
    const s = sanitizeSettings({ room: 'end', walls: { end: 'chalk' } });
    expect(s.room).toBe('office');
    expect(s.rooms.office.paint).toBe('chalk');
  });

  it('gives settings saved before rooms existed the room defaults', () => {
    const s = sanitizeSettings({ rug: 'rista' });
    expect(s.rooms.bedroom.components.rug.variant).toBe('rista');
    expect(s.room).toBe('all');
    expect(Object.fromEntries(Object.entries(s.rooms).map(([id, r]) => [id, r.paint]))).toEqual({ bedroom: 'antique', hall: 'frostrok', living: 'frostrok', office: 'devine' });
  });

  it('moves rooms off paints that were removed to their Jotun defaults', () => {
    const s = sanitizeSettings({ walls: { living: 'greige', end: 'bluegrey' } });
    expect([s.rooms.living.paint, s.rooms.office.paint]).toEqual(['frostrok', 'devine']);
  });

  it('migrates the single-file app\'s mould "off" value to white + hidden bed-wall moulding', () => {
    expect(sanitizeSettings({ mould: 'off', mouldB: 'on' }).rooms.bedroom.moulding).toMatchObject({ mouldColour: 'white', mouldBedWall: 'off' });
  });

  it("ignores the single-file app's fixed-finish keys", () => {
    expect(sanitizeSettings({ wall: 'ink', trim: 'white', floor: 'herring', oak: 'dark', size: '170x240' })).toEqual(DEFAULTS);
  });
});

describe('applyPatch', () => {
  it('merges a room patch into that room, keeping its other fields', () => {
    const s = applyPatch(DEFAULTS, { time: 'eve', rooms: { bedroom: { moulding: { mouldSpacing: 12 } } } });
    expect(s.time).toBe('eve');
    expect(s.rooms.bedroom).toEqual({ ...DEFAULTS.rooms.bedroom, moulding: { ...DEFAULTS.rooms.bedroom.moulding, mouldSpacing: 12 } });
    expect(s.rooms.living).toEqual(DEFAULTS.rooms.living);
  });
});

describe('applyPatch with unrecognized component ids', () => {
  it.each(['gone', 'constructor', '__proto__'])('leaves each room as it was for %s', (id) => {
    for (const room of ['office', 'bedroom', 'hall'] as const) {
      const patch = { rooms: { [room]: { components: JSON.parse(`{"${id}":{"shown":false}}`) } } };
      const s = applyPatch(DEFAULTS, patch);
      expect(s.rooms[room].components).toEqual(DEFAULTS.rooms[room].components);
      expect(Object.keys(s.rooms[room].components)).toEqual(Object.keys(DEFAULTS.rooms[room].components));
    }
  });
});

describe('load/save', () => {
  it('round-trips through storage', () => {
    const s = applyPatch(DEFAULTS, { rooms: { bedroom: { components: { rug: { variant: 'rista' } } } } });
    saveSettings(s);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(s);
    expect(loadSettings()).toEqual(s);
  });

  it('reads settings saved under the old key when there are none under the new one', () => {
    localStorage.clear();
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ rug: 'rista', room: 'end' }));
    expect(loadSettings()).toMatchObject({ room: 'office', rooms: { bedroom: { components: { rug: { variant: 'rista' } } } } });
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
    expect(s.rooms.living.moulding).toMatchObject({
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
    }).rooms.office.components;
    expect(c['ceiling-light']).toEqual({ shown: true, variant: P, options: {} });
    expect(c['floor-lamp']).toEqual({ shown: false, variant: FLOOR_LAMPS[0].id, options: {} });
    expect(c['reading-chair']).toEqual({ shown: false, variant: READING_CHAIRS[0].id, options: {} });
    expect(c.dresser).toEqual({ shown: true, variant: D2, options: {} });
    expect(c['round-rug']).toEqual({ shown: true, variant: ROUND_RUGS[0].id, options: {} });
  });
  it('migrates a version 1 save to the default office', () => {
    expect(sanitizeSettings({ room: 'living' }).rooms.office).toEqual(DEFAULTS.rooms.office);
  });
  it('reads version 5 as saved', () => {
    expect(sanitizeSettings(DEFAULTS)).toEqual(DEFAULTS);
    expect(DEFAULTS.version).toBe(6);
  });
  it('renames the office pendant', () => {
    const v3 = { version: 3, office: { components: { pendant: { shown: true, variant: P } } } };
    const c = sanitizeSettings(v3).rooms.office.components;
    expect(c['ceiling-light']).toEqual({ shown: true, variant: P, options: {} });
    expect('pendant' in c).toBe(false);
    expect(Object.keys(c)).toEqual(OFFICE.components.map((x) => x.id));
  });
  it('merges a patch into one component', () => {
    const s = applyPatch(DEFAULTS, { rooms: { office: { components: { desk: { shown: false } } } } });
    expect(s.rooms.office.components).toEqual({ ...DEFAULTS.rooms.office.components, desk: { ...DEFAULTS.rooms.office.components.desk, shown: false } });
  });
});

describe('living room components', () => {
  const P = PENDANTS[0].id;
  const F = BEMZ_FABRICS[0].code;
  const living = (l: object, version = 2) => sanitizeSettings({ version, living: l }).rooms.living;
  const livingV4 = (l: object) => living(l, 4);
  it('defaults the lamps to hidden, the furniture to shown and the sofa to its own fabric', () => {
    const c = sanitizeSettings(null).rooms.living.components;
    expect(c['ceiling-light'].shown).toBe(false);
    expect(c['floor-lamp'].shown).toBe(false);
    expect(c.sofa).toEqual({ shown: true, variant: 'nockeby', options: { fabric: 'original' } });
    expect(c.rug.shown).toBe(true);
  });
  it('migrates the version 3 living room', () => {
    const l = sanitizeSettings({
      version: 3,
      living: { hidden: ['sofa', 'plant'], pendant: P, floorLamp: 'none', sofaFabric: F, mouldColour: 'tone', mouldSpacing: 12 },
    }).rooms.living;
    expect(l.components.sofa).toEqual({ shown: false, variant: 'nockeby', options: { fabric: F } });
    expect(l.components.plant.shown).toBe(false);
    expect(l.components.tv.shown).toBe(true);
    expect(l.components['ceiling-light']).toEqual({ shown: true, variant: P, options: {} });
    expect(l.components['floor-lamp'].shown).toBe(false);
    expect(l.moulding).toMatchObject({ mouldColour: 'tone', mouldSpacing: 12 });
    for (const old of ['hidden', 'pendant', 'floorLamp', 'sofaFabric']) expect(old in l.moulding).toBe(false);
  });
  it('loads a version 2 design saved before lamps existed unchanged', () => {
    const old = { version: 2, room: 'living', time: 'eve', living: { hidden: ['sofa'] } };
    const s = sanitizeSettings(old);
    expect(s.rooms.living.components.sofa).toEqual({ ...DEFAULTS.rooms.living.components.sofa, shown: false });
    expect(s).toEqual({
      ...DEFAULTS, room: 'living', time: 'eve',
      rooms: { ...DEFAULTS.rooms, living: { ...DEFAULTS.rooms.living, components: { ...DEFAULTS.rooms.living.components, sofa: s.rooms.living.components.sofa } } },
    });
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
    const c = livingV4({ components: { sofa: { shown: false, variant: 'x', options: { fabric: F } }, rug: 'x' } }).components;
    expect(c.sofa).toEqual({ shown: false, variant: 'nockeby', options: { fabric: F } });
    expect(c.rug).toEqual(DEFAULTS.rooms.living.components.rug);
  });
  it('merges a patch into one living component, options included', () => {
    const s = applyPatch(DEFAULTS, { rooms: { living: { components: { sofa: { options: { fabric: F } }, plant: { shown: false } } } } });
    const l = s.rooms.living;
    expect(l.components.sofa).toEqual({ shown: true, variant: 'nockeby', options: { fabric: F } });
    expect(l.components.plant.shown).toBe(false);
    expect(l.components.tv).toEqual(DEFAULTS.rooms.living.components.tv);
    expect(l.moulding.mouldSpacing).toBe(DEFAULTS.rooms.living.moulding.mouldSpacing);
  });
});

describe('moulding spacing settings', () => {
  it('maps a legacy bedroom gap to the spacing, with default walls', () => {
    const b = sanitizeSettings({ version: 2, bedroom: { mouldGap: 12 } }).rooms.bedroom.moulding;
    expect(b.mouldSpacing).toBe(12);
    expect(b.mouldWalls).toEqual(DEFAULTS.rooms.bedroom.moulding.mouldWalls);
  });
  it('caps a legacy gap so the lower row survives, but never caps a saved spacing', () => {
    expect(sanitizeSettings({ version: 2, bedroom: { mouldGap: 30 } }).rooms.bedroom.moulding.mouldSpacing).toBe(22);
    expect(sanitizeSettings({ mgap: 30 }).rooms.bedroom.moulding.mouldSpacing).toBe(22);
    expect(sanitizeSettings({ version: 2, living: { mouldSofaGap: 30 } }).rooms.living.moulding.mouldSpacing).toBe(22);
    expect(sanitizeSettings({ version: 2, bedroom: { mouldSpacing: 30 } }).rooms.bedroom.moulding.mouldSpacing).toBe(30);
  });
  it('maps legacy sofa gap and columns', () => {
    const l = sanitizeSettings({ version: 2, living: { mouldSofaGap: 14, mouldSofaColumns: 7 } }).rooms.living.moulding;
    expect(l.mouldSpacing).toBe(14);
    expect(l.mouldWalls.sofa.columns).toBe(7);
  });
  it('maps a version 1 save', () => {
    expect(sanitizeSettings({ mgap: 12 }).rooms.bedroom.moulding.mouldSpacing).toBe(12);
  });
  it('ignores the legacy fields when mouldWalls is present', () => {
    const l = sanitizeSettings({ version: 2, living: { mouldSofaGap: 14, mouldSofaColumns: 7, mouldWalls: {} } }).rooms.living.moulding;
    expect(l.mouldSpacing).toBe(DEFAULTS.rooms.living.moulding.mouldSpacing);
    expect(l.mouldWalls.sofa.columns).toBe(5);
  });
  it('clamps dado, defaulting to 77, and rejects junk', () => {
    expect(DEFAULTS.rooms.bedroom.moulding.mouldDado).toBe(77);
    expect(sanitizeSettings({ version: 2, bedroom: { mouldDado: 10 } }).rooms.bedroom.moulding.mouldDado).toBe(60);
    expect(sanitizeSettings({ version: 2, living: { mouldDado: 500 } }).rooms.living.moulding.mouldDado).toBe(110);
    expect(sanitizeSettings({ version: 2, living: { mouldDado: 'x', mouldSpacing: NaN } }).rooms.living.moulding).toMatchObject({ mouldDado: 77, mouldSpacing: 8 });
  });
  it('sanitises each wall with its own minimum and bed rule', () => {
    const b = sanitizeSettings({ version: 2, bedroom: { mouldWalls: { dresser: { columns: 0, fixedPosition: 'bed' }, bed: { columns: 0, fixedPosition: 'bed' } } } }).rooms.bedroom.moulding.mouldWalls;
    expect(b.dresser.columns).toBe(1);
    expect(b.dresser.fixedPosition).toBe('even');
    expect(b.bed.columns).toBe(1);
    expect(b.bed.fixedPosition).toBe('bed');
  });
  it('starts a dresser wall saved as three sections from the one-wall default', () => {
    const b = sanitizeSettings({
      version: 2,
      bedroom: { mouldWalls: { bed: { columns: 5 }, dresserWindow: { columns: 2 }, dresserMiddle: { columns: 1 }, dresserCorner: { columns: 1 } } },
    }).rooms.bedroom.moulding.mouldWalls;
    expect(Object.keys(b)).toEqual(['bed', 'dresser']);
    expect(b.dresser).toEqual(DEFAULTS.rooms.bedroom.moulding.mouldWalls.dresser);
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

describe('version 5 rooms', () => {
  it('has a state for each of the four rooms, the hall with a paint and no pieces', () => {
    expect(Object.keys(DEFAULTS.rooms)).toEqual(['bedroom', 'hall', 'living', 'office']);
    expect(DEFAULTS.rooms.hall).toMatchObject({ paint: 'frostrok', components: {} });
    expect(Object.keys(DEFAULTS.rooms.bedroom.components)).toEqual([
      'ceiling-light', 'bedside-lamp-left', 'bedside-lamp-right', 'bed', 'bench', 'bedside-table-left', 'bedside-table-right', 'dresser', 'mirror', 'painting', 'wardrobes', 'rug',
    ]);
  });

  it('starts the bedroom as it looked before: both lamp kinds on, every piece shown', () => {
    const c = DEFAULTS.rooms.bedroom.components;
    expect(Object.values(c).every((x) => x.shown)).toBe(true);
    expect(c.rug.variant).not.toBe('none');
  });

  it('reads a saved version 5 design, and clamps its garbage', () => {
    const saved = applyPatch(DEFAULTS, { rooms: { bedroom: { accent: '#2f5d62', components: { rug: { shown: false, variant: 'palma' } } }, hall: { paint: 'chalk' } } });
    expect(sanitizeSettings(JSON.parse(JSON.stringify(saved)))).toEqual({ ...saved, rooms: { ...saved.rooms, bedroom: { ...saved.rooms.bedroom, accent: '#2F5D62' } } });
    const junk = sanitizeSettings({ version: 5, rooms: { bedroom: { accent: 'red', components: { rug: { shown: 'yes', variant: 'none' }, gone: {} } }, hall: { paint: 'neon' } } });
    expect(junk.rooms.bedroom).toEqual(DEFAULTS.rooms.bedroom);
    expect(junk.rooms.hall).toEqual(DEFAULTS.rooms.hall);
  });

  it('keeps a hidden piece\'s product and options', () => {
    const s = applyPatch(DEFAULTS, { rooms: { bedroom: { components: { rug: { variant: 'rista' }, painting: { options: { art: 'hills' } } } } } });
    const hidden = applyPatch(s, { rooms: { bedroom: { components: { rug: { shown: false }, painting: { shown: false } } } } });
    const back = sanitizeSettings(JSON.parse(JSON.stringify(hidden))).rooms.bedroom.components;
    expect(back.rug).toEqual({ shown: false, variant: 'rista', options: {} });
    expect(back.painting.options.art).toBe('hills');
  });

  it('patches the art and the frame on their own', () => {
    const s = applyPatch(DEFAULTS, { rooms: { bedroom: { components: { painting: { options: { frame: 'oak' } } } } } });
    expect(s.rooms.bedroom.components.painting.options).toEqual({ ...DEFAULTS.rooms.bedroom.components.painting.options, frame: 'oak' });
  });

  it('keeps the store\'s moulding products global, for every room', () => {
    const shop = { ...SHOP_DEFAULTS, joins: true };
    expect(applyPatch(DEFAULTS, { mouldShop: shop }).mouldShop).toEqual(shop);
    expect('mouldShop' in DEFAULTS.rooms.bedroom).toBe(false);
  });
});

describe('migrating version 4 to 5', () => {
  const v4 = (patch: Record<string, unknown>) => sanitizeSettings({ version: 4, ...patch });

  it('moves paint to its room, and the office alias', () => {
    const s = v4({ walls: { bedroom: 'chalk', hall: 'chalk', living: 'chalk', end: 'chalk' } });
    expect(Object.values(s.rooms).map((r) => r.paint)).toEqual(['chalk', 'chalk', 'chalk', 'chalk']);
    expect('walls' in s).toBe(false);
  });

  it('maps every old bedroom choice to its piece', () => {
    const s = v4({ bedroom: { pendant: 'off', wardrobes: 'trim', rug: 'rista', pillows: 'cream', art: 'hills', frame: 'oak', accent: '#2f5d62', mouldDado: 70, mouldBedWall: 'off' } });
    const b = s.rooms.bedroom;
    expect(b.accent).toBe('#2F5D62');
    expect(b.components['ceiling-light'].shown).toBe(false);
    expect(b.components.wardrobes.options).toEqual({ colour: 'trim' });
    expect(b.components.rug).toMatchObject({ shown: true, variant: 'rista' });
    expect(b.components.bed.options).toEqual({ pillows: 'cream' });
    expect(b.components.painting.options).toEqual({ art: 'hills', frame: 'oak' });
    expect(b.moulding).toMatchObject({ mouldDado: 70, mouldBedWall: 'off' });
    for (const gone of ['pendant', 'rug', 'pillows', 'art', 'frame', 'wardrobes']) expect(gone in b.moulding).toBe(false);
  });

  it('turns the old pendant on into a shown ceiling light', () => {
    expect(v4({ bedroom: { pendant: 'on' } }).rooms.bedroom.components['ceiling-light'].shown).toBe(true);
  });

  it('turns the old no rug into a hidden rug with a real product', () => {
    const rug = v4({ bedroom: { rug: 'none' } }).rooms.bedroom.components.rug;
    expect(rug.shown).toBe(false);
    expect(rug.variant).toBe(DEFAULTS.rooms.bedroom.components.rug.variant);
    expect(rug.variant).not.toBe('none');
  });

  it('keeps the living room\'s pieces, fabric and moulding, and the office\'s pieces', () => {
    const s = v4({
      living: { components: { sofa: { shown: false, variant: 'nockeby', options: { fabric: BEMZ_FABRICS[0].code } } }, mouldColour: 'tone', mouldSpacing: 12 },
      office: { components: { desk: { shown: false } } },
    });
    expect(s.rooms.living.components.sofa).toEqual({ shown: false, variant: 'nockeby', options: { fabric: BEMZ_FABRICS[0].code } });
    expect(s.rooms.living.moulding).toMatchObject({ mouldColour: 'tone', mouldSpacing: 12 });
    expect(s.rooms.office.components.desk.shown).toBe(false);
  });

  it('keeps the hall to its paint', () => {
    expect(v4({ walls: { hall: 'chalk' } }).rooms.hall).toMatchObject({ paint: 'chalk', components: {} });
  });

  it('keeps the store products and the selection', () => {
    const shop = { ...SHOP_DEFAULTS, joins: true };
    const s = v4({ room: 'hall', time: 'eve', mouldShop: shop });
    expect([s.version, s.room, s.time, s.mouldShop]).toEqual([6, 'hall', 'eve', shop]);
  });

  it('walks a version 2 and a version 3 design through every step', () => {
    const v2d = sanitizeSettings({ version: 2, room: 'end', walls: { end: 'chalk' }, bedroom: { rug: 'none', pendant: 'off' }, living: { hidden: ['sofa'] } });
    expect(v2d.room).toBe('office');
    expect(v2d.rooms.office.paint).toBe('chalk');
    expect(v2d.rooms.bedroom.components.rug.shown).toBe(false);
    expect(v2d.rooms.living.components.sofa.shown).toBe(false);
    const v3d = sanitizeSettings({ version: 3, office: { pendant: PENDANTS[0].id }, bedroom: { art: 'hills' } });
    expect(v3d.rooms.office.components['ceiling-light'].variant).toBe(PENDANTS[0].id);
    expect(v3d.rooms.bedroom.components.painting.options.art).toBe('hills');
  });

  it('reads the design saved under the old key through every step', () => {
    localStorage.clear();
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ rug: 'none', pendant: 'off', mould: 'tone', room: 'end', walls: { end: 'chalk' } }));
    const s = loadSettings();
    expect(s.version).toBe(6);
    expect(s.room).toBe('office');
    expect(s.rooms.office.paint).toBe('chalk');
    expect(s.rooms.bedroom.components.rug.shown).toBe(false);
    expect(s.rooms.bedroom.components['ceiling-light'].shown).toBe(false);
  });
});

describe('migrating version 5 to 6', () => {
  const v5 = (components: Record<string, unknown>) =>
    sanitizeSettings({ version: 5, rooms: { bedroom: { components } } }).rooms.bedroom;

  it('gives both tables and both lamps the state the pair had, so a hidden pair stays hidden', () => {
    const b = v5({
      'bedside-tables': { shown: false, variant: 'cholet', options: {} },
      'bedside-lamps': { shown: true, variant: 'adina', options: {} },
    });
    expect(b.components['bedside-table-left'].shown).toBe(false);
    expect(b.components['bedside-table-right'].shown).toBe(false);
    expect(b.components['bedside-lamp-left'].shown).toBe(true);
    expect(b.components['bedside-lamp-right'].shown).toBe(true);
    expect('bedside-tables' in b.components).toBe(false);
  });

  it('starts each room from its authored groups', () => {
    const b = v5({});
    expect(b.tree.groups['bedside-tables'].children).toEqual(['bedside-table-left', 'bedside-table-right']);
  });
});

describe('the saved group tree', () => {
  it('keeps an ungrouped bedroom ungrouped across a save and a load', () => {
    const flat = { root: DEFAULTS.rooms.bedroom.components ? Object.keys(DEFAULTS.rooms.bedroom.components) : [], groups: {} };
    const s = applyPatch(DEFAULTS, { rooms: { bedroom: { tree: flat } } });
    expect(sanitizeSettings(JSON.parse(JSON.stringify(s))).rooms.bedroom.tree).toEqual(flat);
  });

  it('repairs a tree that holds nothing valid', () => {
    const s = sanitizeSettings({ ...DEFAULTS, rooms: { ...DEFAULTS.rooms, office: { ...DEFAULTS.rooms.office, tree: { root: ['zzz'], groups: {} } } } });
    expect(s.rooms.office.tree.root.length).toBe(OFFICE.components.length);
  });
});
