import { ACCENT_DEFAULT, DRESSERS, FLOOR_LAMPS, PAINTS, PENDANTS, READING_CHAIRS, ROUND_RUGS } from '../data/catalog';
import { LIVING } from '../data/living';
import { OFFICE } from '../data/office';
import { ROOM_DEFS, type ComponentId } from '../data/roomDefs';
import { roomById, ROOM_IDS, type RoomId, type RoomSelection } from '../data/rooms';
import { isHex } from '../lib/color';
import { clamp } from '../lib/math';
import { spacingMax, type MouldWall } from '../scene/mouldLayout';
import { SHOP_DEFAULTS, sanitizeShop, type MouldShop } from './mouldShop';
import { componentDefaults, patchComponents, sanitizeComponents, type ComponentStates } from './components';
import type { ComponentState } from '../data/components';
import { BEDROOM, BEDSIDES } from '../data/bedroom';
import { defaultTree, sanitizeTree, type RoomTree } from '../data/tree';
import { HALL } from '../data/hall';
import {
  BEDROOM_MOULD_DEFAULTS, LIVING_MOULD_DEFAULTS, MOULD_SLIDERS, sanitizeMouldWall, type BedroomSection, type LivingSection,
} from './mould';

export type OnOff = 'on' | 'off';

/** the bedroom's wall moulding */
export interface BedroomMoulding {
  mouldColour: 'white' | 'tone';
  mouldBedWall: OnOff;
  mouldDresserWall: OnOff;
  /** room-wide moulding spacing and dado (rail top) height, cm; the walls hold their own columns */
  mouldSpacing: number;
  mouldDado: number;
  mouldWalls: Record<BedroomSection, MouldWall>;
}

/** the living room's wall moulding */
export interface LivingMoulding {
  mouldColour: 'white' | 'tone';
  mouldSofaWall: OnOff;
  mouldTvWall: OnOff;
  mouldSpacing: number;
  mouldDado: number;
  mouldWalls: Record<LivingSection, MouldWall>;
}

/** what every room keeps: its paint, and each of its components, shown or hidden, and which product it is */
export interface RoomState<R extends RoomId> {
  paint: string;
  components: ComponentStates<ComponentId<R>>;
  /** which pieces are grouped with which: a hierarchy of component ids that the user edits */
  tree: RoomTree;
}

/** the rooms' settings; `accent` and `moulding` are only in the rooms that have them */
export interface Rooms {
  bedroom: RoomState<'bedroom'> & { accent: string; moulding: BedroomMoulding };
  hall: RoomState<'hall'>;
  living: RoomState<'living'> & { moulding: LivingMoulding };
  office: RoomState<'office'>;
}

export interface Settings {
  version: 6;
  /** selected room, or 'all' for none */
  room: RoomSelection;
  /** lighting, shared by every room */
  time: 'day' | 'eve';
  rooms: Rooms;
  /** the moulding products and cut settings, shared by every room */
  mouldShop: MouldShop;
}

/** a change to one room: its own fields, and any fields of its moulding and of each of its components */
export type RoomPatch<R extends RoomId> = Partial<Omit<Rooms[R], 'components' | 'moulding'>> & {
  components?: Partial<Record<ComponentId<R>, Partial<ComponentState>>>;
} & (Rooms[R] extends { moulding: infer M } ? { moulding?: Partial<M> } : unknown);

/** a change to the settings: top-level fields, and any fields of any room */
export type SettingsPatch = Partial<Omit<Settings, 'version' | 'rooms'>> & {
  rooms?: { [R in RoomId]?: RoomPatch<R> };
};

export function applyPatch(s: Settings, p: SettingsPatch): Settings {
  const { rooms: patch, ...top } = p;
  if (!patch) return { ...s, ...top };
  const rooms = { ...s.rooms };
  function patchRoom<R extends RoomId>(id: R) {
    const rp = patch?.[id];
    if (!rp) return;
    const cur = s.rooms[id];
    rooms[id] = {
      ...cur,
      ...rp,
      components: rp.components ? patchComponents(ROOM_DEFS[id], cur.components, rp.components) : cur.components,
      ...('moulding' in cur && 'moulding' in rp ? { moulding: Object.assign({}, cur.moulding, rp.moulding) } : {}),
    };
  }
  ROOM_IDS.forEach(patchRoom);
  return { ...s, ...top, rooms };
}

