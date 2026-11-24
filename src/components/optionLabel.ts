import type { RoomDef } from '../data/components';
import { OFFICE } from '../data/office';
import type { RoomId } from '../data/rooms';
import { BEDROOM_MOULD_WALLS, LIVING_MOULD_WALLS } from '../scene/mouldWalls';
import { ROWS } from './menuStructure';

/** the titles of the room menus' rows, by id, as their rows show them */
const TITLES: Record<string, string> = Object.fromEntries(Object.entries(ROWS).map(([id, r]) => [id, r.title]));

/** each moulding wall section's title, by key */
const SECTIONS: Record<string, string> = Object.fromEntries(
  [...BEDROOM_MOULD_WALLS, ...LIVING_MOULD_WALLS].flatMap((w) => w.sections.map((s) => [s.key, w.sections.length === 1 ? w.label : `${w.label}: ${s.label}`])),
);

/** the rooms described as components, whose first path id is a component's name */
const ROOM_DEFS: Partial<Record<RoomId, RoomDef>> = { office: OFFICE };

/** what a menu path is called, for the label that follows the mouse in 3D: "Wall moulding · Bed wall" */
export function optionLabel(room: RoomId, path: readonly string[]): string {
  const [topic, sub] = path;
  const component = ROOM_DEFS[room]?.components.find((c) => c.id === topic);
  const title = component?.name ?? TITLES[topic] ?? topic;
  return sub ? `${title} · ${(topic === 'moulding' ? SECTIONS[sub] : undefined) ?? sub}` : title;
}
