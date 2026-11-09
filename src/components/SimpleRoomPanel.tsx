import { ROOM_LIST, type RoomId } from '../data/catalog';
import type { Settings } from '../state/settings';
import { FinishSection } from './FinishSection';

const BLURB: Partial<Record<RoomId, string>> = {
  hall: 'The corridor between the bedroom and the living room.',
  end: 'Two angled corners, a north window and a door out.',
};

interface Props {
  room: RoomId;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

/** A room without furniture of its own yet: just its finishes. */
export function SimpleRoomPanel({ room, settings, update }: Props) {
  const info = ROOM_LIST.find((r) => r.id === room)!;
  return (
    <>
      <h1>{info.name}</h1>
      <p className="sub">
        {info.size}. {BLURB[room]}
      </p>
      <FinishSection room={room} settings={settings} update={update} />
    </>
  );
}
