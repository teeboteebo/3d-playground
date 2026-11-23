import { frames, railSegments } from './mouldStrips';
import type { SectionLayout } from './mouldLayout';
import type { MouldWallDef } from './mouldWalls';

export type End = 'mitre' | 'square';

/** one piece of moulding to cut */
export interface Piece {
  /** unique within a wall, stable while the layout is */
  id: string;
  /** where it goes, e.g. "Bed wall · lower · column 2 · top" */
  label: string;
  /** mm, rounded: for a mitred piece the long point */
  length: number;
  kind: 'frame' | 'rail';
  ends: [End, End];
}

const mm = (m: number) => Math.round(m * 1000);

/**
 * The pieces a wall's moulding is made of, from the same frames and rail segments the scene draws. A frame is four
 * pieces mitred at both ends, each as long as the frame's outer size; the rail's segments are square cut.
 */
export function wallPieces<K extends string>(def: MouldWallDef<K>, layouts: readonly SectionLayout[]): Piece[] {
  const prefix = def.sections[0].key;
  const out: Piece[] = [];
  for (const f of frames(layouts)) {
    const w = mm(f.x[1] - f.x[0]);
    const h = mm(f.y[1] - f.y[0]);
    const where = f.row === 'over' ? `over ${f.name}` : `${f.row} · column ${f.column}`;
    const idWhere = f.row === 'over' ? `over-${f.name}` : `${f.row}-${f.column}`;
    for (const [side, length] of [['top', w], ['bottom', w], ['left', h], ['right', h]] as const) {
      out.push({ id: `${prefix}-${idWhere}-${side}`, label: `${def.label} · ${where} · ${side}`, length, kind: 'frame', ends: ['mitre', 'mitre'] });
    }
  }
  const rail = railSegments(def.rail).sort((a, b) => a[0] - b[0]);
  rail.forEach(([r0, r1], i) => {
    out.push({
      id: `${prefix}-rail-${i + 1}`,
      label: rail.length > 1 ? `${def.label} · rail · ${i + 1} of ${rail.length}` : `${def.label} · rail`,
      length: mm(r1 - r0),
      kind: 'rail',
      ends: ['square', 'square'],
    });
  });
  return out;
}
