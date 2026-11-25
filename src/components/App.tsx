import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROOM_DEFS } from '../data/roomDefs';
import { roomById, type RoomId, type RoomSelection } from '../data/rooms';
import { isGroup, leavesOf, resolvePick } from '../data/tree';
import { selectedLeaves, useEditor } from '../state/useEditor';
import { useSettings } from '../state/useSettings';
import { Panel } from './Panel';
import { Stage, type StageView } from './Stage';
import { MovePanel } from './MovePanel';
import { RoomPlan } from './RoomPlan';

/** a field where the keys belong to the text being typed, undo included */
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button', 'color'].includes(t.type)));

export function App() {
  const [settings, update, steps] = useSettings();
  const [stage, setStage] = useState<StageView | null>(null);
  const geometryChanged = useCallback(() => setStage((s) => s && { ...s }), []);
  const [workspace, setWorkspace] = useState<{ room: RoomId; tool: 'move' | 'plan'; node?: string } | null>(null);
  if (workspace && workspace.room !== settings.room) setWorkspace(null);
  const tool = workspace?.room === settings.room ? workspace.tool : null;
  const room = settings.room !== 'all' ? roomById(settings.room) : null;
  const poses = useMemo(() => {
    if (tool && room && stage) return stage.scene.roomPoses(room.id);
    return null;
  }, [tool, room, stage]);
  /* the room menu's open page, as topic ids from the room's summary; every change of room (coming back to one
     included) starts again at the summary */
  const [menu, setMenu] = useState<{ room: RoomSelection; path: readonly string[] }>({ room: settings.room, path: [] });
  if (menu.room !== settings.room) setMenu({ room: settings.room, path: [] });
  const path = menu.room === settings.room ? menu.path : [];
  /* the page a menu row under the mouse or focus would open, shown in 3D; it belongs to the room it was pointed in */
  const [pointed, setPointed] = useState<{ room: RoomSelection; path: readonly string[] } | null>(null);
  const point = useCallback((p: readonly string[] | null) => setPointed(p ? { room: settings.room, path: p } : null), [settings.room]);

  const editor = useEditor(settings, update);
  const go = (p: readonly string[]) => {
    if (path[0] === 'groups' && p[0] !== 'groups') editor.reset();
    setMenu({ room: settings.room, path: p });
  };
  const { tree } = editor;
  const pieceOf = (p: readonly string[]) => settings.room !== 'all' && p.length === 1
    ? ROOM_DEFS[settings.room].components.find((c) => c.id === p[0])
    : undefined;
  /* a click on something in 3D: a piece or group of the room's tree selects its node, anything else opens its page */
  const onOption = (p: readonly string[], add = false): string | undefined => {
    const piece = pieceOf(p);
    if (tree && piece) {
      const node = editor.pick(p[0], add);
      if (node) {
        const group = isGroup(tree, node);
        go(add || group ? ['groups'] : path[0] === 'groups' ? ['groups', p[0]] : [p[0]]);
        if (add || group) {
          const name = group ? tree.groups[node].name : piece.name;
          return `${add && editor.selected.includes(node) ? 'Deselected' : 'Selected'} ${name}`;
        }
        return;
      }
    }
    go(p);
  };
  /* what the mouse over a piece stands for when it is inside a group: the group's name, and every piece in it */
  const nodeOf = (p: readonly string[]) => {
    if (!tree || !pieceOf(p)) return null;
    const node = resolvePick(tree, p[0], editor.parent) ?? resolvePick(tree, p[0], null);
    return node && isGroup(tree, node) ? { label: tree.groups[node].name, ids: leavesOf(tree, node) } : null;
  };
  const selection = tree && path.length === 1 && path[0] === 'groups' && editor.selected.length > 0 ? selectedLeaves(tree, editor.selected) : null;
  const openTool = (next: 'move' | 'plan') => {
    if (!room) return;
    if (next === tool) return setWorkspace(null);
    const pageNode = path.at(-1);
    const node = workspace?.node ?? (pageNode && pieceOf([pageNode]) ? pageNode : editor.selected.length === 1 ? editor.selected[0] : undefined);
    setWorkspace({ room: room.id, tool: next, node });
  };
  const activeNode = workspace?.node;
  const outlines = tool === 'move' && tree ? activeNode ? leavesOf(tree, activeNode) : null : selection;

  /* keys for the whole app: undo and redo, and Escape to go up a page (or out of the room) */
  const keys = useRef({ steps, path, room: settings.room, go, update, editor, tool });
  useEffect(() => {
    keys.current = { steps, path, room: settings.room, go, update, editor, tool };
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
        if (k.tool) setWorkspace(null);
        else if (k.path.length === 1 && k.path[0] === 'groups' && k.editor.parent !== null) k.editor.leave();
        else if (k.path.length > 0) k.go(k.path.slice(0, -1));
        else if (k.room !== 'all') k.update({ room: 'all' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let toolPanel;
  if (tool && room && tree) {
    const select = (node?: string) => setWorkspace({ room: room.id, tool, node });
    const close = () => setWorkspace(null);
    const components = settings.rooms[room.id].components;
    if (!stage || !poses) toolPanel = <p role="status">This tool needs the 3D preview to measure the pieces.</p>;
    else if (tool === 'plan') {
      toolPanel = <RoomPlan room={room} tree={tree} poses={poses} components={components} initialSelection={activeNode}
        onClose={close} onSelect={select} mapHost={stage.container} />;
    } else {
      toolPanel = <MovePanel key={room.id} room={room} tree={tree} poses={poses} stage={stage} components={components}
        node={activeNode} parent={editor.parent} select={select} close={close} update={update} />;
    }
  }

  return (
    <div className="app">
      <Stage
        settings={settings}
        update={update}
        onOption={onOption}
        nodeOf={nodeOf}
        selection={outlines}
        onReady={setStage}
        onGeometryChange={geometryChanged}
        tool={tool}
        pointed={pointed?.room === settings.room ? pointed.path : null}
      />
      <Panel settings={settings} update={update} menu={{ path, go, point }} steps={steps} editor={editor} tools={room && (
        <div className="placement-tools" role="group" aria-label="Room tools">
          {tree && tree.root.length > 0 && <button type="button" className="chip" aria-pressed={tool === 'move'} onClick={() => openTool('move')}>Move pieces</button>}
          <button type="button" className="chip" aria-pressed={tool === 'plan'} onClick={() => openTool('plan')}>Room plan</button>
        </div>
      )}>
        {toolPanel}
      </Panel>
    </div>
  );
}
