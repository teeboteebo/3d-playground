import { ARTS, FRAMES, PILLOW_SETS, RUGS, RUGS_CHECKED, WARDROBES } from './catalog';
import type { ChipChoice, ComponentDef, RoomDef, Variant } from './components';
import type { ComponentId } from './roomDefs';

const fixed = (id: string, name: string): readonly Variant[] => [{ id, name }];

const PILLOW_CHOICES: ChipChoice[] = PILLOW_SETS.map((p) =>
  p.hex ? { id: p.id, name: p.name, hex: p.hex } : { id: p.id, name: p.name, followsAccent: true },
);
const FRAME_CHOICES: ChipChoice[] = FRAMES.map(({ id, name, hex }) => ({ id, name, hex, summary: name.toLowerCase() }));

export const BEDROOM = {
  id: 'bedroom',
  components: [
    {
      id: 'ceiling-light',
      name: 'Ceiling light',
      category: 'lighting',
      note: 'IKEA GULLSUDARE 70 cm, rice paper, at the centre of the room, hung with about 2 m clearance below.',
      variants: fixed('gullsudare', 'IKEA GULLSUDARE'),
      initial: { shown: true, variant: 'gullsudare' },
    },
    {
      id: 'bedside-lamps',
      name: 'Bedside lamps',
      category: 'lighting',
      note: 'A pair of Mio Adina wall lamps (26 × 18 cm, brushed brass with a textile shade), each centred above a bedside table.',
      variants: fixed('adina', 'Mio Adina'),
      initial: { shown: true, variant: 'adina' },
    },
    {
      id: 'bed',
      name: 'Bed',
      category: 'furniture',
      note: 'The bed follows IKEA TONSTAD 160×200 (169 × 209 cm, headboard 116 cm), a simplified shape, with five pillows and a throw.',
      variants: fixed('tonstad', 'IKEA TONSTAD, 160 × 200 cm'),
      options: [{ id: 'pillows', label: 'Pillows and throw', kind: 'chips', choices: PILLOW_CHOICES, initial: 'clay' }],
      initial: { shown: true, variant: 'tonstad' },
    },
    {
      id: 'bench',
      name: 'Bench',
      category: 'furniture',
      note: 'The bench at the foot of the bed follows ILVA Amigo (90 × 35 × 45 cm, solid oak, woven seat); the shelf and seat weave are simplified.',
      variants: fixed('amigo', 'ILVA Amigo'),
      initial: { shown: true, variant: 'amigo' },
    },
    {
      id: 'bedside-tables',
      name: 'Bedside tables',
      category: 'furniture',
      note: 'A pair of wall-hung AC Design Furniture Cholet tables, one each side of the bed. They are drawn 40 × 23 × 30 cm, 48 cm off the floor; the product is listed at 50 × 35 × 25 cm.',
      variants: fixed('cholet', 'AC Design Cholet'),
      initial: { shown: true, variant: 'cholet' },
    },
    {
      id: 'dresser',
      name: 'Dresser',
      category: 'furniture',
      note: 'The dresser follows Mio TOVA (80 × 42 × 100 cm), a simplified shape. Its table lamp, vase and tray go with it; the vase follows the accent colour.',
      variants: fixed('tova', 'Mio TOVA'),
      initial: { shown: true, variant: 'tova' },
    },
    {
      id: 'mirror',
      name: 'Mirror',
      category: 'furniture',
      note: 'A full-length oak-framed mirror on the front wall, left of the dresser. It shows a stylised reflection.',
      variants: fixed('full-length', 'Full-length mirror'),
      initial: { shown: true, variant: 'full-length' },
    },
    {
      id: 'painting',
      name: 'Painting',
      category: 'furniture',
      note: 'The framed painting hangs above the dresser. Its picture follows the accent colour.',
      variants: fixed('framed', 'Framed painting'),
      options: [
        { id: 'art', label: 'Painting', kind: 'chips', choices: ARTS, initial: 'sun' },
        { id: 'frame', label: 'Frame', kind: 'chips', choices: FRAME_CHOICES, initial: 'brass' },
      ],
      initial: { shown: true, variant: 'framed' },
    },
    {
      id: 'wardrobes',
      name: 'Wardrobes',
      category: 'furniture',
      note: 'Built-in Pax wardrobes along the east wall.',
      variants: fixed('pax', 'Built-in Pax'),
      options: [{ id: 'colour', label: 'Wardrobes', kind: 'chips', choices: WARDROBES, initial: 'wall' }],
      initial: { shown: true, variant: 'pax' },
    },
    {
      id: 'rug',
      name: 'Rug',
      category: 'decor',
      note: `A 200 × 300 cm rug under the bed. Prices and stock were checked on ${RUGS_CHECKED} and change often.`,
      variants: RUGS,
      initial: { shown: true, variant: 'naver' },
    },
  ],
} as const satisfies RoomDef;

export type BedroomComponentId = ComponentId<'bedroom'>;

export const bedroomDef = (id: BedroomComponentId): ComponentDef => {
  const def = BEDROOM.components.find((c) => c.id === id);
  if (!def) throw new Error(`No bedroom component ${id}`);
  return def;
};
