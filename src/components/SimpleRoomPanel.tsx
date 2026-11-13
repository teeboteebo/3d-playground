import { roomById, roomSize, type RoomId } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { FinishSection } from './FinishSection';

const BLURB: Partial<Record<RoomId, string>> = {
  hall: 'The corridor between the bedroom and the living room.',
};

interface Props {
  room: RoomId;
  settings: Settings;
  update: Update;
}

/** A room without furniture of its own yet: just its finishes. */
export function SimpleRoomPanel({ room, settings, update }: Props) {
  const info = roomById(room);
  return (
    <>
      <h1>{info.name}</h1>
      <p className="sub">
        {roomSize(info)}. {BLURB[room]}
      </p>
      <FinishSection room={room} settings={settings} update={update} />
    </>
  );
}
