/**
 * The one structure every room's menu follows. A room's first page lists its rows under the same sections, in the
 * same order; a section shows only when the room has a row in it. Each row is one thing in the room you can change,
 * named after the thing, with the same name and id in every room that has it. "About the room" always comes last.
 */

export type MenuSection = 'walls' | 'lighting' | 'furniture' | 'decor';

export const SECTIONS: readonly { id: MenuSection; title: string }[] = [
  { id: 'walls', title: 'Walls' },
  { id: 'lighting', title: 'Lighting' },
  { id: 'furniture', title: 'Furniture' },
  { id: 'decor', title: 'Textiles and decor' },
];

/** every row a room can have: its title, and the section it sits in (none for About, which closes the page) */
export const ROWS = {
  walls: { title: 'Wall colour', section: 'walls' },
  moulding: { title: 'Wall moulding', section: 'walls' },
  ceiling: { title: 'Ceiling light', section: 'lighting' },
  floorLamp: { title: 'Floor lamp', section: 'lighting' },
  wardrobes: { title: 'Wardrobes', section: 'furniture' },
  sofa: { title: 'Sofa', section: 'furniture' },
  chair: { title: 'Reading chair', section: 'furniture' },
  dresser: { title: 'Dresser', section: 'furniture' },
  furniture: { title: 'Show or hide furniture', section: 'furniture' },
  rug: { title: 'Rug', section: 'decor' },
  pillows: { title: 'Pillows and throw', section: 'decor' },
  painting: { title: 'Painting', section: 'decor' },
  accent: { title: 'Accent colour', section: 'decor' },
  about: { title: 'About the room', section: null },
} as const satisfies Record<string, { title: string; section: MenuSection | null }>;

export type RowId = keyof typeof ROWS;
