import { useCallback, useEffect, useRef, useState } from 'react';
import { ROOM_DEFS } from '../data/roomDefs';
import type { RoomSelection } from '../data/rooms';
import { isGroup, leavesOf, resolvePick } from '../data/tree';
import { selectedLeaves, useEditor } from '../state/useEditor';
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
  /* the page a menu row under the mouse or focus would open, shown in 3D; it belongs to the room it was pointed in */
  const [pointed, setPointed] = useState<{ room: RoomSelection; path: readonly string[] } | null>(null);
  const point = useCallback((p: readonly string[] | null) => setPointed(p ? { room: settings.room, path: p } : null), [settings.room]);

  const editor = useEditor(settings, update);
  const { tree } = editor;
  const isPiece = (id: string) => settings.room !== 'all' && ROOM_DEFS[settings.room].components.some((c) => c.id === id);
  /* a click on something in 3D: a piece or group of the room's tree selects its node, anything else opens its page */
  const onOption = (p: readonly string[], add = false): string | undefined => {
    if (tree && p.length === 1 && isPiece(p[0])) {
      const node = editor.pick(p[0], add);
      if (node) {
        const group = isGroup(tree, node);
        go(add || group ? ['groups'] : [p[0]]);
        return group ? `Selected ${tree.groups[node].name}` : undefined;
      }
    }
    go(p);
  };
  /* what the mouse over a piece stands for when it is inside a group: the group's name, and every piece in it */
  const nodeOf = (p: readonly string[]) => {
    if (!tree || p.length !== 1 || !isPiece(p[0])) return null;
    const node = resolvePick(tree, p[0], editor.parent) ?? resolvePick(tree, p[0], null);
    return node && isGroup(tree, node) ? { label: tree.groups[node].name, ids: leavesOf(tree, node) } : null;
  };
  const selection = tree && settings.room !== 'all' && path[0] === 'groups' && editor.selected.length > 0 ? selectedLeaves(tree, editor.selected) : null;

  /* keys for the whole app: undo and redo, and Escape to go up a page (or out of the room) */
  const keys = useRef({ steps, path, room: settings.room, go, update, editor });
  useEffect(() => {
    keys.current = { steps, path, room: settings.room, go, update, editor };
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
        if (k.path[0] === 'groups' && k.editor.parent !== null) k.editor.leave();
        else if (k.path.length > 0) k.go(k.path.slice(0, -1));
        else if (k.room !== 'all') k.update({ room: 'all' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Stage
        settings={settings}
        update={update}
        onOption={onOption}
        nodeOf={nodeOf}
        selection={selection}
        pointed={pointed?.room === settings.room ? pointed.path : null}
      />
      <Panel settings={settings} update={update} menu={{ path, go, point }} steps={steps} editor={editor} />
    </div>
  );
}
