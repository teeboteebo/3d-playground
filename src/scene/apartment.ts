import type { RoomId } from '../data/catalog';

/**
 * The rest of the apartment around the bedroom: hall, living room and the office, decoded from the
 * SketchUp model (Lojtnants_base.skp). Only structure: walls, openings, floors and ceilings.
 *
 * Scene coordinates are metres with the bedroom centred on the origin:
 *   x = 14.666 − model x,   z = model y − 3.008,   y = model height.
 * The bedroom itself (x ±2.15, z ±1.975) is built in createScene.ts; it is not listed here.
 */

export type XZ = readonly [number, number];

export const CEILING = 3.3;
export const SKIRTING = 0.18;

export interface Room {
  id: Exclude<RoomId, 'bedroom'>;
  name: string;
  /** floor outline, in order around the room */
  poly: XZ[];
  /** wall colour, from the model's paint */
  wall: string;
  /** indices of outline edges (poly[i] → poly[i+1]) that have no wall: the model stops there */
  open?: number[];
}

/**
 * passage: an open doorway through an inner wall, lined across the wall's thickness.
 * window:  glazed opening in an outer wall, with sill and frame.
 * door:    closed door in an outer wall.
 * a/b are the opening's ends on the wall's centre line (passages) or on its room face (window/door).
 */
export interface Opening {
  kind: 'passage' | 'window' | 'door';
  a: XZ;
  b: XZ;
  y0: number;
  y1: number;
  /** wall thickness the lining spans (passages only) */
  depth: number;
}

export const ROOMS: Room[] = [
  {
    id: 'hall',
    name: 'Hall',
    poly: [[2.35, -0.175], [3.49, -0.175], [3.49, 2.925], [2.35, 2.925]],
    wall: '#8A8F81',
    open: [2],
  },
  {
    id: 'living',
    name: 'Living room',
    poly: [[3.69, -1.925], [8.69, -1.925], [8.69, 1.535], [7.376, 2.725], [3.69, 2.725]],
    wall: '#A29885',
  },
  {
    id: 'end',
    name: 'Office',
    poly: [[8.89, -1.925], [11.89, -1.925], [11.89, 1.355], [11.35, 2.075], [9.63, 2.075], [8.89, 0.925]],
    wall: '#758396',
  },
];

export const OPENINGS: Opening[] = [
  /* bedroom ↔ hall: matches the bedroom's doorway (z 0.55–1.75, 2.58 high) */
  { kind: 'passage', a: [2.25, 0.55], b: [2.25, 1.75], y0: 0, y1: 2.58, depth: 0.2 },
  /* hall ↔ living room */
  { kind: 'passage', a: [3.59, 0.885], b: [3.59, 1.755], y0: 0, y1: 2.378, depth: 0.2 },
  /* living room ↔ office */
  { kind: 'passage', a: [8.79, -0.185], b: [8.79, 0.685], y0: 0, y1: 2.43, depth: 0.2 },
  /* living room bay window, in the angled corner */
  { kind: 'window', a: [8.636, 1.582], b: [7.436, 2.682], y0: 0.84, y1: 2.72, depth: 0 },
  /* office window, north wall */
  { kind: 'window', a: [10.7, 2.075], b: [9.63, 2.075], y0: 0.8, y1: 2.66, depth: 0 },
  /* office outer door, in the angled corner */
  { kind: 'door', a: [11.842, 1.419], b: [11.362, 2.059], y0: 0, y1: 2.2, depth: 0 },
];

/** The bedroom's own outline, for anything that needs the whole apartment's extent. */
export const BEDROOM_POLY: XZ[] = [[-2.15, -1.975], [2.15, -1.975], [2.15, 1.975], [-2.15, 1.975]];

export interface Wall {
  room: Room;
  /** start/end, ordered so the wall's face points into the room when walking a → b */
  a: XZ;
  b: XZ;
  length: number;
  /** openings on this wall, as distances along it from a */
  holes: { opening: Opening; u0: number; u1: number }[];
}

export function centroid(poly: readonly XZ[]): XZ {
  let x = 0;
  let z = 0;
  for (const [px, pz] of poly) {
    x += px;
    z += pz;
  }
  return [x / poly.length, z / poly.length];
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

/** Axis-aligned extent of the whole apartment, bedroom included. */
export function apartmentBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const pts = [...BEDROOM_POLY, ...ROOMS.flatMap((r) => r.poly)];
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minZ: Math.min(...pts.map((p) => p[1])),
    maxZ: Math.max(...pts.map((p) => p[1])),
  };
}
