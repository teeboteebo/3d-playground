import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROOM_DEFS } from '../data/roomDefs';
import { roomById, type RoomId, type RoomSelection } from '../data/rooms';
import { isGroup, leavesOf, resolvePick } from '../data/tree';
import { selectedLeaves, useEditor } from '../state/useEditor';
import { motionFor } from '../scene/placementMove';
import { useSettings } from '../state/useSettings';
import { Panel } from './Panel';
import { Stage, type StageView } from './Stage';
import { PlacementControls } from './PlacementControls';
import { RoomPlan } from './RoomPlan';

/** a field where the keys belong to the text being typed, undo included */
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button', 'color'].includes(t.type)));

export function App() {
  const [settings, update, steps] = useSettings();
  const [stage, setStage] = useState<StageView | null>(null);
  const geometryChanged = useCallback(() => setStage((s) => s && { ...s }), []);
  const [planRoom, setPlanRoom] = useState<RoomId | null>(null);
  if (planRoom && planRoom !== settings.room) setPlanRoom(null);
  const planOpen = planRoom === settings.room;
  const room = settings.room !== 'all' ? roomById(settings.room) : null;
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
  const openPiece = pieceOf(path[0] === 'groups' ? path.slice(1) : path);
  const checked = path.length === 1 && path[0] === 'groups' ? editor.selected : [];
  const activeNode = openPiece?.id ?? (checked.length === 1 ? checked[0] : undefined);
  const outlines = openPiece ? [openPiece.id] : tree && checked.length ? selectedLeaves(tree, checked) : null;
  const measure = planOpen || !!activeNode;
  const poses = useMemo(() => measure && room && stage ? stage.scene.roomPoses(room.id) : null, [measure, room, stage]);
  const selection = useMemo(() => room && tree && activeNode && poses
    ? { room, tree, node: activeNode, poses, components: settings.rooms[room.id].components } : null,
  [room, tree, activeNode, poses, settings.rooms]);
  const motion = useMemo(() => selection && motionFor(selection), [selection]);

  /* keys for the whole app: undo and redo, and Escape to go up a page (or out of the room) */
  const keys = useRef({ steps, path, room: settings.room, go, update, editor, planOpen });
  useEffect(() => {
    keys.current = { steps, path, room: settings.room, go, update, editor, planOpen };
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
        if (k.planOpen) setPlanRoom(null);
        else if (k.path.length === 1 && k.path[0] === 'groups' && k.editor.parent !== null) k.editor.leave();
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
        selection={outlines}
        onReady={setStage}
        onGeometryChange={geometryChanged}
        planOpen={planOpen}
        canDrag={!!motion && motion.kind !== 'blocked'}
        pointed={pointed?.room === settings.room ? pointed.path : null}
      />
      <Panel settings={settings} update={update} menu={{ path, go, point }} steps={steps} editor={editor}
        placement={!planOpen && selection && motion && stage &&
          <PlacementControls key={`${selection.room.id}/${selection.node}`} selection={selection} motion={motion} stage={stage} update={update} />}
        tools={room && (
        <div className="placement-tools" role="group" aria-label="Room tools">
          <button type="button" className="chip" aria-pressed={planOpen} onClick={() => setPlanRoom(planOpen ? null : room.id)}>Room plan</button>
        </div>
      )}>
        {planOpen && room && tree ? stage && poses
          ? <RoomPlan room={room} tree={tree} poses={poses} components={settings.rooms[room.id].components} initialSelection={activeNode}
              onClose={() => setPlanRoom(null)} mapHost={stage.container} />
          : <p role="status">Room plan needs the 3D preview to measure the pieces.</p> : undefined}
      </Panel>
    </div>
  );
}
