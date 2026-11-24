import type { SectionLayout } from './mouldLayout';

/** draws one box of w × h, centred at (x, y), optionally d deep */
export type StripFn = (w: number, h: number, x: number, y: number, d?: number) => void;

/** a rectangular frame of four strips whose outer edge is x0..x1 by y0..y1 */
function frameOf(strip: StripFn, x0: number, x1: number, y0: number, y1: number, t: number) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  strip(x1 - x0, t, cx, y0 + t / 2);
  strip(x1 - x0, t, cx, y1 - t / 2);
  strip(t, y1 - y0 - 2 * t, x0 + t / 2, cy);
  strip(t, y1 - y0 - 2 * t, x1 - t / 2, cy);
}

/** one frame of moulding: its outer extents, and where it sits */
export interface Frame {
  x: [number, number];
  y: [number, number];
  row: 'lower' | 'upper' | 'over';
  /** 1-based across the wall's sections, left to right; 0 for a frame of its own */
  column: number;
  /** the opening a frame of its own sits over */
  name?: string;
}

/** every frame of a wall, in the order they are drawn: each column's lower then upper frame, then the frames of their own */
export function frames(layouts: readonly SectionLayout[]): Frame[] {
  const out: Frame[] = [];
  let column = 0;
  for (const l of layouts) {
    for (const x of l.columns) {
      column++;
      for (const row of ['lower', 'upper'] as const) {
        const y = l.rows[row];
        if (y) out.push({ x, y, row, column });
      }
    }
    for (const { x, y, name } of l.over ?? []) out.push({ x, y, row: 'over', column: 0, name });
  }
  return out;
}

/** the rail's x segments that have any length */
export function railSegments(segments: readonly (readonly [number, number])[]): [number, number][] {
  return segments.filter(([r0, r1]) => r1 > r0).map(([r0, r1]) => [r0, r1]);
}

/** a lower and an upper frame for each column, in the rows that are tall enough to draw, and any frames of their own */
export function drawSection(strip: StripFn, l: SectionLayout, frameT: number): void {
  for (const f of frames([l])) frameOf(strip, f.x[0], f.x[1], f.y[0], f.y[1], frameT);
}

/** the rail between `rail[0]` and `rail[1]`, one strip per x segment */
export function drawRail(strip: StripFn, segments: readonly (readonly [number, number])[], rail: readonly [number, number], depth?: number): void {
  for (const [r0, r1] of railSegments(segments)) strip(r1 - r0, rail[1] - rail[0], (r0 + r1) / 2, (rail[0] + rail[1]) / 2, depth);
}
