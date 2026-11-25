import { CEILING, type Room, type XZ } from '../data/rooms';
import type { Mount } from '../data/components';
import { footprintsOverlap } from '../lib/footprint';
import { roomWalls, type Wall } from './apartment';

/** One physical leaf, in scene metres. The convex outline follows the furnishing, not the envelope of its group. */
export interface PlacedLeaf {
  footprint: readonly XZ[];
  bottom: number;
  top: number;
  mount: Mount;
  /** Rugs do not obstruct other pieces. Hidden pieces still keep their mount, but do not warn about overlaps. */
  obstructs: boolean;
}

export type Translation = Readonly<{ x: number; y: number; z: number }>;

export type MoveProposal =
  | { ok: false; member: string; reason: 'unavailable' | 'fixed' | 'floor' | 'wall' | 'outside' | 'opening' }
  | { ok: true; leaves: ReadonlyMap<string, PlacedLeaf>; overlaps: readonly string[] };

// Scene positions can come from Float32 mesh vertices.
const EPS = 1e-5;
const unitAlong = ({ a, b, length }: Wall): XZ => [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
const dot = (x: number, z: number, dir: XZ) => x * dir[0] + z * dir[1];

function onOpening(wall: Wall, leaf: PlacedLeaf): boolean {
  const dir = unitAlong(wall);
  const along = leaf.footprint.map(([x, z]) => dot(x - wall.a[0], z - wall.a[1], dir));
  const start = Math.min(...along);
  const end = Math.max(...along);
  return wall.holes.some(({ opening, u0, u1 }) => {
    const lo = Math.max(start, u0);
    const hi = Math.min(end, u1);
    if (hi - lo <= EPS || leaf.top <= opening.y0 + EPS) return false;
    if (!opening.arch) return leaf.bottom < opening.y1 - EPS;
    const r = (u1 - u0) / 2;
    const centre = u0 + r;
    const dx = Math.max(lo - centre, centre - hi, 0);
    return leaf.bottom < opening.y1 - r + Math.sqrt(r * r - dx * dx) - EPS;
  });
}

function overlaps(a: PlacedLeaf, b: PlacedLeaf): boolean {
  return a.top > b.bottom + EPS && b.top > a.bottom + EPS && footprintsOverlap(a.footprint, b.footprint, EPS);
}

/** Propose one translation from the current poses, never a sequence of per-piece edits. Includes hidden descendants. */
export function proposeTranslation(
  room: Room,
  members: readonly string[],
  poses: ReadonlyMap<string, PlacedLeaf>,
  delta: Translation,
): MoveProposal {
  if (!members.length || !Object.values(delta).every(Number.isFinite)) throw new Error('Invalid translation request');
  const walls = roomWalls(room);
  const next = new Map<string, PlacedLeaf>();
  for (const id of members) {
    const source = poses.get(id);
    if (!source) return { ok: false, member: id, reason: 'unavailable' };
    const { mount } = source;
    if (mount.kind === 'fixed' && Math.hypot(delta.x, delta.y, delta.z) > EPS) return { ok: false, member: id, reason: 'fixed' };
    if ((mount.kind === 'floor' || mount.kind === 'wall-and-floor') && Math.abs(delta.y) > EPS) return { ok: false, member: id, reason: 'floor' };
    const candidate: PlacedLeaf = {
      ...source,
      bottom: source.bottom + delta.y,
      top: source.top + delta.y,
      footprint: source.footprint.map(([x, z]) => [x + delta.x, z + delta.z]),
    };
    if ('edge' in mount) {
      const a = room.poly[mount.edge];
      const b = room.poly[(mount.edge + 1) % room.poly.length];
      const wall = walls.find((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
      if (!wall) throw new Error(`Invalid mount on ${room.id} edge ${mount.edge}`);
      const [dx, dz] = unitAlong(wall);
      if (Math.abs(delta.z * dx - delta.x * dz) > EPS) return { ok: false, member: id, reason: 'wall' };
      if (onOpening(wall, candidate)) return { ok: false, member: id, reason: 'opening' };
    }
    // All room outlines are convex. Check their full boundary, including edges without a wall.
    const outside = room.poly.some(([ax, az], i) => {
      const [bx, bz] = room.poly[(i + 1) % room.poly.length];
      const dx = bx - ax;
      const dz = bz - az;
      const tolerance = EPS * Math.hypot(dx, dz);
      return candidate.footprint.some(([x, z]) => dx * (z - az) - dz * (x - ax) < -tolerance);
    });
    if (outside || candidate.bottom < -EPS || candidate.top > CEILING + EPS) return { ok: false, member: id, reason: 'outside' };
    next.set(id, candidate);
  }
  const warnings = [...poses].filter(([id, other]) => !next.has(id) && other.obstructs
    && [...next.values()].some((leaf) => leaf.obstructs && overlaps(leaf, other)));
  return { ok: true, leaves: next, overlaps: warnings.map(([id]) => id) };
}