export const STORAGE_KEY = 'apartment-playground';
/** where settings were saved before version 2 (by this app and by the original single-file app) */
export const LEGACY_STORAGE_KEY = 'bedroom-viz';

export const DEFAULTS: Settings = {
  version: 6,
  room: 'all',
  time: 'day',
  rooms: {
    bedroom: {
      paint: roomById('bedroom').paint,
      accent: ACCENT_DEFAULT,
      moulding: {
        mouldColour: 'white',
        mouldBedWall: 'on',
        mouldDresserWall: 'on',
        mouldSpacing: 8,
        mouldDado: 77,
        mouldWalls: BEDROOM_MOULD_DEFAULTS,
      },
      components: componentDefaults(BEDROOM),
      tree: defaultTree(BEDROOM),
    },
    hall: { paint: roomById('hall').paint, components: componentDefaults(HALL), tree: defaultTree(HALL) },
    living: {
      paint: roomById('living').paint,
      moulding: {
        mouldColour: 'white',
        mouldSofaWall: 'on',
        mouldTvWall: 'on',
        mouldSpacing: 8,
        mouldDado: 77,
        mouldWalls: LIVING_MOULD_DEFAULTS,
      },
      components: componentDefaults(LIVING),
      tree: defaultTree(LIVING),
    },
    office: { paint: roomById('office').paint, components: componentDefaults(OFFICE), tree: defaultTree(OFFICE) },
  },
  mouldShop: SHOP_DEFAULTS,
};

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' ? v : {}) as Raw;

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

const ids = (list: readonly { id: string }[]) => list.map((o) => o.id);
const onOff = (v: unknown): OnOff => (v === 'off' ? 'off' : 'on');
/** the office's id was 'end' before version 2 */
const roomId = (v: unknown) => (v === 'end' ? 'office' : v);

/** Settings saved before version 2 were flat, with short field names; move them into the version 2 shape. */
function fromVersion1(s: Raw): Raw {
  // Legacy: mould 'off' meant "white moulding, hidden on the bed wall".
  const legacyOff = s.mould === 'off';
  return {
    room: s.room,
    time: s.time,
    walls: s.walls,
    bedroom: {
      accent: s.accent,
      mouldColour: s.mould,
      mouldBedWall: legacyOff ? 'off' : s.mouldB,
      mouldDresserWall: s.mouldF,
      mouldGap: s.mgap,
      pendant: s.pendant,
      wardrobes: s.ward,
      rug: s.rug,
      pillows: s.pillows,
      art: s.art,
      frame: s.frame,
    },
    living: { hidden: s.hidden },
  };
}

/**
 * the version 2 office's five catalog ids, as component states: 'none' is a hidden piece, a known id a shown one, and
 * anything else is left out so it takes the initial state (version 2 took its default, a lamp's being none)
 */
function fromVersion2Office(raw: unknown): Raw {
  const o = obj(raw);
  const lists: [string, string, readonly { id: string }[]][] = [
    ['pendant', 'pendant', PENDANTS],
    ['floor-lamp', 'floorLamp', FLOOR_LAMPS],
    ['reading-chair', 'readingChair', READING_CHAIRS],
    ['dresser', 'dresser', DRESSERS],
    ['round-rug', 'roundRug', ROUND_RUGS],
  ];
  const components: Raw = {};
  for (const [id, old, list] of lists) {
    const v = o[old];
    if (v === 'none') components[id] = { shown: false };
    else if (list.some((i) => i.id === v)) components[id] = { shown: true, variant: v };
    /* missing or unknown: the component's initial state, as version 2 took its default */
  }
  return { components };
}

/**
 * the version 3 living room's lamps, hidden furniture and sofa fabric, as component states, with the moulding fields
 * left where they are; and the office's pendant under its new name. A 'none' or unknown lamp is a hidden one.
 */
