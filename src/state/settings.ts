import {
  ACCENT_DEFAULT, ARTS, FRAMES, FURNITURE, PAINTS, PILLOW_SETS, RUGS, WARDROBES,
} from '../data/catalog';
import { ROOMS, ROOM_IDS, type RoomId, type RoomSelection } from '../data/rooms';
import { isHex } from '../lib/color';
import { clamp } from '../lib/math';

export type OnOff = 'on' | 'off';

export interface Settings {
  accent: string;
  mould: 'white' | 'tone';
  mouldB: OnOff;
  mouldF: OnOff;
  mgap: number;
  mcen: number;
  msw: number;
  pendant: OnOff;
  ward: string;
  rug: string;
  pillows: string;
  art: string;
  frame: string;
  time: 'day' | 'eve';
  /** selected room, or 'all' for none */
  room: RoomSelection;
  /** paint id per room */
  walls: Record<RoomId, string>;
  /** furniture ids switched off */
  hidden: string[];
}

export const STORAGE_KEY = 'bedroom-viz';

export const DEFAULTS: Settings = {
  accent: ACCENT_DEFAULT,
  mould: 'white',
  mouldB: 'on',
  mouldF: 'on',
  mgap: 8,
  mcen: 180,
  msw: 68,
  pendant: 'on',
  ward: 'wall',
  rug: 'naver',
  pillows: 'clay',
  art: 'sun',
  frame: 'brass',
  time: 'day',
  room: 'all',
  walls: Object.fromEntries(ROOMS.map((r) => [r.id, r.paint])) as Record<RoomId, string>,
  hidden: [],
};

export const SLIDERS = {
  mgap: { min: 4, max: 30, step: 1 },
  mcen: { min: 150, max: 200, step: 2 },
  msw: { min: 50, max: 90, step: 1 },
} as const;

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  return clamp(Number.isFinite(n) && n !== 0 ? n : fallback, min, max);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

const ids = (list: readonly { id: string }[]) => list.map((o) => o.id);

/** one valid swatch id per room, falling back to that room's default */
function perRoom(v: unknown, allowed: readonly string[], fallback: Record<RoomId, string>): Record<RoomId, string> {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return Object.fromEntries(ROOM_IDS.map((r) => [r, oneOf(o[r], allowed, fallback[r])])) as Record<RoomId, string>;
}

/**
 * Turn anything found in storage (including settings saved by the original
 * single-file app) into a valid Settings object.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const onOff = (v: unknown): OnOff => (v === 'off' ? 'off' : 'on');
  // Legacy: mould 'off' meant "white moulding, hidden on the bed wall".
  const legacyOff = s.mould === 'off';
  return {
    accent: isHex(s.accent) ? s.accent.toUpperCase() : DEFAULTS.accent,
    mould: oneOf(s.mould, ['white', 'tone'] as const, 'white'),
    mouldB: legacyOff ? 'off' : onOff(s.mouldB),
    mouldF: onOff(s.mouldF),
    mgap: num(s.mgap, DEFAULTS.mgap, SLIDERS.mgap.min, SLIDERS.mgap.max),
    mcen: num(s.mcen, DEFAULTS.mcen, SLIDERS.mcen.min, SLIDERS.mcen.max),
    msw: num(s.msw, DEFAULTS.msw, SLIDERS.msw.min, SLIDERS.msw.max),
    pendant: onOff(s.pendant),
    ward: oneOf(s.ward, ids(WARDROBES), DEFAULTS.ward),
    rug: oneOf(s.rug, ids(RUGS), DEFAULTS.rug),
    pillows: oneOf(s.pillows, ids(PILLOW_SETS), DEFAULTS.pillows),
    art: oneOf(s.art, ids(ARTS), DEFAULTS.art),
    frame: oneOf(s.frame, ids(FRAMES), DEFAULTS.frame),
    time: oneOf(s.time, ['day', 'eve'] as const, 'day'),
    room: oneOf(s.room, ['all', ...ROOM_IDS] as const, 'all'),
    walls: perRoom(s.walls, ids(PAINTS), DEFAULTS.walls),
    hidden: Array.isArray(s.hidden) ? [...new Set(s.hidden.filter((h) => ids(FURNITURE).includes(h as string)) as string[])] : [],
  };
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULTS };
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
