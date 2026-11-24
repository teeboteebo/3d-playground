import { LIVING } from '../data/living';
import type { ComponentId } from '../data/roomDefs';
import { roomById, roomSize } from '../data/rooms';
import { LIVING_MOULD_WALLS } from '../scene/mouldWalls';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { componentGroups, componentTopic } from './componentTopic';
import { Menu, type MenuNav, type Topic } from './Menu';
import { ROWS } from './menuStructure';
import { mouldingTopic } from './mouldingTopic';
import { ShowHideSection } from './ShowHideSection';
import { useShoppingList } from './useShoppingList';
import { aboutTopic, wallsTopic, type RoomExit } from './roomTopics';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
}

type LivingId = ComponentId<'living'>;

export function LivingPanel({ settings, update, exit, menu }: Props) {
  const { components } = settings.living;
  const shopping = useShoppingList('living', settings);
  const state = (id: string) => components[id as LivingId];
  const setShown = (ids: string[], shown: boolean) =>
    update({ living: { components: Object.fromEntries(ids.map((id) => [id, { shown }])) } });
  const shownCount = LIVING.components.filter((c) => state(c.id).shown).length;
  const changed = LIVING.components.filter((c) => state(c.id).shown !== c.initial.shown);
  const showHide: Topic = {
    id: 'furniture',
    title: ROWS.furniture.title,
    summary: shownCount === LIVING.components.length ? 'All shown' : `${shownCount} of ${LIVING.components.length} shown`,
    content: (
      <ShowHideSection
        groups={componentGroups(LIVING, (def) => ({ id: def.id, title: def.name, summary: '' }))}
        shown={(id) => state(id).shown}
        set={setShown}
        point={(id) => menu.point?.(id ? [id] : null)}
      />
    ),
    /* back to how the room starts: the lamps off, everything else shown */
    reset: changed.length === 0 ? undefined : () => update({ living: { components: Object.fromEntries(changed.map((c) => [c.id, { shown: c.initial.shown }])) } }),
  };
  const root: Topic = {
    id: 'living',
    title: 'Living room',
    summary: '',
    sub: `${roomSize(roomById('living'))} · An angled bay window, with the furniture from the SketchUp model in its places.`,
    groups: [
      {
        title: 'Room',
        topics: [wallsTopic('living', settings, update), mouldingTopic('living', LIVING_MOULD_WALLS, settings, update, shopping, menu), showHide],
      },
      ...componentGroups(LIVING, (def) =>
        componentTopic(def, state(def.id), (patch) => update({ living: { components: { [def.id]: patch } } })),
      ),
    ],
    /* after the groups: the last row of every room */
    topics: [
      aboutTopic(
        <>
          The room is 500 × 465 cm with an angled bay window. The sofa, shelving, plant, rug and other pieces are the models from the SketchUp file,
          in the places they have there; the TV sideboard is a 160 × 75 cm piece built in the bedroom dresser’s style. Sofa fabrics are Bemz covers
          for the IKEA NOCKEBY sofa, and plain fabrics are drawn with a woven texture rather than their photo.
        </>,
      ),
    ],
  };
  return <Menu root={root} exit={exit} nav={menu} />;
}
