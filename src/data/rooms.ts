/**
 * The apartment's rooms: one registry for the UI (names, sizes, camera views, default paint) and the scene
 * (floor outlines and openings), decoded from the SketchUp model (Lojtnants_base.skp).
 *
 * Scene coordinates are metres with the bedroom centred on the origin:
 *   x = 14.666 − model x,   z = model y − 3.008,   y = model height.
 */

export type RoomId = 'bedroom' | 'hall' | 'living' | 'office';
export type RoomSelection = RoomId | 'all';

export type XZ = readonly [number, number];

export const CEILING = 3.3;
export const SKIRTING = 0.18;

export interface Room {
  id: RoomId;
  name: string;
  /** floor outline (the walls' room faces), in order around the room */
  poly: XZ[];
  /** paint id the room starts with */
  paint: string;
  /** name of the camera view the room flies to when selected */
  view: string;
  /** indices of outline edges (poly[i] → poly[i+1]) that have no wall: the model stops there */
  open?: number[];
  /**
   * The room builds its own window, door and doorway fittings (frames, glass, curtains, daylight). Its walls,
   * floor, ceiling and skirting are still built from the outline, with every opening cut out.
   */
  handBuilt?: boolean;
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
  /** the top is a half circle spanning the width, its crown at y1 (windows only) */
  arch?: boolean;
}

export const ROOMS: Room[] = [
  {
    id: 'bedroom',
    name: 'Bedroom',
    poly: [[-2.15, -1.975], [2.15, -1.975], [2.15, 1.975], [-2.15, 1.975]],
    paint: 'antique',
    view: 'Foot of bed',
    handBuilt: true,
  },
  {
    id: 'hall',
    name: 'Hall',
    poly: [[2.35, -0.175], [3.49, -0.175], [3.49, 2.925], [2.35, 2.925]],
    paint: 'frostrok',
    view: 'Hall',
    open: [2],
  },
  {
    id: 'living',
    name: 'Living room',
    poly: [[3.69, -1.925], [8.69, -1.925], [8.69, 1.535], [7.376, 2.725], [3.69, 2.725]],
    paint: 'frostrok',
    view: 'Living room',
  },
  {
    id: 'office',
    name: 'Office',
    poly: [[8.89, -1.925], [11.89, -1.925], [11.89, 1.355], [11.35, 2.075], [9.63, 2.075], [8.89, 0.925]],
    paint: 'devine',
    view: 'Office',
  },
];

export const ROOM_IDS: RoomId[] = ROOMS.map((r) => r.id);

export function roomById(id: RoomId): Room {
  return ROOMS.find((r) => r.id === id)!;
}

/* the doorway between the bedroom and the hall: z 0.55–1.75 on the bedroom's east wall, 2.58 high */
export const BEDROOM_DOOR: Opening = { kind: 'passage', a: [2.25, 0.55], b: [2.25, 1.75], y0: 0, y1: 2.58, depth: 0.2 };

/* the bedroom's two arched windows in its west wall: 115 cm wide, sill at 80 cm, springing at 237.5 cm */
const bedroomWindow = (cz: number): Opening => ({
  kind: 'window', a: [-2.15, cz - 0.575], b: [-2.15, cz + 0.575], y0: 0.8, y1: 2.375 + 0.575, depth: 0, arch: true,
});
export const BEDROOM_WINDOWS: Opening[] = [bedroomWindow(0.95), bedroomWindow(-1.05)];
/* the bedroom's door in its south wall, left of the dresser seen from inside */
export const BEDROOM_FRONT_DOOR: Opening = { kind: 'door', a: [0.45, 1.975], b: [1.35, 1.975], y0: 0, y1: 2.58, depth: 0 };

export const OPENINGS: Opening[] = [
  BEDROOM_DOOR,
  ...BEDROOM_WINDOWS,
  BEDROOM_FRONT_DOOR,
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

export interface Extent {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** axis-aligned extent of a set of points */
export function extent(pts: readonly XZ[]): Extent {
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minZ: Math.min(...pts.map((p) => p[1])),
    maxZ: Math.max(...pts.map((p) => p[1])),
  };
}

/** Axis-aligned extent of the whole apartment. */
export function apartmentBounds(): Extent {
  return extent(ROOMS.flatMap((r) => r.poly));
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

/** "430 × 395 cm": the room's outer width (x) by depth (z) */
export function roomSize(room: Room): string {
  const e = extent(room.poly);
  return `${Math.round((e.maxX - e.minX) * 100)} × ${Math.round((e.maxZ - e.minZ) * 100)} cm`;
}

/** the bedroom's half width (x) and half length (z), from its outline */
export const BEDROOM_HALF = (() => {
  const e = extent(roomById('bedroom').poly);
  return { x: (e.maxX - e.minX) / 2, z: (e.maxZ - e.minZ) / 2 };
})();
