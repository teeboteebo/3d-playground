import { OFFICE, type OfficeComponentId } from '../data/office';
import { roomById, roomSize } from '../data/rooms';
import { roundRugThumbnail } from '../scene/canvas';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { componentGroups, componentTopic } from './componentTopic';
import { Menu, type MenuNav, type Topic } from './Menu';
import { ROWS } from './menuStructure';
import { ShowHideSection } from './ShowHideSection';
import { aboutTopic, wallsTopic, type RoomExit } from './roomTopics';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
}

export function OfficePanel({ settings, update, exit, menu }: Props) {
  const { components } = settings.office;
  const state = (id: string) => components[id as OfficeComponentId];
  const setShown = (ids: string[], shown: boolean) =>
    update({ office: { components: Object.fromEntries(ids.map((id) => [id, { shown }])) } });
  const shownCount = OFFICE.components.filter((c) => state(c.id).shown).length;
  const changed = OFFICE.components.filter((c) => state(c.id).shown !== c.initial.shown);
  const showHide: Topic = {
    id: 'furniture',
    title: ROWS.furniture.title,
    summary: shownCount === OFFICE.components.length ? 'All shown' : `${shownCount} of ${OFFICE.components.length} shown`,
    content: (
      <ShowHideSection
        groups={componentGroups(OFFICE, (def) => ({ id: def.id, title: def.name, summary: '' }))}
        shown={(id) => state(id).shown}
        set={setShown}
        point={(id) => menu.point?.(id ? [id] : null)}
      />
    ),
    /* back to how the room starts: the lamps off, everything else shown */
    reset: changed.length === 0 ? undefined : () => update({ office: { components: Object.fromEntries(changed.map((c) => [c.id, { shown: c.initial.shown }])) } }),
  };
  const root: Topic = {
    id: 'office',
    title: 'Office',
    summary: '',
    sub: `${roomSize(roomById('office'))} · Two angled corners, a north window and a door out, with a reading corner.`,
    groups: [
      { title: 'Room', topics: [wallsTopic('office', settings, update), showHide] },
      ...componentGroups(OFFICE, (def) =>
        componentTopic(
          def,
          state(def.id),
          (patch) => update({ office: { components: { [def.id]: patch } } }),
          def.id === 'round-rug' ? (v) => (v.shape ? roundRugThumbnail((v.shape as { pattern: string }).pattern) : '') : undefined,
        ),
      ),
    ],
    /* after the groups: the last row of every room */
    topics: [
      aboutTopic(
        <>
          Each piece's page gives its product and size. All are simplified shapes, and the floor and the window and door positions are
          assumed.
        </>,
      ),
    ],
  };
  return <Menu root={root} exit={exit} nav={menu} />;
}
