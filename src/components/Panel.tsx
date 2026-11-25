import type { ReactNode } from 'react';
import type { Settings } from '../state/settings';
import type { Editor } from '../state/useEditor';
import type { Steps, Update } from '../state/useSettings';
import { AllRoomsPanel } from './AllRoomsPanel';
import type { MenuNav } from './Menu';
import { RoomPanel } from './RoomPanel';
import { StepsBar } from './StepsBar';

interface Props {
  settings: Settings;
  update: Update;
  /** the room menu's open page and the way to open another */
  menu: MenuNav;
  steps: Steps;
  editor: Editor;
  tools: ReactNode;
  placement: ReactNode;
  children?: ReactNode;
}

/**
 * The side panel: the apartment's controls and room list when no room is selected, otherwise the selected room's menu —
 * a summary of its options, each opening a page of its own — under a way back to all rooms.
 */
export function Panel({ settings, update, menu, steps, editor, tools, placement, children }: Props) {
  const room = settings.room;
  const exit = { text: 'All rooms', label: 'Back to all rooms', onExit: () => update({ room: 'all' }) };
  const props = { settings, update, exit, menu, editor };
  return (
    <aside className="panel">
      <div className="panel-body">
      {children ?? (room === 'all' ? <AllRoomsPanel settings={settings} update={update} steps={steps} /> : <RoomPanel key={room} room={room} {...props} />)}
      {placement}
      </div>
      <StepsBar steps={steps}>{tools}</StepsBar>
    </aside>
  );
}