function fromVersion3(s: Raw): Raw {
  const l = obj(s.living);
  const { hidden, pendant, floorLamp, sofaFabric, ...rest } = l;
  const gone = Array.isArray(hidden) ? hidden : [];
  const lamp = (v: unknown, list: readonly { id: string }[]): Raw =>
    v !== 'none' && list.some((i) => i.id === v) ? { shown: true, variant: v } : { shown: false };
  const components: Raw = {
    'ceiling-light': lamp(pendant, PENDANTS),
    'floor-lamp': lamp(floorLamp, FLOOR_LAMPS),
  };
  for (const c of LIVING.components) if (c.category !== 'lighting') components[c.id] = { shown: !gone.includes(c.id) };
  components.sofa = { ...obj(components.sofa), options: { fabric: sofaFabric } };
  const { pendant: oldPendant, ...officeRest } = obj(obj(s.office).components);
  return {
    ...s,
    living: { ...rest, components },
    office: { components: oldPendant === undefined ? officeRest : { ...officeRest, 'ceiling-light': oldPendant } },
  };
}

/** room spacing and dado; a pre-wall save (no mouldWalls) takes its spacing from the old gap field */
function sanitizeMouldRoom(raw: Raw, legacyGap: unknown, d: { mouldSpacing: number; mouldDado: number }) {
  const legacy = raw.mouldWalls === undefined ? legacyGap : undefined;
  const n = (v: unknown, fallback: number, s: { min: number; max: number }) => {
    const x = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
    return clamp(v !== undefined && v !== null && Number.isFinite(x) ? x : fallback, s.min, s.max);
  };
  const mouldDado = n(raw.mouldDado, d.mouldDado, MOULD_SLIDERS.dado);
  /* a legacy gap ran 4 to 30 cm: keep it as far as the lower row still fits, so no row vanishes in the migration */
  const legacyCap = Math.floor(spacingMax(mouldDado / 100) * 100 + 1e-6);
  return {
    mouldSpacing:
      raw.mouldSpacing !== undefined && raw.mouldSpacing !== null
        ? n(raw.mouldSpacing, d.mouldSpacing, MOULD_SLIDERS.spacing)
        : Math.min(n(legacy, d.mouldSpacing, MOULD_SLIDERS.spacing), Math.max(MOULD_SLIDERS.spacing.min, legacyCap)),
    mouldDado,
  };
}

/** each wall section's settings; a pre-wall save keeps the sofa column count */
function sanitizeWalls<K extends string>(
  raw: unknown, defaults: Record<K, MouldWall>, rules: Record<K, { minColumns: 0 | 1; allowBed: boolean }>, legacy: Partial<Record<K, Raw>>,
): Record<K, MouldWall> {
  const o = obj(raw);
  const present = raw !== undefined;
  return Object.fromEntries(
    (Object.keys(defaults) as K[]).map((k) => [k, sanitizeMouldWall(present ? o[k] : legacy[k], defaults[k], rules[k])]),
  ) as Record<K, MouldWall>;
}

function sanitizeLivingMoulding(raw: unknown): LivingMoulding {
  const l = obj(raw);
  const d = DEFAULTS.rooms.living.moulding;
  return {
    mouldColour: oneOf(l.mouldColour, ['white', 'tone'] as const, d.mouldColour),
    mouldSofaWall: onOff(l.mouldSofaWall),
    mouldTvWall: onOff(l.mouldTvWall),
    ...sanitizeMouldRoom(l, l.mouldSofaGap, d),
    mouldWalls: sanitizeWalls(
      l.mouldWalls, LIVING_MOULD_DEFAULTS,
      { sofa: { minColumns: 1, allowBed: false }, tv: { minColumns: 1, allowBed: false } },
      { sofa: { columns: l.mouldSofaColumns } },
    ),
  };
}

function sanitizeBedroomMoulding(raw: unknown): BedroomMoulding {
  const b = obj(raw);
  const d = DEFAULTS.rooms.bedroom.moulding;
  return {
    mouldColour: oneOf(b.mouldColour, ['white', 'tone'] as const, d.mouldColour),
    mouldBedWall: onOff(b.mouldBedWall),
    mouldDresserWall: onOff(b.mouldDresserWall),
    ...sanitizeMouldRoom(b, b.mouldGap, d),
    mouldWalls: sanitizeWalls(
      b.mouldWalls, BEDROOM_MOULD_DEFAULTS,
      {
        bed: { minColumns: 1, allowBed: true },
        /* saves from when the wall had three sections have no 'dresser' and start from the default */
        dresser: { minColumns: 1, allowBed: false },
      },
      {},
    ),
  };
}

