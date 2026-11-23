import { BEDROOM_DOOR, BEDROOM_FRONT_DOOR, BEDROOM_HALF, BEDROOM_WINDOWS, CEILING } from '../../data/rooms';

/* Bedroom dimensions (metres): width along x, length along z, ceiling height. The room is centred on the origin. */
export const W = BEDROOM_HALF.x * 2;
export const L = BEDROOM_HALF.z * 2;
export const H = CEILING;

/** where the two built-in wardrobes' fronts stand */
export const WARD_FRONT = W / 2 - 0.58;

/** wall-hung nightstand (AC Design Cholet, scaled): width, height, depth out from the wall, and its bottom height */
export const NIGHTSTAND = { w: 0.4, h: 0.23, d: 0.3, y0: 0.48 };
/** centre x of the left and right nightstand: 0.47 m from the window wall, and 0.55 m from the wardrobe fronts */
export const NIGHTSTAND_X: readonly [number, number] = [-W / 2 + 0.47 + 0.2, WARD_FRONT - 0.55 - 0.2];

/** the bed's centre line: halfway between the two nightstands */
export const BEDX = (NIGHTSTAND_X[0] + NIGHTSTAND_X[1]) / 2;

/* the doorway to the hall, on the east wall (z range and height) */
export const DOOR_Z0 = BEDROOM_DOOR.a[1];
export const DOOR_Z1 = BEDROOM_DOOR.b[1];
export const DOOR_H = BEDROOM_DOOR.y1;

/* the two arched windows in the west wall (see rooms.ts): width, sill, springing height and centres along z */
export const WIN_W = Math.abs(BEDROOM_WINDOWS[0].b[1] - BEDROOM_WINDOWS[0].a[1]);
export const WIN_Y0 = BEDROOM_WINDOWS[0].y0;
export const WIN_SPRING = BEDROOM_WINDOWS[0].y1 - WIN_W / 2;
export const WIN_Z = BEDROOM_WINDOWS.map((o) => (o.a[1] + o.b[1]) / 2);

/* the door in the south wall: centre x, width and height */
export const FRONT_DOOR_X = (BEDROOM_FRONT_DOOR.a[0] + BEDROOM_FRONT_DOOR.b[0]) / 2;
export const FRONT_DOOR_W = Math.abs(BEDROOM_FRONT_DOOR.b[0] - BEDROOM_FRONT_DOOR.a[0]);
export const FRONT_DOOR_H = BEDROOM_FRONT_DOOR.y1;

/* wall moulding: the thickness of a frame's strips */
export const FRAME_T = 0.028;

/* Mio Adina wall lamp: centre height of its shade, and how far its stem (and the shade's axis) stands off the wall */
export const ADINA_SHADE_Y = 1.35;
export const ADINA_STEM_OUT = 0.105;

/* dresser (Mio TOVA), in the front-left corner: centre x and z, and its front face */
export const DRESSER_X = -W / 2 + 0.8;
export const DRESSER_Z = L / 2 - 0.22;

/* full-length mirror on the front wall, left of the dresser: centre x and half width */
export const MIRROR_X = -0.2675;
export const MIRROR_HALF = 0.295;

/* the door in the front wall: its frame's inner edges */
export const FRONT_DOOR_X0 = FRONT_DOOR_X - (FRONT_DOOR_W / 2 + 0.035);
export const FRONT_DOOR_X1 = FRONT_DOOR_X + (FRONT_DOOR_W / 2 + 0.035);

/** where the two built-in wardrobes along the east wall end */
export const WARD_END = -L / 2 + 2;

export const PENDANT_Y = 2.35;
