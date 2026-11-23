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
  /** rail height; defaults to RAIL_H */
  rail?: number;
}

/** the room's rail height, metres */
const railOf = (room: MouldRoom) => (room.rail === undefined ? RAIL_H : room.rail / 100);

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
  /** frames of their own, such as one over a door: absolute x and y extents */
  over?: { x: [number, number]; y: [number, number]; name?: string }[];
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
export function rows(spacing: number, dado: number, railH: number = RAIL_H): Rows {
  const railBottom = dado - railH;
  return {
    rail: [railBottom, dado],
    lower: range(SKIRTING + spacing, railBottom - spacing),
    upper: range(dado + spacing, CEILING - spacing),
  };
}

/** Largest S (metres) that still leaves the lower row MIN_ROW tall at this dado. */
export function spacingMax(dado: number, railH: number = RAIL_H): number {
  return (dado - railH - SKIRTING - MIN_ROW) / 2;
}

/** Dado range (metres) that leaves both rows MIN_ROW tall at this spacing. */
export function dadoRange(spacing: number, railH: number = RAIL_H): { min: number; max: number } {
  return { min: SKIRTING + railH + 2 * spacing + MIN_ROW, max: CEILING - 2 * spacing - MIN_ROW };
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
    spacingMax: Math.floor(Math.min(30, spacingMax(room.dado / 100, railOf(room)) * 100)),
  };
  const base = { spacing: s, count: n, rows: rows(s, room.dado / 100, railOf(room)), limits };
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

/** the parts of `run` left between `gaps` (each gap an x range the moulding stays clear of), in order */
export function segments(run: [number, number], gaps: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  let x = run[0];
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g1 <= x || g0 >= run[1]) continue;
    if (g0 > x) out.push([x, g0]);
    x = Math.max(x, g1);
  }
  if (run[1] > x) out.push([x, run[1]]);
  return out;
}

/** most columns of at least MIN_COL that fit a segment at spacing s */
const fits = ([a, b]: [number, number], s: number) => Math.max(0, Math.floor((b - a - s) / (MIN_COL + s)));

/**
 * Shares `n` columns among the segments: first one for every segment that fits one (longest first), so no stretch of the
 * wall is left bare while there are columns to give, then each next column to the segment whose columns stay widest.
 */
export function shareColumns(segs: [number, number][], s: number, n: number): number[] {
  const max = segs.map((g) => fits(g, s));
  const counts = segs.map(() => 0);
  const width = (i: number, c: number) => (segs[i][1] - segs[i][0] - (c + 1) * s) / c;
  let left = n;
  const byLength = segs.map((_, i) => i).sort((p, q) => segs[q][1] - segs[q][0] - (segs[p][1] - segs[p][0]));
  for (const i of byLength) {
    if (left > 0 && max[i] > 0) {
      counts[i] = 1;
      left--;
    }
  }
  for (; left > 0; left--) {
    let best = -1;
    for (let i = 0; i < segs.length; i++) {
      if (counts[i] < max[i] && (best < 0 || width(i, counts[i] + 1) > width(best, counts[best] + 1) + 1e-9)) best = i;
    }
    if (best < 0) break;
    counts[best]++;
  }
  return counts;
}

/**
 * Lays out a wall run that the moulding must stay clear of in places (a door): the run splits into segments at the gaps,
 * the wall's columns are shared among them (shareColumns), and each segment is laid out as a section of its own, with
 * the one fixed column in whichever segment its number falls. Limits and the custom centre stay measured from the run's
 * start. With no gaps this is layoutSection.
 */
export function layoutWall(
  run: [number, number], gaps: readonly (readonly [number, number])[], room: MouldRoom, wall: MouldWall, bedX?: number,
): SectionLayout {
  const segs = segments(run, gaps);
  if (segs.length === 1 && segs[0][0] === run[0] && segs[0][1] === run[1]) return layoutSection(run, room, wall, bedX);
  const s = (wall.spacing ?? room.spacing) / 100;
  const maxColumns = segs.reduce((t, g) => t + fits(g, s), 0);
  const n = clamp(Math.floor(wall.columns), 0, maxColumns);
  const counts = shareColumns(segs, s, n);
  const k = wall.fixedColumn >= 1 && wall.fixedColumn <= n ? wall.fixedColumn : 0;
  let before = 0;
  const parts = segs.map((seg, i) => {
    const first = before;
    before += counts[i];
    const local = k > first && k <= first + counts[i] ? k - first : 0;
    const offset = (seg[0] - run[0]) * 100;
    const l = layoutSection(seg, room, { ...wall, columns: counts[i], fixedColumn: local, fixedCentre: wall.fixedCentre - offset }, bedX);
    return { l, first, offset };
  });
  const withFixed = parts.find((p) => p.l.fixed);
  const shift = (r: { min: number; max: number } | null, by: number) => (r ? { min: r.min + by, max: r.max + by } : null);
  return {
    spacing: s,
    count: parts.reduce((t, p) => t + p.l.count, 0),
    fixed: withFixed ? { ...withFixed.l.fixed!, index: withFixed.first + withFixed.l.fixed!.index } : null,
    columns: parts.flatMap((p) => p.l.columns),
    rows: rows(s, room.dado / 100, railOf(room)),
    limits: {
      maxColumns,
      fixedWidth: withFixed?.l.limits.fixedWidth ?? null,
      fixedCentre: withFixed ? shift(withFixed.l.limits.fixedCentre, withFixed.offset) : null,
      spacingMax: Math.floor(Math.min(30, spacingMax(room.dado / 100, railOf(room)) * 100)),
    },
  };
}

/** a frame over an opening `x` wide whose top is at `top`: S above the opening and S below the ceiling, or null when that
 * leaves less than MIN_ROW */
export function frameAbove(x: [number, number], top: number, spacing: number): { x: [number, number]; y: [number, number] } | null {
  const y = range(top + spacing, CEILING - spacing);
  return y ? { x, y } : null;
}
