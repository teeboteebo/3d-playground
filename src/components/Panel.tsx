import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { AllRoomsPanel } from './AllRoomsPanel';
import { BedroomPanel } from './BedroomPanel';
import { LivingPanel } from './LivingPanel';
import { SimpleRoomPanel } from './SimpleRoomPanel';

interface Props {
  settings: Settings;
  update: Update;
}

/**
 * The side panel: the apartment's controls and room list when no room is selected, otherwise the selected room's
 * controls under a way back to all rooms.
 */
export function Panel({ settings, update }: Props) {
  const room = settings.room;
  return (
    <aside className="panel">
      {room === 'all' ? (
        <AllRoomsPanel settings={settings} update={update} />
      ) : (
        <>
          <button type="button" className="back" aria-label="Back to all rooms" onClick={() => update({ room: 'all' })}>
            <span aria-hidden="true">←</span> All rooms
          </button>
          {room === 'bedroom' ? (
            <BedroomPanel settings={settings} update={update} />
          ) : room === 'living' ? (
            <LivingPanel settings={settings} update={update} />
          ) : (
            <SimpleRoomPanel room={room} settings={settings} update={update} />
          )}
        </>
      )}
    </aside>
  );
}
