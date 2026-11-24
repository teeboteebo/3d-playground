import { roomById, roomSize, type RoomId } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { Menu, type MenuNav } from './Menu';
import { aboutTopic, wallsTopic, type RoomExit } from './roomTopics';

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

/** A room without furniture of its own yet: its walls, and what it is. */
export function SimpleRoomPanel({ room, settings, update, exit, menu }: Props) {
  const info = roomById(room);
  const blurb = BLURB[room];
  return (
    <Menu
      exit={exit}
      nav={menu}
      root={{
        id: room,
        title: info.name,
        summary: '',
        sub: blurb ? `${roomSize(info)} · ${blurb}` : roomSize(info),
        topics: [wallsTopic(room, settings, update), aboutTopic(`${roomSize(info)}, with the bedroom’s smoked oak floor. ${blurb ?? ''}`.trim())],
      }}
    />
  );
}
