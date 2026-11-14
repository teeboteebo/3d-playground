/** Sizes and positions (metres) of the office's furniture. The left wall is z = −1.925, the back wall x = 11.89. */
export const LEFT_WALL_Z = -1.925;
export const BACK_WALL_X = 11.89;
/** clear of the walls by more than the sun's shadow normalBias (0.02): closer, and a face beside a wall is striped with shadow */
export const WALL_GAP = 0.05;
/** floor-standing parts sit this far up, so float32 rounding never puts them below y = 0 */
export const LIFT = 0.0001;

/** METOD high cabinet 60 × 60 × 200 with two METOD top cabinets 60 × 60 × 40 stacked on it, on a plinth */
export const CABINET = { w: 0.6, d: 0.6, h: 2.0, plinth: 0.08, topH: 0.4, tops: 2 } as const;
/** the two stacks stand against the entrance wall (x = 8.89), in the corner with the left wall, fronts facing +x */
export const ENTRANCE_WALL_X = 8.89;
export const CABINET_X = ENTRANCE_WALL_X + WALL_GAP + CABINET.d / 2;
export const CABINET_Z = [LEFT_WALL_Z + WALL_GAP + CABINET.w / 2, LEFT_WALL_Z + WALL_GAP + CABINET.w * 1.5] as const;

/** IDÅSEN drawer unit, on the floor between the desk and the left wall, fronts facing −x */
export const DRAWERS = {
  w: 0.42,
  d: 0.47,
  h: 0.61,
  x: BACK_WALL_X - WALL_GAP - 0.47 / 2,
  z: LEFT_WALL_Z + WALL_GAP + 0.42 / 2,
} as const;

/** IDÅSEN desk 120 × 70, its long side along z, against the back wall with the drawer unit at its left end (WALL_GAP also spaces the drawer unit from the desk) */
export const DESK = { w: 1.2, d: 0.7, h: 0.75, top: 0.02 } as const;
export const DESK_X = BACK_WALL_X - WALL_GAP - DESK.d / 2;
export const DESK_Z = LEFT_WALL_Z + WALL_GAP + DRAWERS.w + WALL_GAP + DESK.w / 2;

/**
 * IKEA ALEFJÄLL chair, facing +x towards the desk's middle. IKEA lists it as 64 × 64 cm, 95 cm high, with a seat
 * 51 wide × 42 deep that adjusts from 45 to 56 cm; it is drawn with the seat at 50.
 */
export const CHAIR = { x: 10.95, z: DESK_Z, seat: 0.5, seatW: 0.51, seatD: 0.42, baseR: 0.32, height: 0.95 } as const;

/* ---------- reading corner ---------- */

/**
 * Where the reading corner's pieces go. chair: a starting seat centre and the direction the seat faces (angle from
 * +x towards +z), back towards the outer door; `placeReadingChair` slides it to fit each chair's footprint.
 * dresserWall: the angled north-west wall the dresser is centred on, its back `gap` off it.
 * rug: centre x, and the window wall its rim keeps `gap` off (centre z = windowZ − gap − d/2).
 */
export const CORNER = {
  chair: { x: 11.2, z: 1.5, facing: (-3 * Math.PI) / 4 },
  dresserWall: { a: [8.89, 0.925], b: [9.63, 2.075], gap: 0.05 },
  rug: { x: 10.35, windowZ: 2.075, gap: 0.05 },
} as const;

/** the outer door's wall, the angled north-east corner of the office */
export const DOOR_WALL = { a: [11.89, 1.355], b: [11.35, 2.075] } as const;
/** the office outline, anticlockwise from the left-wall/entrance-wall corner (as in rooms.ts) */
const OUTLINE: readonly (readonly [number, number])[] = [
  [8.89, -1.925], [11.89, -1.925], [11.89, 1.355], [11.35, 2.075], [9.63, 2.075], [8.89, 0.925],
];
/** the office floor lamp's spot (as in roomLamps.ts) and how much room an arc lamp's base needs around it */
const LAMP_SPOT = { x: 11.55, z: 0.1, clear: 0.3 } as const;
const STEP = 0.01;

