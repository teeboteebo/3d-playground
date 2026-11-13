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
