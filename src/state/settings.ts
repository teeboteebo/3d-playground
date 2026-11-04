import { ACCENT_DEFAULT, ARTS, FRAMES, PILLOW_SETS, RUGS, WARDROBES } from '../data/catalog';
import { isHex } from '../lib/color';

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
};

export const SLIDERS = {
  mgap: { min: 4, max: 30, step: 1 },
  mcen: { min: 150, max: 200, step: 2 },
  msw: { min: 50, max: 90, step: 1 },
} as const;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  return clamp(Number.isFinite(n) && n !== 0 ? n : fallback, min, max);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

const ids = (list: readonly { id: string }[]) => list.map((o) => o.id);

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
