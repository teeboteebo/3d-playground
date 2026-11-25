import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ROOM_DEFS } from '../data/roomDefs';
import { isGroup, leavesOf } from '../data/tree';
import { clearances, type Clearance } from '../lib/clearances';
import { roomWalls, tangent } from '../scene/apartment';
import { changeWall, constrainedDelta, translateSelection, ZERO, type Motion, type MoveResult, type MoveSelection } from '../scene/placementMove';
import type { PlacedLeaf, Translation } from '../scene/rigidPlacement';
import type { Update } from '../state/useSettings';
import type { StageView } from './Stage';
import './placement.css';

const reasons = {
  unavailable: 'has no measured geometry yet', fixed: 'is fixed to the ceiling', pinned: 'is held by incompatible mounts',
  outside: 'would leave the room', opening: 'would cover a door or window opening', wall: 'must stay on its wall', floor: 'must stay on the floor',
};

function nameOf({ tree, room }: MoveSelection, id: string) {
  return (isGroup(tree, id) ? tree.groups[id].name : ROOM_DEFS[room.id].components.find((c) => c.id === id)?.name) ?? id;
}

const why = (s: MoveSelection, r: { member: string; reason: keyof typeof reasons }) => `${nameOf(s, r.member)} ${reasons[r.reason]}.`;
const warning = (s: MoveSelection, r: Extract<MoveResult, { ok: true }>) =>
  r.overlaps.length ? ` Overlaps ${r.overlaps.map((id) => nameOf(s, id)).join(', ')}.` : '';

function commit(s: MoveSelection, result: MoveResult, update: Update): string {
  if (!result.ok) return `Not moved. ${why(s, result)}`;
  const components = Object.fromEntries([...result.transforms].map(([id, pose]) => [id, { pose }]));
  update({ rooms: { [s.room.id]: { components } } });
  return `Moved ${nameOf(s, s.node)}.${warning(s, result)}`;
}

function Guides({ stage, lines }: { stage: StageView; lines: readonly Clearance[] }) {
  const svg = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
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
  return <svg ref={svg} className="move-guides" aria-hidden="true">
    {lines.map((g) => <g key={g.label}><path /><text>{g.label} · {g.cm} cm</text></g>)}
  </svg>;
}

export function PlacementControls({ selection, motion, stage, update }: { selection: MoveSelection; motion: Motion; stage: StageView; update: Update }) {
  const { room, tree, node, poses } = selection;
  const { scene } = stage;
  const [status, say] = useState('');
  const [step, setStep] = useState('5');
  const [target, setTarget] = useState('');
  const [preview, setPreview] = useState<readonly PlacedLeaf[] | null>(null);

  useLayoutEffect(() => {
    if (motion.kind === 'blocked') return;
    const members = leavesOf(tree, node);
    scene.setPieceDrag(({ clientX, clientY }) => {
      const hit = scene.hit(clientX, clientY);
      if (!hit || hit.option.room !== room.id || hit.option.path.length !== 1 || !members.includes(hit.option.path[0])) return null;
      const origin = hit.point;
      const [dx, dz] = motion.kind === 'wall' ? tangent(motion.wall) : [0, 0];
      const normal = motion.kind === 'wall' && motion.lift ? { x: -dz, y: 0, z: dx } : { x: 0, y: 1, z: 0 };
      const moveAt = (x: number, y: number) => {
        const p = scene.intersect(x, y, origin, normal);
        return p && translateSelection(selection, constrainedDelta(motion, { x: p.x - origin.x, y: p.y - origin.y, z: p.z - origin.z }));
      };
      let isDragging = false;
      const release = () => {
        if (!isDragging) return;
        scene.preview(room.id, null);
        setPreview(null);
      };
      return {
        move(at) {
          isDragging = true;
          const result = moveAt(at.clientX, at.clientY);
          if (!result?.ok) {
            setPreview((last) => last ?? members.map((id) => poses.get(id)!));
            say(result ? `Cannot drop here. ${why(selection, result)}` : 'Cannot drop here. Choose a different camera view.');
            return;
          }
          scene.preview(room.id, result.transforms);
          setPreview([...result.leaves.values()]);
          say(`Release to place ${nameOf(selection, node)}.${warning(selection, result)}`);
        },
        drop(at) {
          const result = moveAt(at.clientX, at.clientY);
          release();
          say(result ? commit(selection, result, update) : 'Not moved. Choose a different camera view.');
        },
        cancel() {
          release();
          if (isDragging) say('Move cancelled.');
        },
      };
    });
    return () => scene.setPieceDrag(null);
  }, [scene, selection, motion, room.id, tree, node, poses, update]);

  const nearest = new Map<string, Clearance>();
  if (preview) for (const g of clearances(room, preview)) {
    if (!nearest.has(g.label) || nearest.get(g.label)!.cm > g.cm) nearest.set(g.label, g);
  }
  const lines = [...nearest.values()];
  const metres = Number(step) / 100;
  const nudge = (label: string, delta: Translation) => (
    <button className="chip" type="button" key={label} disabled={!(metres > 0 && Number.isFinite(metres))}
      onClick={() => say(commit(selection, translateSelection(selection, { x: delta.x * metres, y: delta.y * metres, z: delta.z * metres }), update))}>
      {label}
    </button>
  );
  if (motion.kind === 'blocked') return <p className="move-panel">{why(selection, motion)}</p>;
  return (
    <section className="move-panel">
      <h2>Fine adjustment</h2>
      <label className="move-step">Step (cm) <input type="number" min="0.1" step="any" value={step} onChange={(e) => setStep(e.target.value)} /></label>
      <div className="chips">
        {motion.kind === 'floor' && <>
          {nudge('−X', { ...ZERO, x: -1 })}{nudge('+X', { ...ZERO, x: 1 })}
          {nudge('−Z', { ...ZERO, z: -1 })}{nudge('+Z', { ...ZERO, z: 1 })}
        </>}
        {motion.kind === 'wall' && motion.slide && [-1, 1].map((sign) => {
          const [x, z] = tangent(motion.wall);
          return nudge(sign < 0 ? 'Along wall −' : 'Along wall +', { x: sign * x, y: 0, z: sign * z });
        })}
        {motion.kind === 'wall' && motion.lift && <>{nudge('Lower', { ...ZERO, y: -1 })}{nudge('Raise', { ...ZERO, y: 1 })}</>}
      </div>
      {motion.kind === 'wall' && motion.canRemount && <>
        <label className="sl">Mounting wall
          <select value={target || String(motion.wall.edge)} onChange={(e) => setTarget(e.target.value)}>
            {roomWalls(room).map((w) => <option key={w.edge} value={w.edge}>Wall {w.edge + 1}{w.edge === motion.wall.edge ? ' (current)' : ''}</option>)}
          </select>
        </label>
        <button className="chip" type="button" disabled={!target || Number(target) === motion.wall.edge} onClick={() => {
          const wall = roomWalls(room).find((w) => w.edge === Number(target));
          if (wall) say(commit(selection, changeWall(selection, wall), update));
          setTarget('');
        }}>Change wall</button>
      </>}
      {preview && <>
        <h2>Room clearances</h2>
        <dl className="move-measures">
          {lines.map((g) => <div key={g.label}><dt>{g.label}</dt><dd>{g.cm} cm</dd></div>)}
        </dl>
        {createPortal(<Guides stage={stage} lines={lines} />, stage.container)}
      </>}
      <p role="status" className="move-status">{status}</p>
    </section>
  );
}
