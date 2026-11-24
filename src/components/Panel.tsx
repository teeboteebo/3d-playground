import type { Settings } from '../state/settings';
import type { Steps, Update } from '../state/useSettings';
import { AllRoomsPanel } from './AllRoomsPanel';
import { BedroomPanel } from './BedroomPanel';
import { LivingPanel } from './LivingPanel';
import { OfficePanel } from './OfficePanel';
import type { MenuNav } from './Menu';
import { SimpleRoomPanel } from './SimpleRoomPanel';
import { StepsBar } from './StepsBar';

interface Props {
  settings: Settings;
  update: Update;
  /** the room menu's open page and the way to open another */
  menu: MenuNav;
  steps: Steps;
}

/**
 * The side panel: the apartment's controls and room list when no room is selected, otherwise the selected room's menu —
 * a summary of its options, each opening a page of its own — under a way back to all rooms.
 */
export function Panel({ settings, update, menu, steps }: Props) {
  const room = settings.room;
  const exit = { text: 'All rooms', label: 'Back to all rooms', onExit: () => update({ room: 'all' }) };
  const props = { settings, update, exit, menu };
  return (
    <aside className="panel">
      <div className="panel-body">
      {room === 'all' ? (
        <AllRoomsPanel settings={settings} update={update} steps={steps} />
      ) : room === 'bedroom' ? (
        <BedroomPanel key={room} {...props} />
      ) : room === 'living' ? (
        <LivingPanel key={room} {...props} />
      ) : room === 'office' ? (
        <OfficePanel key={room} {...props} />
      ) : (
        <SimpleRoomPanel key={room} room={room} {...props} />
      )}
      </div>
      <StepsBar steps={steps} />
    </aside>
  );
}
