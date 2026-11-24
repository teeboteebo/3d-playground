import { roomById, roomSize } from '../data/rooms';
import { roundRugThumbnail } from '../scene/canvas';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { Menu, type MenuNav } from './Menu';
import { roomPage } from './roomPage';
import type { RoomExit } from './roomTopics';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
}

export function OfficePanel({ settings, update, exit, menu }: Props) {
  const root = roomPage({
    room: 'office',
    title: 'Office',
    sub: `${roomSize(roomById('office'))} · Two angled corners, a north window and a door out, with a reading corner.`,
    settings,
    update,
    menu,
    about: (
      <>
        Each piece's page gives its product and size. All are simplified shapes, and the floor and the window and door positions are
        assumed.
      </>
    ),
    thumbs: { 'round-rug': (v) => (v.shape ? roundRugThumbnail((v.shape as { pattern: string }).pattern) : '') },
  });
  return <Menu root={root} exit={exit} nav={menu} />;
}
