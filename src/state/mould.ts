import { clamp } from '../lib/math';
import type { FixedPosition, MouldWall } from '../scene/mouldLayout';

export type BedroomSection = 'bed' | 'dresser';
export type LivingSection = 'sofa' | 'tv';

export const MOULD_SLIDERS = {
  spacing: { min: 4, max: 30, step: 1 },
  dado: { min: 60, max: 110, step: 1 },
  columns: { min: 1, max: 10, step: 1 },
  fixedWidth: { min: 20, max: 500, step: 1 },
} as const;

/** a wall with no fixed column */
const wall = (columns: number): MouldWall => ({
  spacing: null, columns, fixedColumn: 0, fixedWidth: 100, fixedPosition: 'even', fixedCentre: 0,
});

export const BEDROOM_MOULD_DEFAULTS: Record<BedroomSection, MouldWall> = {
  bed: { ...wall(3), fixedColumn: 2, fixedWidth: 180, fixedPosition: 'bed' },
  /* three between the window wall and the door, one between the door and the corner */
  dresser: wall(4),
};

export const LIVING_MOULD_DEFAULTS: Record<LivingSection, MouldWall> = {
  sofa: wall(5),
  tv: { ...wall(3), fixedColumn: 2, fixedWidth: 170, fixedPosition: 'even' },
};

/** a finite number, or the fallback (unlike a plain Number(), null and '' are not 0 here: they are junk too) */
function finite(v: unknown, fallback: number): number {
  return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '') ? (Number.isFinite(Number(v)) ? Number(v) : fallback) : fallback;
}

/** null follows the room; anything unusable falls back to the default */
function sanitizeSpacing(v: unknown, fallback: number | null): number | null {
  if (v === null) return null;
  const n = finite(v, NaN);
  if (Number.isNaN(n)) return fallback;
  return clamp(n, MOULD_SLIDERS.spacing.min, MOULD_SLIDERS.spacing.max);
}

export function sanitizeMouldWall(raw: unknown, d: MouldWall, opts: { minColumns: 0 | 1; allowBed: boolean }): MouldWall {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const { columns: cols, fixedWidth } = MOULD_SLIDERS;
  const columns = Math.round(clamp(finite(r.columns, d.columns), opts.minColumns, cols.max));
  const fixedColumn = Math.round(clamp(finite(r.fixedColumn, d.fixedColumn), 0, cols.max));
  const positions: readonly FixedPosition[] = opts.allowBed ? ['even', 'bed', 'custom'] : ['even', 'custom'];
  return {
    spacing: sanitizeSpacing(r.spacing, d.spacing),
    columns,
    fixedColumn: fixedColumn > columns ? 0 : fixedColumn,
    fixedWidth: clamp(finite(r.fixedWidth, d.fixedWidth), fixedWidth.min, fixedWidth.max),
    fixedPosition: positions.includes(r.fixedPosition as FixedPosition) ? (r.fixedPosition as FixedPosition) : r.fixedPosition === 'bed' ? 'even' : d.fixedPosition,
    fixedCentre: Math.max(0, finite(r.fixedCentre, d.fixedCentre)),
  };
}

/** set the count; clears the fixed column if it no longer exists */
export function withColumns(w: MouldWall, columns: number): MouldWall {
  return { ...w, columns, fixedColumn: w.fixedColumn > columns ? 0 : w.fixedColumn };
}
