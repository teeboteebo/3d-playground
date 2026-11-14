/** Moulding: on the bed wall, usable width either side of the bed centre line, in metres. */
const HALF_SPAN = 1.84;
const MIN_GAP = 0.04;
const MIN_SIDE = 0.3;
/** Bedside tables never move closer to the bed centre than this. */
const MIN_TABLE_OFFSET = 1.115;

export interface WallLayout {
  /** half-width of the centre column */
  centreHalf: number;
  gap: number;
  sideWidth: number;
  /** [x0, x1] of the three columns, relative to the centre line */
  columns: [number, number][];
}

export interface BedWallLayout extends WallLayout {
  /** distance of each bedside table/lamp from the bed centre */
  tableOffset: number;
}

/**
 * Centre column (mcen cm wide, but at least minCentre metres) is centred on the centre line, side columns are
 * msw cm wide, with mgap cm between. Columns are squeezed to fit `halfSpan` metres either side of the centre line.
 */
export function wallLayout(mcenCm: number, mgapCm: number, mswCm: number, halfSpan: number, minCentre = 0): WallLayout {
  const c = Math.max(mcenCm / 200, minCentre / 2);
  let sw = mswCm / 100;
  let g = Math.min(mgapCm / 100, halfSpan - sw - c);
  if (g < MIN_GAP) {
    g = MIN_GAP;
    sw = Math.max(MIN_SIDE, halfSpan - c - g);
  }
  const edgeIn = c + g;
  return {
    centreHalf: c,
    gap: g,
    sideWidth: sw,
    columns: [
      [-(edgeIn + sw), -edgeIn],
      [-c, c],
      [edgeIn, edgeIn + sw],
    ],
  };
}

/** `count` equal columns filling x0..x1, with `gap` between neighbouring columns and at both ends; absolute x; assumes the clamped slider ranges, so the width stays positive */
export function gridLayout(x0: number, x1: number, count: number, gapCm: number): [number, number][] {
  const gap = gapCm / 100;
  const width = (x1 - x0 - (count + 1) * gap) / count;
  return Array.from({ length: count }, (_, i) => {
    const a = x0 + gap + i * (width + gap);
    return [a, a + width];
  });
}

/** Bed-wall layout: `wallLayout` over the bed wall's span, plus where the bedside tables go. */
export function bedWallLayout(mcenCm: number, mgapCm: number, mswCm: number): BedWallLayout {
  const l = wallLayout(mcenCm, mgapCm, mswCm, HALF_SPAN);
  return { ...l, tableOffset: Math.max(l.centreHalf + l.gap + l.sideWidth / 2, MIN_TABLE_OFFSET) };
}