type P = readonly [number, number];
/** unit normal of the wall a→b pointing into the office, for walls taken in the outline's order */
const inward = ([ax, az]: P, [bx, bz]: P): P => {
  const l = Math.hypot(bx - ax, bz - az);
  return [-(bz - az) / l, (bx - ax) / l];
};
const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];

/** the four floor corners of a w × d footprint centred at c, its depth along the unit vector f */
function rectCorners(c: P, f: P, w: number, d: number): P[] {
  const p: P = [-f[1], f[0]];
  return [
    [1, 1], [1, -1], [-1, -1], [-1, 1],
  ].map(([i, j]) => [c[0] + (f[0] * i * d) / 2 + (p[0] * j * w) / 2, c[1] + (f[1] * i * d) / 2 + (p[1] * j * w) / 2]);
}

/** whether two convex outlines overlap, by separating axes */
function overlaps(a: readonly P[], b: readonly P[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const e = sub(poly[(i + 1) % poly.length], poly[i]);
      const axis: P = [-e[1], e[0]];
      const pa = a.map((q) => dot(q, axis));
      const pb = b.map((q) => dot(q, axis));
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

/**
 * Where a reading chair of footprint w × d stands: its seat centre (x, z) and the angle its seat faces.
 *
 * The chairs differ a lot in size (0.74 to 1.1 m wide), so one fixed centre would push a big chair through the east
 * wall. The facing is kept, and the centre slides along it, starting where the back's nearer corner stands WALL_GAP
 * off the door's wall line, then on (away from the door) in 1 cm steps until every corner of the footprint is
 * WALL_GAP inside the office (the outline is convex, so its corners decide), clear of the desk and at least
 * LAMP_SPOT.clear from the floor lamp's spot.
 */
export function placeReadingChair(w: number, d: number): { x: number; z: number; facing: number } {
  const { x, z, facing } = CORNER.chair;
  const f: P = [Math.cos(facing), Math.sin(facing)];
  const p: P = [-f[1], f[0]];
  const doorN = inward(DOOR_WALL.a, DOOR_WALL.b);
  /* back corners stand at (centre − f·d/2 ± p·w/2); the nearer one is WALL_GAP off the wall line */
  const back = dot(doorN, f) * (d / 2) + Math.abs(dot(doorN, p)) * (w / 2);
  const t0 = (WALL_GAP + back - dot(doorN, sub([x, z], DOOR_WALL.a))) / dot(doorN, f);
  const desk: P[] = [
    [DESK_X - DESK.d / 2, DESK_Z - DESK.w / 2], [DESK_X + DESK.d / 2, DESK_Z - DESK.w / 2],
    [DESK_X + DESK.d / 2, DESK_Z + DESK.w / 2], [DESK_X - DESK.d / 2, DESK_Z + DESK.w / 2],
  ];
  const walls = OUTLINE.map((a, i) => ({ a, n: inward(a, OUTLINE[(i + 1) % OUTLINE.length]) }));
  const fits = (c: P) => {
    const corners = rectCorners(c, f, w, d);
    if (corners.some((q) => walls.some(({ a, n }) => dot(n, sub(q, a)) < WALL_GAP - 1e-9))) return false;
    if (overlaps(corners, desk)) return false;
    /* the lamp spot in the chair's frame, clamped to the footprint: its distance to the nearest footprint point */
    const s = sub([LAMP_SPOT.x, LAMP_SPOT.z], c);
    const u = Math.max(-d / 2, Math.min(d / 2, dot(s, f)));
    const v = Math.max(-w / 2, Math.min(w / 2, dot(s, p)));
    return Math.hypot(dot(s, f) - u, dot(s, p) - v) >= LAMP_SPOT.clear;
  };
  for (let i = 0; i < 300; i++) {
    const t = t0 + i * STEP;
    const c: P = [x + f[0] * t, z + f[1] * t];
    if (fits(c)) return { x: c[0], z: c[1], facing };
  }
  throw new Error(`no room in the reading corner for a ${w} × ${d} m chair`);
}
