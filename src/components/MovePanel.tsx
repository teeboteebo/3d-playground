import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ComponentState } from '../data/components';
import { ROOM_DEFS } from '../data/roomDefs';
import type { Room } from '../data/rooms';
import { ancestorsOf, isGroup, leavesOf, parentOf, resolvePick, type Parent, type RoomTree } from '../data/tree';
import { clearances, type Clearance } from '../lib/clearances';
import { roomWalls } from '../scene/apartment';
import { changeWall, constrainedDelta, motionFor, tangent, translateSelection, ZERO, type Motion, type MoveResult, type MoveSelection } from '../scene/placementMove';
import type { PlacedLeaf, Translation } from '../scene/rigidPlacement';
import type { Update } from '../state/useSettings';
import type { StageView } from './Stage';
import './placement.css';

interface Props {
  room: Room;
  tree: RoomTree;
  poses: ReadonlyMap<string, PlacedLeaf>;
  components: Readonly<Record<string, ComponentState>>;
  stage: StageView;
  node?: string;
  parent: Parent;
  select(id: string): void;
  update: Update;
  close(): void;
}

interface Drag {
  pointer: number;
  x: number;
  y: number;
  origin: Translation;
  normal: Translation;
  motion: Exclude<Motion, { kind: 'blocked' }>;
  selection: MoveSelection;
}

const reasons = {
  unavailable: 'has no measured geometry yet', fixed: 'is fixed to the ceiling', pinned: 'is held by incompatible mounts',
  outside: 'would leave the room', opening: 'would cover a door or window opening', wall: 'must stay on its wall', floor: 'must stay on the floor',
};

