import { roomById, roomSize, type RoomId } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { FinishSection } from './FinishSection';
import { Menu, type MenuNav } from './Menu';
import { wallsTopic, type RoomExit } from './roomTopics';

const BLURB: Partial<Record<RoomId, string>> = {
  hall: 'The corridor between the bedroom and the living room.',
};

interface Props {
  room: RoomId;
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
}

/** A room without furniture of its own yet: just its finishes. */
export function SimpleRoomPanel({ room, settings, update, exit, menu }: Props) {
  const info = roomById(room);
  return (
    <Menu
      exit={exit}
      nav={menu}
      root={{
        id: room,
        title: info.name,
        summary: '',
        sub: `${roomSize(info)}. ${BLURB[room] ?? ''}`.trim(),
        topics: [wallsTopic(room, settings, <FinishSection room={room} settings={settings} update={update} />)],
      }}
    />
  );
}
