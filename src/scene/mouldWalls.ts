import type { BedroomSection, LivingSection } from '../state/mould';
import { DRESSER_X, FRONT_DOOR_TOP, FRONT_DOOR_X0, FRONT_DOOR_X1, W, WARD_FRONT } from './bedroom/dimensions';
import { frameAbove, layoutWall, minRowFor, type MouldRoom, type MouldWall, type SectionLayout } from './mouldLayout';

export interface MouldSectionDef<K extends string> {
  key: K;
  label: string;
  /** x extent of the run, metres */
  run: [number, number];
  minColumns: 0 | 1;
  /** the 'bed' fixed position is offered here */
  bedAnchor: boolean;
  /** x ranges inside the run that the moulding stays clear of, such as a door and its casing */
  gaps?: [number, number][];
  /** openings that get a frame of their own above them, as wide as the opening: its x range and the top of the opening */
  above?: { name: string; x: [number, number]; top: number }[];
}

export interface MouldWallDef<K extends string> {
  toggle: 'mouldBedWall' | 'mouldDresserWall' | 'mouldSofaWall' | 'mouldTvWall';
  label: string;
  sections: MouldSectionDef<K>[];
  /** the rail's x segments */
  rail: [number, number][];
}

/** the bedroom's moulding is kept this far, m, from the window wall, on the bed and dresser walls alike; the spacing
 * comes on top */
export const WINDOW_WALL_CLEARANCE = 0.12;
const WINDOW_SIDE = -W / 2 + WINDOW_WALL_CLEARANCE;

export const BEDROOM_MOULD_WALLS: MouldWallDef<BedroomSection>[] = [
  {
    toggle: 'mouldBedWall',
    label: 'Bed wall',
    sections: [{ key: 'bed', label: 'Bed wall', run: [WINDOW_SIDE, WARD_FRONT], minColumns: 1, bedAnchor: true }],
    rail: [[WINDOW_SIDE, WARD_FRONT]],
  },
  {
    toggle: 'mouldDresserWall',
    label: 'Dresser wall',
    /* one run from the window wall to the east corner; the door splits it, and the columns are shared either side */
    sections: [
      { key: 'dresser', label: 'Dresser wall', run: [WINDOW_SIDE, W / 2], minColumns: 1, bedAnchor: false,
        gaps: [[FRONT_DOOR_X0, FRONT_DOOR_X1]],
        /* one frame over the door, as wide as its casing */
        above: [{ name: 'door', x: [FRONT_DOOR_X0, FRONT_DOOR_X1], top: FRONT_DOOR_TOP }],
      },
    ],
    /* the rail stays broken behind the dresser and at the door */
    rail: [
      [WINDOW_SIDE, DRESSER_X - 0.4],
      [DRESSER_X + 0.4, FRONT_DOOR_X0],
      [FRONT_DOOR_X1, W / 2],
    ],
  },
];

export const LIVING_MOULD_WALLS: MouldWallDef<LivingSection>[] = [
  {
    toggle: 'mouldSofaWall',
    label: 'Sofa wall',
    sections: [{ key: 'sofa', label: 'Sofa wall', run: [3.69, 8.69], minColumns: 1, bedAnchor: false }],
    rail: [[3.69, 8.69]],
  },
  {
    toggle: 'mouldTvWall',
    label: 'TV wall',
    sections: [{ key: 'tv', label: 'TV wall', run: [3.69, 7.376], minColumns: 1, bedAnchor: false }],
    rail: [[3.69, 7.376]],
  },
];

/** the layout of each of a wall's sections, in section order */
export function wallLayouts<K extends string>(
  def: MouldWallDef<K>,
  room: MouldRoom,
  walls: Record<K, MouldWall>,
  bedX?: number,
): SectionLayout[] {
  return def.sections.map((sec) => {
    const l = layoutWall(sec.run, sec.gaps ?? [], room, walls[sec.key], sec.bedAnchor ? bedX : undefined);
    if (!sec.above) return l;
    return {
      ...l,
      over: sec.above.flatMap(({ name, x, top }) => {
        const f = frameAbove(x, top, l.spacing, minRowFor((room.frame ?? 0) / 100));
        return f ? [{ ...f, name }] : [];
      }),
    };
  });
}
