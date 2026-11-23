import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { AllRoomsPanel } from './AllRoomsPanel';
import { BedroomPanel } from './BedroomPanel';
import { LivingPanel } from './LivingPanel';
import { OfficePanel } from './OfficePanel';
import { SimpleRoomPanel } from './SimpleRoomPanel';

interface Props {
  settings: Settings;
  update: Update;
}

/**
 * The side panel: the apartment's controls and room list when no room is selected, otherwise the selected room's menu —
 * a summary of its options, each opening a page of its own — under a way back to all rooms.
 */
export function Panel({ settings, update }: Props) {
  const room = settings.room;
  const exit = { text: 'All rooms', label: 'Back to all rooms', onExit: () => update({ room: 'all' }) };
  const props = { settings, update, exit };
  return (
    <aside className="panel">
      {room === 'all' ? (
        <AllRoomsPanel settings={settings} update={update} />
      ) : room === 'bedroom' ? (
        <BedroomPanel key={room} {...props} />
      ) : room === 'living' ? (
        <LivingPanel key={room} {...props} />
      ) : room === 'office' ? (
        <OfficePanel key={room} {...props} />
      ) : (
        <SimpleRoomPanel key={room} room={room} {...props} />
      )}
    </aside>
  );
}