function Guides({ stage, lines }: { stage: StageView; lines: readonly Clearance[] }) {
  const svg = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    if (!lines.length) return;
    let frame = 0;
    const draw = () => {
      lines.forEach((line, i) => {
        const group = svg.current?.children[i];
        if (!group) return;
        const a = stage.scene.project(line.from), b = stage.scene.project(line.to);
        const path = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
        if (group.children[0].getAttribute('d') === path) return;
        group.children[0].setAttribute('d', path);
        group.children[1].setAttribute('x', String((a.x + b.x) / 2));
        group.children[1].setAttribute('y', String((a.y + b.y) / 2 - 5));
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [lines, stage]);
  return (
    <svg ref={svg} className="move-guides" aria-hidden="true">
      {lines.map((line) => <g key={line.label}><path /><text>{line.label} · {line.cm} cm</text></g>)}
    </svg>
  );
}

export function MovePanel({ room, tree, poses, components, stage, node, parent, select, update, close }: Props) {
  const [status, say] = useState('');
  const [preview, setPreview] = useState<{ base: Props['poses']; leaves: Props['poses'] } | null>(null);
  const ghost = preview?.base === poses ? preview.leaves : null;
  const [step, setStep] = useState('5');
  const [target, setTarget] = useState('');
  const drag = useRef<Drag | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const { scene } = stage;
  const defs = ROOM_DEFS[room.id].components;
  const name = (id: string) => (isGroup(tree, id) ? tree.groups[id].name : defs.find((c) => c.id === id)?.name) ?? id;
  const selectionOf = (id: string): MoveSelection => ({ room, tree, poses, components, node: id });
  const selection = node && parentOf(tree, node) !== undefined ? selectionOf(node) : null;
  const motion = selection && motionFor(selection);
  const members = selection ? leavesOf(tree, selection.node) : [];
  const leaves = members.flatMap((id) => ghost?.get(id) ?? poses.get(id) ?? []);
  const nearest = new Map<string, Clearance>();
  if (leaves.length === members.length) for (const g of clearances(room, leaves)) {
    if (!nearest.has(g.label) || nearest.get(g.label)!.cm > g.cm) nearest.set(g.label, g);
  }
  const lines = [...nearest.values()];
  const warn = (result: Extract<MoveResult, { ok: true }>) => result.overlaps.length ? ` Overlaps ${result.overlaps.map(name).join(', ')}.` : '';
  const why = (r: { member: string; reason: keyof typeof reasons }) => `${name(r.member)} ${reasons[r.reason]}.`;
  const commit = (id: string, result: MoveResult) => {
    if (!result.ok) { say(`Not moved. ${why(result)}`); return; }
    update({ rooms: { [room.id]: { components: Object.fromEntries([...result.transforms].map(([key, pose]) => [key, { pose }])) } } });
    say(`Moved ${name(id)}.${warn(result)}`);
  };

  function release() {
    const d = drag.current;
    drag.current = null;
    if (d && surface.current?.hasPointerCapture(d.pointer)) surface.current.releasePointerCapture(d.pointer);
    scene.preview(room.id, null);
    setPreview(null);
  }
  useLayoutEffect(() => {
    const el = surface.current;
    return () => {
      const d = drag.current;
      drag.current = null;
      if (d && el?.hasPointerCapture(d.pointer)) el.releasePointerCapture(d.pointer);
      scene.preview(room.id, null);
    };
  }, [room, poses, scene]);
  useEffect(() => {
    const cancel = () => {
      if (!drag.current) return;
      release();
      say('Move cancelled.');
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.current) {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', cancel);
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('blur', cancel); };
  });
  const choose = (id: string) => {
    select(id);
    setTarget('');
    say('');
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) { release(); say('Move cancelled. Drag with one pointer.'); return; }
    if (!e.isPrimary || e.button !== 0) return;
    const hit = scene.hit(e.clientX, e.clientY);
    if (!hit || hit.option.room !== room.id || hit.option.path.length !== 1) return;
    const leaf = hit.option.path[0];
    const level = selection ? parentOf(tree, selection.node) ?? null : parent;
    const id = resolvePick(tree, leaf, level) ?? resolvePick(tree, leaf, null);
    if (!id) return;
    choose(id);
    const s = selectionOf(id);
    const m = motionFor(s);
    if (m.kind === 'blocked') { say(why(m)); return; }
    const [dx, dz] = m.kind === 'wall' ? tangent(m.wall) : [0, 0];
    const normal = m.kind === 'wall' && m.lift ? { x: -dz, y: 0, z: dx } : { x: 0, y: 1, z: 0 };
    drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, origin: hit.point, normal, motion: m, selection: s };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveAt = (d: Drag, e: PointerEvent) => {
    const p = scene.intersect(e.clientX, e.clientY, d.origin, d.normal);
    if (!p) return null;
    return translateSelection(d.selection, constrainedDelta(d.motion, { x: p.x - d.origin.x, y: p.y - d.origin.y, z: p.z - d.origin.z }));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.pointer !== e.pointerId) return;
    const result = moveAt(d, e);
    if (!result?.ok) {
      say(result ? `Cannot drop here. ${why(result)}` : 'Cannot drop here. Choose a different camera view.');
      return;
    }
    scene.preview(room.id, result.transforms);
    setPreview({ base: d.selection.poses, leaves: result.leaves });
    say(`Release to place ${name(d.selection.node)}.${warn(result)}`);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.pointer !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 3;
    const result = moved ? moveAt(d, e) : null;
    release();
    if (result) commit(d.selection.node, result);
    else if (moved) say('Not moved. Choose a different camera view.');
  };
  const ids = (nodes: readonly string[]): string[] => nodes.flatMap((id) => [id, ...(isGroup(tree,id) ? ids(tree.groups[id].children) : [])]);
  const nudge = (label: string, delta: Translation) => (
    <button className="chip" type="button" key={label} disabled={!(Number(step) > 0 && Number.isFinite(Number(step)))}
      onClick={() => {
        if (!selection) return;
        const metres = Number(step) / 100;
        commit(selection.node, translateSelection(selection, { x: delta.x * metres, y: delta.y * metres, z: delta.z * metres }));
      }}>{label}</button>
  );
  const walls = roomWalls(room);
  return (
    <div className="move-panel">
      <button className="back" type="button" onClick={close}>‹ Back to room</button>
      <h1>Move pieces</h1>
      <p className="sub">Drag a piece in the room. Release to place it, or press Escape to cancel. Groups move together.</p>
      <label className="sl">Piece or group
        <select value={selection?.node ?? ''} onChange={(e) => choose(e.target.value)}>
          <option value="" disabled>Pick a piece or group</option>
          {ids(tree.root).map((id) => <option key={id} value={id}>{[...ancestorsOf(tree,id),id].map(name).join(' › ')}</option>)}
        </select>
      </label>
      {motion?.kind === 'blocked' && <p>{why(motion)}</p>}
      {motion && motion.kind !== 'blocked' && <section>
        <h2>Fine adjustment</h2>
        <label className="move-step">Step (cm) <input type="number" min="0.1" step="any" value={step} onChange={(e) => setStep(e.target.value)} /></label>
        <div className="chips">
          {motion.kind === 'floor' && <>
            {nudge('−X', { ...ZERO, x: -1 })}{nudge('+X', { ...ZERO, x: 1 })}
            {nudge('−Z', { ...ZERO, z: -1 })}{nudge('+Z', { ...ZERO, z: 1 })}
          </>}
          {motion.kind === 'wall' && motion.slide && [-1, 1].map((sign) => {
            const [x,z] = tangent(motion.wall);
            return nudge(sign < 0 ? 'Along wall −' : 'Along wall +', { x: sign*x, y: 0, z: sign*z });
          })}
          {motion.kind === 'wall' && motion.lift && <>{nudge('Lower', { ...ZERO, y: -1 })}{nudge('Raise', { ...ZERO, y: 1 })}</>}
        </div>
      </section>}
      {motion?.kind === 'wall' && motion.canRemount && selection && <section>
        <label className="sl">Mounting wall
          <select value={target || String(motion.wall.edge)} onChange={(e) => setTarget(e.target.value)}>
            {walls.map((w) => <option key={w.edge} value={w.edge}>Wall {w.edge + 1}{w.edge === motion.wall.edge ? ' (current)' : ''}</option>)}
          </select>
        </label>
        <button className="chip" type="button" disabled={!target || Number(target) === motion.wall.edge} onClick={() => {
          const wall = walls.find((w) => w.edge === Number(target));
          if (wall) commit(selection.node, changeWall(selection, wall));
          setTarget('');
        }}>Change wall</button>
      </section>}
      {lines.length > 0 && <section><h2>Room clearances</h2><dl className="move-measures">
        {lines.map((g) => <div key={g.label}><dt>{g.label}</dt><dd>{g.cm} cm</dd></div>)}
      </dl></section>}
      <p role="status" className="move-status">{status}</p>
      {createPortal(<>
        <div ref={surface} className="move-surface" aria-label="Drag a piece to position it" onPointerDown={down} onPointerMove={move}
          onPointerUp={up} onPointerCancel={release} onLostPointerCapture={() => { if (drag.current) release(); }} />
        <Guides stage={stage} lines={lines} />
      </>, stage.container)}
    </div>
  );
}