function fromVersion4(s: Raw): Raw {
  const walls = obj(s.walls);
  const paint = (room: string) => (room === 'office' ? walls.office ?? walls.end : walls[room]);
  const { accent, pendant, wardrobes, rug, pillows, art, frame, ...bedroomMoulding } = obj(s.bedroom);
  const { components: livingComponents, ...livingMoulding } = obj(s.living);
  return {
    ...s,
    rooms: {
      bedroom: {
        paint: paint('bedroom'),
        accent,
        moulding: bedroomMoulding,
        components: {
          'ceiling-light': { shown: pendant !== 'off' },
          bed: { options: { pillows } },
          painting: { options: { art, frame } },
          wardrobes: { options: { colour: wardrobes } },
          rug: rug === 'none' ? { shown: false } : { variant: rug },
        },
      },
      hall: { paint: paint('hall') },
      living: { paint: paint('living'), moulding: livingMoulding, components: livingComponents },
      office: { paint: paint('office'), components: obj(s.office).components },
    },
  };
}

/**
 * Version 6 gave each bedside table and lamp of the pair its own component, and every room a tree of groups. A pair's one
 * saved state is copied to both; the tree is left out, so each room starts from its authored groups.
 */
function fromVersion5(s: Raw): Raw {
  const rooms = obj(s.rooms);
  const bedroom = obj(rooms.bedroom);
  const { 'bedside-tables': tables, 'bedside-lamps': lamps, ...rest } = obj(bedroom.components);
  const pair = (old: string, saved: unknown) =>
    saved === undefined ? {} : Object.fromEntries(BEDSIDES.map((side) => [`${old}-${side}`, saved]));
  return {
    ...s,
    rooms: {
      ...rooms,
      bedroom: { ...bedroom, components: { ...rest, ...pair('bedside-table', tables), ...pair('bedside-lamp', lamps) } },
    },
  };
}

function sanitizeRooms(raw: unknown): Rooms {
  const r = obj(raw);
  const d = DEFAULTS.rooms;
  const paint = (id: RoomId) => oneOf(obj(r[id]).paint, ids(PAINTS), d[id].paint);
  const components = <R extends RoomId>(id: R) => sanitizeComponents<ComponentId<R>>(obj(r[id]).components, ROOM_DEFS[id]);
  const tree = (id: RoomId) => sanitizeTree(obj(r[id]).tree, ROOM_DEFS[id]);
  const bedroom = obj(r.bedroom);
  return {
    bedroom: {
      paint: paint('bedroom'),
      accent: isHex(bedroom.accent) ? bedroom.accent.toUpperCase() : d.bedroom.accent,
      moulding: sanitizeBedroomMoulding(bedroom.moulding),
      components: components('bedroom'),
      tree: tree('bedroom'),
    },
    hall: { paint: paint('hall'), components: components('hall'), tree: tree('hall') },
    living: {
      paint: paint('living'),
      moulding: sanitizeLivingMoulding(obj(r.living).moulding),
      components: components('living'),
      tree: tree('living'),
    },
    office: { paint: paint('office'), components: components('office'), tree: tree('office') },
  };
}

/**
 * Turn anything found in storage (including flat settings saved before version 2, and those saved by the
 * original single-file app) into valid Settings.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const r = obj(raw);
  const version = [2, 3, 4, 5, 6].includes(r.version as number) ? (r.version as number) : 1;
  let s = version === 1 ? fromVersion1(r) : r;
  if (version < 3) s = { ...s, office: fromVersion2Office(s.office) };
  if (version < 4) s = fromVersion3(s);
  if (version < 5) s = fromVersion4(s);
  if (version < 6) s = fromVersion5(s);
  return {
    version: 6,
    room: oneOf(roomId(s.room), ['all', ...ROOM_IDS] as const, 'all'),
    time: oneOf(s.time, ['day', 'eve'] as const, 'day'),
    rooms: sanitizeRooms(s.rooms),
    mouldShop: sanitizeShop(s.mouldShop),
  };
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY) ?? storage?.getItem(LEGACY_STORAGE_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeSettings(null);
  }
}

export function saveSettings(s: Settings, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode, quota): settings just won't persist */
  }
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
