import { BEDROOM_DOOR, BEDROOM_HALF, CEILING } from '../../data/rooms';

/* Bedroom dimensions (metres): width along x, length along z, ceiling height. The room is centred on the origin. */
export const W = BEDROOM_HALF.x * 2;
export const L = BEDROOM_HALF.z * 2;
export const H = CEILING;

/** the bed's centre line: halfway between the window wall and the wardrobes' fronts */
export const BEDX = (-W / 2 + (W / 2 - 0.58)) / 2;

/* the doorway to the hall, on the east wall (z range and height) */
export const DOOR_Z0 = BEDROOM_DOOR.a[1];
export const DOOR_Z1 = BEDROOM_DOOR.b[1];
export const DOOR_H = BEDROOM_DOOR.y1;

/* the two arched windows in the west wall */
export const WIN_W = 1.15;
export const WIN_Y0 = 0.8;
export const WIN_SPRING = 2.375;
export const WIN_Z = [0.95, -1.05];

/* wall moulding: the rail, and the lower panels from just above the skirting to just under the rail */
export const RAIL_Y = 0.75;
export const LOW_Y0 = 0.28;
export const LOW_Y1 = RAIL_Y - 0.08;
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
export const FRONT_DOOR_X0 = 0.415;
export const FRONT_DOOR_X1 = 1.385;

/** where the two built-in wardrobes along the east wall end */
export const WARD_END = -L / 2 + 2;

export const PENDANT_Y = 2.35;
