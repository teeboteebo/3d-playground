import {
  ACCENT_DEFAULT, ARTS, FLOOR_LAMPS, FRAMES, FURNITURE, PAINTS, PENDANTS, PILLOW_SETS, RUGS, WARDROBES,
} from '../data/catalog';
import { ROOMS, ROOM_IDS, type RoomId, type RoomSelection } from '../data/rooms';
import { isHex } from '../lib/color';
import { clamp } from '../lib/math';

export type OnOff = 'on' | 'off';

/** What can be changed in the bedroom. */
export interface BedroomSettings {
  accent: string;
  mouldColour: 'white' | 'tone';
  mouldBedWall: OnOff;
  mouldDresserWall: OnOff;
  /** bed-wall moulding layout, in cm: gap between columns, centre column width, side column width */
  mouldGap: number;
  mouldCentre: number;
  mouldSide: number;
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

/** Wall moulding layout, in cm: gap between columns, centre column width, side column width. */
export interface MouldLayout {
  mouldGap: number;
  mouldCentre: number;
  mouldSide: number;
}

/** What can be changed in the living room. */
export interface LivingSettings extends LampSettings, MouldLayout {
  /** furniture ids switched off */
  hidden: string[];
  mouldColour: 'white' | 'tone';
  mouldSofaWall: OnOff;
  mouldTvWall: OnOff;
  /** sofa-wall grid: number of equal columns, and the gap between them and at both wall ends (cm) */
  mouldSofaColumns: number;
  mouldSofaGap: number;
}

export interface Settings {
  version: 2;
  /** selected room, or 'all' for none */
  room: RoomSelection;
  /** lighting, shared by every room */
  time: 'day' | 'eve';
  /** paint id per room */
  walls: Record<RoomId, string>;
  bedroom: BedroomSettings;
  living: LivingSettings;
  office: LampSettings;
}

/** a change to the settings: top-level fields, and any fields of a room's own settings */
export type SettingsPatch = Partial<Omit<Settings, 'version' | 'bedroom' | 'living' | 'office'>> & {
  bedroom?: Partial<BedroomSettings>;
  living?: Partial<LivingSettings>;
  office?: Partial<LampSettings>;
};

export function applyPatch(s: Settings, p: SettingsPatch): Settings {
  return { ...s, ...p, bedroom: { ...s.bedroom, ...p.bedroom }, living: { ...s.living, ...p.living }, office: { ...s.office, ...p.office } };
}

export const STORAGE_KEY = 'apartment-playground';
/** where settings were saved before version 2 (by this app and by the original single-file app) */
export const LEGACY_STORAGE_KEY = 'bedroom-viz';

export const DEFAULTS: Settings = {
  version: 2,
  room: 'all',
  time: 'day',
  walls: Object.fromEntries(ROOMS.map((r) => [r.id, r.paint])) as Record<RoomId, string>,
  bedroom: {
    accent: ACCENT_DEFAULT,
    mouldColour: 'white',
    mouldBedWall: 'on',
    mouldDresserWall: 'on',
    mouldGap: 8,
    mouldCentre: 180,
    mouldSide: 68,
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
    mouldGap: 8,
    mouldCentre: 180,
    mouldSide: 68,
    mouldSofaColumns: 5,
    mouldSofaGap: 8,
  },
  office: { pendant: 'none', floorLamp: 'none' },
};

export const SLIDERS = {
  mouldGap: { min: 4, max: 30, step: 1 },
  mouldCentre: { min: 150, max: 200, step: 2 },
  mouldSide: { min: 50, max: 90, step: 1 },
  mouldSofaColumns: { min: 2, max: 10, step: 1 },
  mouldSofaGap: { min: 4, max: 30, step: 1 },
} as const;

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' ? v : {}) as Raw;

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  return clamp(Number.isFinite(n) && n !== 0 ? n : fallback, min, max);
}

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
      mouldCentre: s.mcen,
      mouldSide: s.msw,
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

function sanitizeMouldLayout(raw: Raw, d: MouldLayout): MouldLayout {
  return {
    mouldGap: num(raw.mouldGap, d.mouldGap, SLIDERS.mouldGap.min, SLIDERS.mouldGap.max),
    mouldCentre: num(raw.mouldCentre, d.mouldCentre, SLIDERS.mouldCentre.min, SLIDERS.mouldCentre.max),
    mouldSide: num(raw.mouldSide, d.mouldSide, SLIDERS.mouldSide.min, SLIDERS.mouldSide.max),
  };
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
    ...sanitizeMouldLayout(l, d),
    mouldSofaColumns: Math.round(
      num(l.mouldSofaColumns, d.mouldSofaColumns, SLIDERS.mouldSofaColumns.min, SLIDERS.mouldSofaColumns.max),
    ),
    mouldSofaGap: num(l.mouldSofaGap, d.mouldSofaGap, SLIDERS.mouldSofaGap.min, SLIDERS.mouldSofaGap.max),
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
    ...sanitizeMouldLayout(b, d),
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
  const s = r.version === 2 ? r : fromVersion1(r);
  return {
    version: 2,
    room: oneOf(roomId(s.room), ['all', ...ROOM_IDS] as const, 'all'),
    time: oneOf(s.time, ['day', 'eve'] as const, 'day'),
    walls: perRoom(s.walls, ids(PAINTS), DEFAULTS.walls),
    bedroom: sanitizeBedroom(s.bedroom),
    living: sanitizeLiving(s.living),
    office: sanitizeLamps(s.office),
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
