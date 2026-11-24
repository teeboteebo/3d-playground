import {
  ACCENT_DEFAULT, ARTS, DRESSERS, FLOOR_LAMPS, FRAMES, PAINTS, PENDANTS, PILLOW_SETS, READING_CHAIRS, ROUND_RUGS, RUGS,
  WARDROBES,
} from '../data/catalog';
import { LIVING } from '../data/living';
import { OFFICE } from '../data/office';
import { ROOM_DEFS, type ComponentId, type ComponentRoom } from '../data/roomDefs';
import { ROOMS, ROOM_IDS, type RoomId, type RoomSelection } from '../data/rooms';
import { isHex } from '../lib/color';
import { clamp } from '../lib/math';
import { spacingMax, type MouldWall } from '../scene/mouldLayout';
import { SHOP_DEFAULTS, sanitizeShop, type MouldShop } from './mouldShop';
import { componentDefaults, sanitizeComponents, type ComponentStates } from './components';
import type { ComponentState } from '../data/components';
import {
  BEDROOM_MOULD_DEFAULTS, LIVING_MOULD_DEFAULTS, MOULD_SLIDERS, sanitizeMouldWall, type BedroomSection, type LivingSection,
} from './mould';

export type OnOff = 'on' | 'off';

/** What can be changed in the bedroom. */
export interface BedroomSettings {
  accent: string;
  mouldColour: 'white' | 'tone';
  mouldBedWall: OnOff;
  mouldDresserWall: OnOff;
  /** room-wide moulding spacing and dado (rail top) height, cm; the walls hold their own columns */
  mouldSpacing: number;
  mouldDado: number;
  mouldWalls: Record<BedroomSection, MouldWall>;
  pendant: OnOff;
  wardrobes: string;
  rug: string;
  pillows: string;
  art: string;
  frame: string;
}

/** The office: each of its components, shown or hidden, and which product it is. */
export interface OfficeSettings {
  components: ComponentStates<ComponentId<'office'>>;
}

/** What can be changed in the living room. */
export interface LivingSettings {
  /** each of its components, shown or hidden, and which product it is */
  components: ComponentStates<ComponentId<'living'>>;
  mouldColour: 'white' | 'tone';
  mouldSofaWall: OnOff;
  mouldTvWall: OnOff;
  mouldSpacing: number;
  mouldDado: number;
  mouldWalls: Record<LivingSection, MouldWall>;
}

export interface Settings {
  version: 4;
  /** selected room, or 'all' for none */
  room: RoomSelection;
  /** lighting, shared by every room */
  time: 'day' | 'eve';
  /** paint id per room */
  walls: Record<RoomId, string>;
  bedroom: BedroomSettings;
  living: LivingSettings;
  office: OfficeSettings;
  /** the moulding products and cut settings, shared by every room */
  mouldShop: MouldShop;
}

/** a change to the settings: top-level fields, and any fields of a room's own settings */
export type SettingsPatch = Partial<Omit<Settings, 'version' | 'bedroom' | 'living' | 'office'>> & {
  bedroom?: Partial<BedroomSettings>;
} & {
  /** a room made of components is patched component by component, field by field */
  [R in ComponentRoom]?: Partial<Omit<Settings[R], 'components'>> & {
    components?: Partial<Record<ComponentId<R>, Partial<ComponentState>>>;
  };
};

export function applyPatch(s: Settings, p: SettingsPatch): Settings {
  const next = { ...s, ...p, bedroom: { ...s.bedroom, ...p.bedroom } } as Settings;
  for (const room of Object.keys(ROOM_DEFS) as ComponentRoom[]) {
    const components: Record<string, ComponentState> = { ...s[room].components };
    for (const [id, patch] of Object.entries(p[room]?.components ?? {}) as [string, Partial<ComponentState>][]) {
      const options = patch.options ? { ...components[id].options, ...patch.options } : components[id].options;
      components[id] = { ...components[id], ...patch, options };
    }
    (next as unknown as Record<string, unknown>)[room] = { ...s[room], ...p[room], components };
  }
  return next;
}

export const STORAGE_KEY = 'apartment-playground';
/** where settings were saved before version 2 (by this app and by the original single-file app) */
export const LEGACY_STORAGE_KEY = 'bedroom-viz';

export const DEFAULTS: Settings = {
  version: 4,
  room: 'all',
  time: 'day',
  walls: Object.fromEntries(ROOMS.map((r) => [r.id, r.paint])) as Record<RoomId, string>,
  bedroom: {
    accent: ACCENT_DEFAULT,
    mouldColour: 'white',
    mouldBedWall: 'on',
    mouldDresserWall: 'on',
    mouldSpacing: 8,
    mouldDado: 77,
    mouldWalls: BEDROOM_MOULD_DEFAULTS,
    pendant: 'on',
    wardrobes: 'wall',
    rug: 'naver',
    pillows: 'clay',
    art: 'sun',
    frame: 'brass',
  },
  living: {
    components: componentDefaults(LIVING),
    mouldColour: 'white',
    mouldSofaWall: 'on',
    mouldTvWall: 'on',
    mouldSpacing: 8,
    mouldDado: 77,
    mouldWalls: LIVING_MOULD_DEFAULTS,
  },
  office: { components: componentDefaults(OFFICE) },
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

/** one valid swatch id per room, falling back to that room's default */
function perRoom(v: unknown, allowed: readonly string[], fallback: Record<RoomId, string>): Record<RoomId, string> {
  const o = obj(v);
  const legacy: Raw = { ...o, office: o.office ?? o.end };
  return Object.fromEntries(ROOM_IDS.map((r) => [r, oneOf(legacy[r], allowed, fallback[r])])) as Record<RoomId, string>;
}

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

function sanitizeLiving(raw: unknown): LivingSettings {
  const l = obj(raw);
  const d = DEFAULTS.living;
  return {
    components: sanitizeComponents(l.components, LIVING),
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

function sanitizeBedroom(raw: unknown): BedroomSettings {
  const b = obj(raw);
  const d = DEFAULTS.bedroom;
  return {
    accent: isHex(b.accent) ? b.accent.toUpperCase() : d.accent,
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
    pendant: onOff(b.pendant),
    wardrobes: oneOf(b.wardrobes, ids(WARDROBES), d.wardrobes),
    rug: oneOf(b.rug, ids(RUGS), d.rug),
    pillows: oneOf(b.pillows, ids(PILLOW_SETS), d.pillows),
    art: oneOf(b.art, ids(ARTS), d.art),
    frame: oneOf(b.frame, ids(FRAMES), d.frame),
  };
}

/**
 * Turn anything found in storage (including flat settings saved before version 2, and those saved by the
 * original single-file app) into valid Settings.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const r = obj(raw);
  const version = r.version === 2 || r.version === 3 || r.version === 4 ? r.version : 1;
  let s = version === 1 ? fromVersion1(r) : r;
  if (version < 3) s = { ...s, office: fromVersion2Office(s.office) };
  if (version < 4) s = fromVersion3(s);
  return {
    version: 4,
    room: oneOf(roomId(s.room), ['all', ...ROOM_IDS] as const, 'all'),
    time: oneOf(s.time, ['day', 'eve'] as const, 'day'),
    walls: perRoom(s.walls, ids(PAINTS), DEFAULTS.walls),
    bedroom: sanitizeBedroom(s.bedroom),
    living: sanitizeLiving(s.living),
    office: { components: sanitizeComponents(obj(s.office).components, OFFICE) },
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
