import {
  ACCENT_DEFAULT, ARTS, DRESSERS, FLOOR_LAMPS, FRAMES, FURNITURE, PAINTS, PENDANTS, PILLOW_SETS, READING_CHAIRS, ROUND_RUGS, RUGS,
  WARDROBES,
} from '../data/catalog';
import { OFFICE, type OfficeComponentId } from '../data/office';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { ROOMS, ROOM_IDS, type RoomId, type RoomSelection } from '../data/rooms';
import { isHex } from '../lib/color';
import { clamp } from '../lib/math';
import { spacingMax, type MouldWall } from '../scene/mouldLayout';
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

/** The lamps chosen for a room (catalog ids, 'none' for no lamp). */
export interface LampSettings {
  pendant: string;
  floorLamp: string;
}

/** The office: each of its components, shown or hidden, and which product it is. */
export interface OfficeSettings {
  components: ComponentStates<OfficeComponentId>;
}

/** What can be changed in the living room. */
export interface LivingSettings extends LampSettings {
  /** furniture ids switched off */
  hidden: string[];
  mouldColour: 'white' | 'tone';
  mouldSofaWall: OnOff;
  mouldTvWall: OnOff;
  mouldSpacing: number;
  mouldDado: number;
  mouldWalls: Record<LivingSection, MouldWall>;
  /** the sofa's fabric: 'original' for the sofa as modelled, or a Bemz fabric code */
  sofaFabric: string;
}

export interface Settings {
  version: 3;
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
  living?: Partial<LivingSettings>;
  office?: { components?: Partial<Record<OfficeComponentId, Partial<ComponentState>>> };
};

export function applyPatch(s: Settings, p: SettingsPatch): Settings {
  const components = { ...s.office.components };
  for (const [id, patch] of Object.entries(p.office?.components ?? {}) as [OfficeComponentId, Partial<ComponentState>][]) {
    components[id] = { ...components[id], ...patch };
  }
  return { ...s, ...p, bedroom: { ...s.bedroom, ...p.bedroom }, living: { ...s.living, ...p.living }, office: { components } };
}

export const STORAGE_KEY = 'apartment-playground';
/** where settings were saved before version 2 (by this app and by the original single-file app) */
export const LEGACY_STORAGE_KEY = 'bedroom-viz';

export const DEFAULTS: Settings = {
  version: 3,
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
    hidden: [],
    pendant: 'none',
    floorLamp: 'none',
    mouldColour: 'white',
    mouldSofaWall: 'on',
    mouldTvWall: 'on',
    mouldSpacing: 8,
    mouldDado: 77,
    mouldWalls: LIVING_MOULD_DEFAULTS,
    sofaFabric: 'original',
  },
  office: { components: componentDefaults(OFFICE) },
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

function sanitizeLamps(raw: unknown): LampSettings {
  const l = obj(raw);
  return {
    pendant: oneOf(l.pendant, ids(PENDANTS), 'none'),
    floorLamp: oneOf(l.floorLamp, ids(FLOOR_LAMPS), 'none'),
  };
}

/**
 * the version 2 office's five catalog ids, as component states: 'none' is a hidden piece, a known id a shown one, and
 * anything else is left out so it takes the initial state (version 2 took its default, a lamp's being none)
 */
function fromVersion2Office(raw: unknown): Raw {
  const o = obj(raw);
  const lists: [OfficeComponentId, string, readonly { id: string }[]][] = [
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
    ...sanitizeLamps(l),
    hidden: Array.isArray(l.hidden) ? [...new Set(l.hidden.filter((h): h is string => ids(FURNITURE).includes(h as string)))] : [],
    mouldColour: oneOf(l.mouldColour, ['white', 'tone'] as const, d.mouldColour),
    mouldSofaWall: onOff(l.mouldSofaWall),
    mouldTvWall: onOff(l.mouldTvWall),
    ...sanitizeMouldRoom(l, l.mouldSofaGap, d),
    mouldWalls: sanitizeWalls(
      l.mouldWalls, LIVING_MOULD_DEFAULTS,
      { sofa: { minColumns: 1, allowBed: false }, tv: { minColumns: 1, allowBed: false } },
      { sofa: { columns: l.mouldSofaColumns } },
    ),
    sofaFabric: oneOf(l.sofaFabric, ['original', ...BEMZ_FABRICS.map((f) => f.code)], d.sofaFabric),
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
  const s = r.version === 2 || r.version === 3 ? r : fromVersion1(r);
  const office = r.version === 3 ? s.office : fromVersion2Office(s.office);
  return {
    version: 3,
    room: oneOf(roomId(s.room), ['all', ...ROOM_IDS] as const, 'all'),
    time: oneOf(s.time, ['day', 'eve'] as const, 'day'),
    walls: perRoom(s.walls, ids(PAINTS), DEFAULTS.walls),
    bedroom: sanitizeBedroom(s.bedroom),
    living: sanitizeLiving(s.living),
    office: { components: sanitizeComponents(obj(office).components, OFFICE) },
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
