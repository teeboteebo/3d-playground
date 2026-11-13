/** Sizes and positions (metres) of the office's furniture. The left wall is z = −1.925, the back wall x = 11.89. */
export const LEFT_WALL_Z = -1.925;
export const BACK_WALL_X = 11.89;
export const WALL_GAP = 0.02;
/** floor-standing parts sit this far up, so float32 rounding never puts them below y = 0 */
export const LIFT = 0.0001;

/** METOD high cabinet 60 × 60 × 200 with two METOD top cabinets 60 × 60 × 40 stacked on it, on a plinth */
export const CABINET = { w: 0.6, d: 0.6, h: 2.0, plinth: 0.08, topH: 0.4, tops: 2 } as const;
export const CABINET_X = [9.27, 9.87] as const;
export const CABINET_Z = LEFT_WALL_Z + WALL_GAP + CABINET.d / 2;

/** IDÅSEN desk 120 × 70, its long side along z */
export const DESK = { w: 1.2, d: 0.7, h: 0.75, top: 0.02 } as const;
export const DESK_X = BACK_WALL_X - WALL_GAP - DESK.d / 2;
export const DESK_Z = LEFT_WALL_Z + WALL_GAP + DESK.w / 2;

/** IDÅSEN drawer unit under the desk's free end, fronts facing −x */
export const DRAWERS = { w: 0.42, d: 0.47, h: 0.61, x: 11.57, z: -0.955 } as const;

/** desk chair, facing +x towards the desk (ÖRFJÄLL-sized: IKEA's pages gave no assembled sizes to check) */
export const CHAIR = { x: 10.95, z: -1.5, seat: 0.46, seatW: 0.46, seatD: 0.46, baseR: 0.3, backH: 0.5 } as const;
