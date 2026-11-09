import { OPENINGS, centroid, type Opening, type Room, type XZ } from '../data/rooms';

export interface Wall {
  room: Room;
  /** start/end, ordered so the wall's face points into the room when walking a → b */
  a: XZ;
  b: XZ;
  length: number;
  /** openings on this wall, as distances along it from a */
  holes: { opening: Opening; u0: number; u1: number }[];
}

/** Walls of a room, each oriented to face inwards, with the openings that cut through it. */
export function roomWalls(room: Room, openings: readonly Opening[] = OPENINGS): Wall[] {
  const c = centroid(room.poly);
  const walls: Wall[] = [];
  room.poly.forEach((p, i) => {
    if (room.open?.includes(i)) return;
    let a = p;
    let b = room.poly[(i + 1) % room.poly.length];
    /* local +z of a wall running a → b is (−dz, dx); flip the wall if that points out of the room */
    if (-(b[1] - a[1]) * (c[0] - a[0]) + (b[0] - a[0]) * (c[1] - a[1]) < 0) [a, b] = [b, a];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / length;
    const dz = (b[1] - a[1]) / length;
    const holes: Wall['holes'] = [];
    for (const o of openings) {
      /* the opening's ends must sit on this wall's line (within half the wall thickness) and run along it */
      const off = (q: XZ) => Math.abs(-dz * (q[0] - a[0]) + dx * (q[1] - a[1]));
      if (off(o.a) > o.depth / 2 + 0.02 || off(o.b) > o.depth / 2 + 0.02) continue;
      const along = (q: XZ) => dx * (q[0] - a[0]) + dz * (q[1] - a[1]);
      const u0 = Math.min(along(o.a), along(o.b));
      const u1 = Math.max(along(o.a), along(o.b));
      if (u0 < -0.01 || u1 > length + 0.01) continue;
      holes.push({ opening: o, u0: Math.max(0, u0), u1: Math.min(length, u1) });
    }
    holes.sort((p1, p2) => p1.u0 - p2.u0);
    walls.push({ room, a, b, length, holes });
  });
  return walls;
}
