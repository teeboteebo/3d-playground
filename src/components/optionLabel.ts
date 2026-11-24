import { ROOM_DEFS } from '../data/roomDefs';
import type { RoomId } from '../data/rooms';
import { BEDROOM_MOULD_WALLS, LIVING_MOULD_WALLS } from '../scene/mouldWalls';

/** the titles of the room menu's rows that are not components, by id */
const TITLES: Record<string, string> = { walls: 'Wall colour', moulding: 'Wall moulding', accent: 'Accent colour' };

/** each moulding wall section's title, by key */
const SECTIONS: Record<string, string> = Object.fromEntries(
  [...BEDROOM_MOULD_WALLS, ...LIVING_MOULD_WALLS].flatMap((w) => w.sections.map((s) => [s.key, w.sections.length === 1 ? w.label : `${w.label}: ${s.label}`])),
);

/** what a menu path is called, for the label that follows the mouse in 3D: "Wall moulding · Bed wall" */
export function optionLabel(room: RoomId, path: readonly string[]): string {
  const [topic, sub] = path;
  const component = ROOM_DEFS[room].components.find((c) => c.id === topic);
  const title = component?.name ?? TITLES[topic] ?? topic;
  return sub ? `${title} · ${(topic === 'moulding' ? SECTIONS[sub] : undefined) ?? sub}` : title;
}
