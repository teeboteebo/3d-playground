import { CEILING, SKIRTING } from '../data/rooms';

/** Moulding layout shared by every wall: one spacing S on every side of every column and row. Pure, no three.js. */
export const RAIL_H = 0.04;
export const MIN_COL = 0.2;
export const MIN_ROW = 0.1;

export type FixedPosition = 'even' | 'bed' | 'custom';

/** one wall section's saved settings (cm) — the type lives here so the scene and state share it */
export interface MouldWall {
  spacing: number | null;
  columns: number;
  /** 0 = none, else 1-based */
  fixedColumn: number;
  fixedWidth: number;
  fixedPosition: FixedPosition;
  /** custom: cm from the run's start */
  fixedCentre: number;
}

/** room-wide settings, cm */
export interface MouldRoom {
  spacing: number;
  dado: number;
}

export interface Rows {
  rail: [number, number];
  lower: [number, number] | null;
  upper: [number, number] | null;
}

export interface SectionLayout {
  /** metres, the S actually used */
  spacing: number;
  /** columns drawn */
  count: number;
  /** drawn fixed column, 0-based index, absolute centre x */
  fixed: { index: number; width: number; centre: number } | null;
  /** absolute x */
  columns: [number, number][];
  rows: Rows;
  limits: {
    maxColumns: number;
    /** cm, null when no fixed column is drawn */
    fixedWidth: { min: number; max: number } | null;
    /** cm from the run start */
    fixedCentre: { min: number; max: number } | null;
    /** cm, cap for this wall's S at the room's D */
    spacingMax: number;
  };
}

const range = (lo: number, hi: number): [number, number] | null => (hi - lo >= MIN_ROW - 1e-9 ? [lo, hi] : null);

/** Rail, lower and upper rows for spacing S and dado D (top of the rail), metres; a row shorter than MIN_ROW is null. */
export function rows(spacing: number, dado: number): Rows {
  const railBottom = dado - RAIL_H;
  return {
    rail: [railBottom, dado],
    lower: range(SKIRTING + spacing, railBottom - spacing),
    upper: range(dado + spacing, CEILING - spacing),
  };
}

/** Largest S (metres) that still leaves the lower row MIN_ROW tall at this dado. */
export function spacingMax(dado: number): number {
  return (dado - RAIL_H - SKIRTING - MIN_ROW) / 2;
}

/** Dado range (metres) that leaves both rows MIN_ROW tall at this spacing. */
export function dadoRange(spacing: number): { min: number; max: number } {
  return { min: SKIRTING + RAIL_H + 2 * spacing + MIN_ROW, max: CEILING - 2 * spacing - MIN_ROW };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `m` equal columns between x0 and x1 with `s` between neighbours. */
function split(x0: number, x1: number, m: number, s: number): [number, number][] {
  if (m <= 0) return [];
  const w = (x1 - x0 - (m - 1) * s) / m;
  return Array.from({ length: m }, (_, i) => [x0 + i * (w + s), x0 + i * (w + s) + w] as [number, number]);
}

/**
 * Lays out one wall run [a, b]. Clamps only what is drawn: the saved wall settings are never changed.
 * `bedX` is the bed centre line, used by the 'bed' fixed position.
 */
export function layoutSection(run: [number, number], room: MouldRoom, wall: MouldWall, bedX?: number): SectionLayout {
  const [a, b] = run;
  const s = (wall.spacing ?? room.spacing) / 100;
  const maxColumns = Math.max(0, Math.floor((b - a - s) / (MIN_COL + s)));
  const n = clamp(Math.floor(wall.columns), 0, maxColumns);
  const k = wall.fixedColumn >= 1 && wall.fixedColumn <= n ? wall.fixedColumn : 0;
  const limits = {
    maxColumns,
    fixedWidth: null as { min: number; max: number } | null,
    fixedCentre: null as { min: number; max: number } | null,
    spacingMax: Math.floor(Math.min(30, spacingMax(room.dado / 100) * 100)),
  };
  const base = { spacing: s, count: n, rows: rows(s, room.dado / 100), limits };
  if (n === 0) return { ...base, fixed: null, columns: [] };
  if (k === 0) return { ...base, fixed: null, columns: split(a + s, b - s, n, s) };

  const wMax = b - a - (n + 1) * s - (n - 1) * MIN_COL;
  // a lone column has no neighbour to take up slack, so it fills the run
  const w = n === 1 ? wMax : clamp(wall.fixedWidth / 100, MIN_COL, wMax);
  // a fixed column at either end of the run must still touch S from that end, so its centre has no slack on that side
  const lo = a + s + (k - 1) * (MIN_COL + s) + w / 2;
  const hi = b - s - (n - k) * (MIN_COL + s) - w / 2;
  const cMin = k === n ? hi : lo;
  const cMax = k === 1 ? lo : hi;
  let want: number;
  if (wall.fixedPosition === 'custom') want = a + wall.fixedCentre / 100;
  else if (wall.fixedPosition === 'bed' && bedX !== undefined) want = bedX;
  else {
    const u = n > 1 ? (b - a - (n + 1) * s - w) / (n - 1) : 0;
    want = a + s + (k - 1) * (u + s) + w / 2;
  }
  const centre = clamp(want, cMin, cMax);
  const left = split(a + s, centre - w / 2 - s, k - 1, s);
  const right = split(centre + w / 2 + s, b - s, n - k, s);
  return {
    ...base,
    fixed: { index: k - 1, width: w, centre },
    columns: [...left, [centre - w / 2, centre + w / 2], ...right],
    limits: {
      ...limits,
      fixedWidth: { min: (n === 1 ? wMax : MIN_COL) * 100, max: wMax * 100 },
      fixedCentre: { min: (cMin - a) * 100, max: (cMax - a) * 100 },
    },
  };
}
