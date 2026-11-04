/** Bed-wall moulding: usable width either side of the bed centre line, in metres. */
const HALF_SPAN = 1.84;
const MIN_GAP = 0.04;
const MIN_SIDE = 0.3;
/** Bedside tables never move closer to the bed centre than this. */
const MIN_TABLE_OFFSET = 1.115;

export interface BedWallLayout {
  /** half-width of the centre column */
  centreHalf: number;
  gap: number;
  sideWidth: number;
  /** [x0, x1] of the three columns, relative to the bed centre */
  columns: [number, number][];
  /** distance of each bedside table/lamp from the bed centre */
  tableOffset: number;
}

/**
 * Centre column (mcen cm wide) is centred on the bed, side columns are msw cm wide,
 * with mgap cm between. Columns are squeezed to fit the wall.
 */
export function bedWallLayout(mcenCm: number, mgapCm: number, mswCm: number): BedWallLayout {
  const c = mcenCm / 200;
  let sw = mswCm / 100;
  let g = Math.min(mgapCm / 100, HALF_SPAN - sw - c);
  if (g < MIN_GAP) {
    g = MIN_GAP;
    sw = Math.max(MIN_SIDE, HALF_SPAN - c - g);
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
    tableOffset: Math.max(edgeIn + sw / 2, MIN_TABLE_OFFSET),
  };
}
