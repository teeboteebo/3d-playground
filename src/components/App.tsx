import { useEffect, useRef, useState } from 'react';
import type { RoomSelection } from '../data/rooms';
import { useSettings } from '../state/useSettings';
import { Panel } from './Panel';
import { Stage } from './Stage';

/** a field where the keys belong to the text being typed, undo included */
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button', 'color'].includes(t.type)));

export function App() {
  const [settings, update, steps] = useSettings();
  /* the room menu's open page, as topic ids from the room's summary; every change of room (coming back to one
     included) starts again at the summary */
  const [menu, setMenu] = useState<{ room: RoomSelection; path: readonly string[] }>({ room: settings.room, path: [] });
  if (menu.room !== settings.room) setMenu({ room: settings.room, path: [] });
  const path = menu.room === settings.room ? menu.path : [];
  const go = (p: readonly string[]) => setMenu({ room: settings.room, path: p });

  /* keys for the whole app: undo and redo, and Escape to go up a page (or out of the room) */
  const keys = useRef({ steps, path, room: settings.room, go, update });
  useEffect(() => {
    keys.current = { steps, path, room: settings.room, go, update };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.defaultPrevented || typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && !e.altKey && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) k.steps.redo();
        else k.steps.undo();
      } else if (mod && !e.altKey && key === 'y') {
        e.preventDefault();
        k.steps.redo();
      } else if (e.key === 'Escape' && !mod) {
        if (k.path.length > 0) k.go(k.path.slice(0, -1));
        else if (k.room !== 'all') k.update({ room: 'all' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Stage settings={settings} update={update} onOption={go} />
      <Panel settings={settings} update={update} menu={{ path, go }} steps={steps} />
    </div>
  );
}
