import { OFFICE } from '../data/office';
import { roomById, roomSize } from '../data/rooms';
import { roundRugThumbnail } from '../scene/canvas';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { componentGroups, componentTopic } from './componentTopic';
import { FinishSection } from './FinishSection';
import { Menu, type MenuNav, type Topic } from './Menu';
import { wallsTopic, type RoomExit } from './roomTopics';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
}

export function OfficePanel({ settings, update, exit, menu }: Props) {
  const { components } = settings.office;
  const root: Topic = {
    id: 'office',
    title: 'Office',
    summary: '',
    sub: `${roomSize(roomById('office'))}. Two angled corners, a north window and a door out. Pick what to change.`,
    groups: [
      { title: 'Room', topics: [wallsTopic('office', settings, <FinishSection room="office" settings={settings} update={update} />)] },
      ...componentGroups(OFFICE, (def) =>
        componentTopic(
          def,
          components[def.id as keyof typeof components],
          (patch) => update({ office: { components: { [def.id]: patch } } }),
          def.id === 'round-rug' ? (v) => (v.shape ? roundRugThumbnail((v.shape as { pattern: string }).pattern) : '') : undefined,
        ),
      ),
    ],
  };
  return <Menu root={root} exit={exit} nav={menu} />;
}
