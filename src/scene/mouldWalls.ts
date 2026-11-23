import type { BedroomSection, LivingSection } from '../state/mould';
import { DRESSER_X, FRONT_DOOR_X0, FRONT_DOOR_X1, MIRROR_HALF, MIRROR_X, W, WARD_FRONT } from './bedroom/dimensions';
import { layoutSection, type MouldRoom, type MouldWall, type SectionLayout } from './mouldLayout';

export interface MouldSectionDef<K extends string> {
  key: K;
  label: string;
  /** x extent of the run, metres */
  run: [number, number];
  minColumns: 0 | 1;
  /** the 'bed' fixed position is offered here */
  bedAnchor: boolean;
}

export interface MouldWallDef<K extends string> {
  toggle: 'mouldBedWall' | 'mouldDresserWall' | 'mouldSofaWall' | 'mouldTvWall';
  label: string;
  sections: MouldSectionDef<K>[];
  /** the rail's x segments */
  rail: [number, number][];
}

/** the bed wall's moulding is kept this far, m, from the window-side (left) corner; the room spacing comes on top */
export const BED_WALL_LEFT_BLOCK = 0.12;
const BED_WALL_START = -W / 2 + BED_WALL_LEFT_BLOCK;

export const BEDROOM_MOULD_WALLS: MouldWallDef<BedroomSection>[] = [
  {
    toggle: 'mouldBedWall',
    label: 'Bed wall',
    sections: [{ key: 'bed', label: 'Bed wall', run: [BED_WALL_START, WARD_FRONT], minColumns: 1, bedAnchor: true }],
    rail: [[BED_WALL_START, W / 2]],
  },
  {
    toggle: 'mouldDresserWall',
    label: 'Dresser wall',
    sections: [
      { key: 'dresserWindow', label: 'By the window', run: [-W / 2, MIRROR_X - MIRROR_HALF], minColumns: 0, bedAnchor: false },
      { key: 'dresserMiddle', label: 'Mirror to door', run: [MIRROR_X + MIRROR_HALF, FRONT_DOOR_X0], minColumns: 0, bedAnchor: false },
      { key: 'dresserCorner', label: 'Door to corner', run: [FRONT_DOOR_X1, W / 2], minColumns: 0, bedAnchor: false },
    ],
    /* the rail stays broken behind the dresser */
    rail: [
      [-W / 2, DRESSER_X - 0.4],
      [DRESSER_X + 0.4, MIRROR_X - MIRROR_HALF],
      [MIRROR_X + MIRROR_HALF, FRONT_DOOR_X0],
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
  return def.sections.map((sec) => layoutSection(sec.run, room, walls[sec.key], sec.bedAnchor ? bedX : undefined));
}
