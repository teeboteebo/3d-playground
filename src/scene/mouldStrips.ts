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

/** a lower and an upper frame for each column, in the rows that are tall enough to draw */
export function drawSection(strip: StripFn, l: SectionLayout, frameT: number): void {
  for (const [x0, x1] of l.columns) {
    for (const row of [l.rows.lower, l.rows.upper]) if (row) frameOf(strip, x0, x1, row[0], row[1], frameT);
  }
}

/** the rail between `rail[0]` and `rail[1]`, one strip per x segment */
export function drawRail(strip: StripFn, segments: readonly (readonly [number, number])[], rail: readonly [number, number], depth?: number): void {
  for (const [r0, r1] of segments) {
    if (r1 > r0) strip(r1 - r0, rail[1] - rail[0], (r0 + r1) / 2, (rail[0] + rail[1]) / 2, depth);
  }
}
