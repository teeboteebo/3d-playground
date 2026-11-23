import { useState } from 'react';
import type { RoomSelection } from '../data/rooms';
import { useSettings } from '../state/useSettings';
import { Panel } from './Panel';
import { Stage } from './Stage';

export function App() {
  const [settings, update] = useSettings();
  /* the room menu's open page, as topic ids from the room's summary; every change of room (coming back to one
     included) starts again at the summary */
  const [menu, setMenu] = useState<{ room: RoomSelection; path: readonly string[] }>({ room: settings.room, path: [] });
  if (menu.room !== settings.room) setMenu({ room: settings.room, path: [] });
  const path = menu.room === settings.room ? menu.path : [];
  const go = (p: readonly string[]) => setMenu({ room: settings.room, path: p });
  return (
    <div className="app">
      <Stage settings={settings} update={update} onOption={go} />
      <Panel settings={settings} update={update} menu={{ path, go }} />
    </div>
  );
}
