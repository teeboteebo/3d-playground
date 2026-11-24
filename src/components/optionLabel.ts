import { BEDROOM_MOULD_WALLS, LIVING_MOULD_WALLS } from '../scene/mouldWalls';
import { ROWS } from './menuStructure';

/** the titles of the room menus' rows, by id, as their rows show them */
const TITLES: Record<string, string> = Object.fromEntries(Object.entries(ROWS).map(([id, r]) => [id, r.title]));

/** each moulding wall section's title, by key */
const SECTIONS: Record<string, string> = Object.fromEntries(
  [...BEDROOM_MOULD_WALLS, ...LIVING_MOULD_WALLS].flatMap((w) => w.sections.map((s) => [s.key, w.sections.length === 1 ? w.label : `${w.label}: ${s.label}`])),
);

/** what a menu path is called, for the label that follows the mouse in 3D: "Wall moulding · Bed wall" */
export function optionLabel(path: readonly string[]): string {
  const [topic, sub] = path;
  const title = TITLES[topic] ?? topic;
  return sub ? `${title} · ${(topic === 'moulding' ? SECTIONS[sub] : undefined) ?? sub}` : title;
}
