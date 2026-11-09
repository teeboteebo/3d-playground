import type { Settings } from '../state/settings';
import { AllRoomsPanel } from './AllRoomsPanel';
import { BedroomPanel } from './BedroomPanel';
import { LivingPanel } from './LivingPanel';
import { RoomSwitcher } from './RoomSwitcher';
import { SimpleRoomPanel } from './SimpleRoomPanel';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

/** The side panel: the room switcher, then the selected room's controls (or the apartment's when none is). */
export function Panel({ settings, update }: Props) {
  const room = settings.room;
  return (
    <aside className="panel">
      <RoomSwitcher value={room} onChange={(r) => update({ room: r })} />
      {room === 'all' ? (
        <AllRoomsPanel settings={settings} update={update} />
      ) : room === 'bedroom' ? (
        <BedroomPanel settings={settings} update={update} />
      ) : room === 'living' ? (
        <LivingPanel settings={settings} update={update} />
      ) : (
        <SimpleRoomPanel room={room} settings={settings} update={update} />
      )}
    </aside>
  );
}
