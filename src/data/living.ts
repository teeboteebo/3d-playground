import { FLOOR_LAMPS, LAMPS_CHECKED, PENDANTS } from './catalog';
import type { RoomDef } from './components';

const lampNote = `A simplified shape. Prices and stock were checked on ${LAMPS_CHECKED} and change often.`;

export const LIVING = {
  id: 'living',
  components: [
    {
      id: 'ceiling-light',
      mount: { kind: 'fixed' },
      name: 'Ceiling light',
      category: 'lighting',
      note: lampNote,
      lamp: 'pendant',
      variants: PENDANTS,
      initial: { shown: false, variant: PENDANTS[0].id },
    },
    {
      id: 'floor-lamp',
      name: 'Floor lamp',
      category: 'lighting',
      note: lampNote,
      lamp: 'floor',
      variants: FLOOR_LAMPS,
      initial: { shown: false, variant: FLOOR_LAMPS[0].id },
    },
    {
      id: 'sofa',
      name: 'Sofa',
      category: 'furniture',
      note: 'The sofa is the IKEA NOCKEBY model from the SketchUp file, in its place, and its Bemz covers are drawn with a woven texture where the fabric is plain, rather than with their photo.',
      variants: [{ id: 'nockeby', name: 'IKEA NOCKEBY' }],
      options: [{ id: 'fabric', label: 'Fabric', kind: 'fabric', initial: 'original' }],
      initial: { shown: true, variant: 'nockeby' },
    },
    {
      id: 'tv',
      mount: { kind: 'wall', edge: 3 },
      name: 'Frame TV',
      category: 'furniture',
      note: 'The Frame TV is the model from the SketchUp file, hung centred over the sideboard.',
      variants: [{ id: 'frame', name: 'Frame TV' }],
      initial: { shown: true, variant: 'frame' },
    },
    {
      id: 'tv-bench',
      name: 'Sideboard',
      category: 'furniture',
      note: 'The TV sideboard is a 160 × 75 cm piece built in the bedroom dresser’s style.',
      variants: [{ id: 'sideboard', name: 'Sideboard, 160 × 75 cm' }],
      initial: { shown: true, variant: 'sideboard' },
    },
    {
      id: 'shelving',
      // The rear of the String model extends 3.6 mm into its mounting wall.
      mount: { kind: 'wall-and-floor', edge: 4, embedDepth: 0.004 },
      name: 'String shelving',
      category: 'furniture',
      note: 'The String shelving is the model from the SketchUp file, in its place, with its two left columns cut to about half height.',
      variants: [{ id: 'string', name: 'String shelving' }],
      initial: { shown: true, variant: 'string' },
    },
    {
      id: 'plant',
      name: 'Plant',
      category: 'furniture',
      note: 'The plant is the model from the SketchUp file, in its place by the end of the sofa.',
      variants: [{ id: 'plant', name: 'Plant' }],
      initial: { shown: true, variant: 'plant' },
    },
    {
      id: 'rug',
      name: 'Rug',
      category: 'decor',
      note: 'The rug is the ILVA Quebec, 250 × 350 cm.',
      variants: [{ id: 'quebec', name: 'ILVA Quebec, 250 × 350 cm' }],
      initial: { shown: true, variant: 'quebec' },
    },
  ],
} as const satisfies RoomDef;
