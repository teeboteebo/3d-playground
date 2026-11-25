import { CEILING, extent, type XZ } from '../data/rooms';
import { tangent, type Wall } from '../scene/apartment';
import type { PlacedLeaf } from '../scene/rigidPlacement';

export interface PlanGuide {
  from: readonly [number, number];
  to: readonly [number, number];
  cm: number;
}

export interface WallProjection {
  left: number;
  right: number;
  top: number;
  bottom: number;
  setback: number;
}

export function projectOnWall(wall: Wall, piece: PlacedLeaf): WallProjection | null {
  if ('edge' in piece.mount && piece.mount.edge !== wall.edge) return null;
  const [ux, uz] = tangent(wall);
  const local = piece.footprint.map(([x, z]): XZ => {
    const dx = x - wall.a[0], dz = z - wall.a[1];
    return [ux * dx + uz * dz, -uz * dx + ux * dz];
  });
  const { minX, maxX } = extent(local);
  const left = Math.max(0, minX), right = Math.min(wall.length, maxX);
  if (right <= left) return null;

  // For a diagonal wall the closest point within its span can be partway along a footprint edge.
  let setback = Infinity;
  local.forEach(([x, depth], i) => {
    if (x >= left && x <= right) setback = Math.min(setback, depth);
    const [nx, nd] = local[(i + 1) % local.length];
    for (const edge of [left, right]) {
      if (edge > Math.min(x, nx) && edge < Math.max(x, nx))
        setback = Math.min(setback, depth + (nd - depth) * (edge - x) / (nx - x));
    }
  });
  return { left, right, top: CEILING - piece.top, bottom: CEILING - piece.bottom, setback: Math.max(0, setback) };
}

export function elevationOutline({ left, right, top, bottom }: WallProjection): XZ[] {
  return [[left, top], [right, top], [right, bottom], [left, bottom]];
}

/** Each outer clearance starts on the member defining that side of the selection. */
export function elevationGuides(wall: Wall, selection: WallProjection[]) {
  if (!selection.length) return [];
  const left = selection.reduce((a, b) => a.left < b.left ? a : b);
  const right = selection.reduce((a, b) => a.right > b.right ? a : b);
  const top = selection.reduce((a, b) => a.top < b.top ? a : b);
  const bottom = selection.reduce((a, b) => a.bottom > b.bottom ? a : b);
  const midX = (p: WallProjection) => (p.left + p.right) / 2;
  const midY = (p: WallProjection) => (p.top + p.bottom) / 2;
  const guides: (PlanGuide & { label: string })[] = [
    { label: 'To left edge', from: [left.left, midY(left)], to: [0, midY(left)], cm: left.left * 100 },
    { label: 'To right edge', from: [right.right, midY(right)], to: [wall.length, midY(right)], cm: (wall.length - right.right) * 100 },
    { label: 'Up to ceiling', from: [midX(top), top.top], to: [midX(top), 0], cm: top.top * 100 },
    { label: 'Down to floor', from: [midX(bottom), bottom.bottom], to: [midX(bottom), CEILING], cm: (CEILING - bottom.bottom) * 100 },
  ];
  return guides.filter((g) => g.cm >= 0.05);
}
