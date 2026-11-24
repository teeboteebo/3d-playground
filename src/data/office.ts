import {
  CORNER_CHECKED,
  DRESSERS,
  FLOOR_LAMPS,
  LAMPS_CHECKED,
  PENDANTS,
  READING_CHAIRS,
  ROUND_RUGS,
} from './catalog';
import type { ComponentDef, RoomDef, Variant } from './components';
import type { ComponentId } from './roomDefs';

/** a catalog's products, without its "leave it out" entry */
const real = (items: readonly Variant[]): readonly Variant[] => items.filter((i) => i.id !== 'none');

const cornerNote = `A simplified shape. Prices and stock were checked on ${CORNER_CHECKED} and change often.`;
const lampNote = `A simplified shape. Prices and stock were checked on ${LAMPS_CHECKED} and change often.`;

const fixed = (id: string, name: string): readonly Variant[] => [{ id, name }];

export const OFFICE = {
  id: 'office',
  groups: [
    { id: 'workspace', name: 'Workspace' },
    { id: 'corner', name: 'Reading corner' },
  ],
  components: [
    {
      id: 'cabinets',
      name: 'Cabinets',
      category: 'furniture',
      note: 'Beside the opening to the living room, against the same wall, stand two IKEA METOD high cabinets (60 × 60 × 200 cm each) on plinths, each with two METOD top cabinets (60 × 60 × 40 cm) stacked above. They are 288 cm tall in total and stop short of the 330 cm ceiling. The cabinets follow the wall colour.',
      variants: fixed('metod', 'IKEA METOD'),
      initial: { shown: true, variant: 'metod' },
    },
    {
      id: 'desk',
      name: 'Desk',
      category: 'furniture',
      group: 'workspace',
      note: 'The IKEA IDÅSEN desk (120 × 70 cm) is against the back wall.',
      variants: fixed('idasen', 'IKEA IDÅSEN'),
      initial: { shown: true, variant: 'idasen' },
    },
    {
      id: 'drawers',
      name: 'Drawer unit',
      category: 'furniture',
      group: 'workspace',
      note: 'An IDÅSEN drawer unit (42 × 47 × 61 cm) stands between the desk and the left wall.',
      variants: fixed('idasen-drawers', 'IKEA IDÅSEN drawer unit'),
      initial: { shown: true, variant: 'idasen-drawers' },
    },
    {
      id: 'desk-chair',
      name: 'Desk chair',
      category: 'furniture',
      group: 'workspace',
      note: 'In front of the desk is an IKEA ALEFJÄLL chair in beige (64 × 64 cm footprint, 51 × 42 cm seat at 50 cm, 95 cm tall). It is a simplified shape.',
      variants: fixed('alefjall', 'IKEA ALEFJÄLL, beige'),
      initial: { shown: true, variant: 'alefjall' },
    },
    {
      id: 'reading-chair',
      name: 'Reading chair',
      category: 'furniture',
      group: 'corner',
      note: cornerNote,
      variants: real(READING_CHAIRS),
      initial: { shown: true, variant: READING_CHAIRS[1].id },
    },
    {
      id: 'dresser',
      name: 'Dresser',
      category: 'furniture',
      group: 'corner',
      note: cornerNote,
      variants: real(DRESSERS),
      initial: { shown: true, variant: DRESSERS[1].id },
    },
    {
      id: 'round-rug',
      name: 'Round rug',
      category: 'decor',
      note: cornerNote,
      variants: real(ROUND_RUGS),
      initial: { shown: true, variant: ROUND_RUGS[1].id },
    },
    {
      id: 'ceiling-light',
      name: 'Ceiling light',
      category: 'lighting',
      note: lampNote,
      variants: real(PENDANTS),
      initial: { shown: false, variant: PENDANTS[1].id },
    },
    {
      id: 'floor-lamp',
      name: 'Floor lamp',
      category: 'lighting',
      note: lampNote,
      variants: real(FLOOR_LAMPS),
      initial: { shown: false, variant: FLOOR_LAMPS[1].id },
    },
  ],
} as const satisfies RoomDef;

export type OfficeComponentId = ComponentId<'office'>;

export const officeDef = (id: OfficeComponentId): ComponentDef => {
  const def = OFFICE.components.find((c) => c.id === id);
  if (!def) throw new Error(`No office component ${id}`);
  return def;
};
