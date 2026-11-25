import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentState } from '../data/components';
import { ROOM_DEFS } from '../data/roomDefs';
import type { Room, XZ } from '../data/rooms';
import { ancestorsOf, childrenOf, isGroup, leavesOf, parentOf, resolvePick, type Parent, type RoomTree } from '../data/tree';
import { footprintCm, leafClearances } from '../lib/clearances';
import { roomWalls } from '../scene/apartment';
import type { PlacedLeaf } from '../scene/rigidPlacement';
import './RoomPlan.css';

interface Props {
  room: Room;
  tree: RoomTree;
  poses: ReadonlyMap<string, PlacedLeaf>;
  components: Readonly<Record<string, ComponentState>>;
  onClose: () => void;
  initialSelection?: string;
}

type Status = 'placed' | 'hidden' | 'unplaced' | 'unknown';

const fmt = (n: number) => `${Math.round(n * 10) / 10}`.replace('.0', '');
const points = (fp: readonly XZ[]) => fp.map(([x, z]) => `${x},${z}`).join(' ');

/** Overhead, read-only plan of one room: where each piece stands, with the gaps that a drag in 3D is measured against. */
export function RoomPlan({ room, tree, poses, components, onClose, initialSelection }: Props) {
  const names = useMemo(() => new Map(ROOM_DEFS[room.id].components.map((c) => [c.id as string, c.name])), [room.id]);
  const valid = initialSelection !== undefined && parentOf(tree, initialSelection) !== undefined;
  const [entered, setEntered] = useState<Parent>(() => {
    const p = valid ? parentOf(tree, initialSelection) : null;
    return p ?? null;
  });
  const [selected, setSelected] = useState<string | null>(valid ? initialSelection : null);
  const [inspect, setInspect] = useState(valid);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);

  const escape = useRef(() => {});
  useEffect(() => {
    escape.current = () => {
      if (entered === null) return onClose();
      setEntered(parentOf(tree, entered) ?? null);
      setSelected(entered);
      setInspect(false);
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      escape.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const nameOf = (id: string) => (isGroup(tree, id) ? tree.groups[id].name : names.get(id) ?? id);
  const statusOf = (id: string): Status => {
    const state = components[id];
    if (!state) return 'unknown';
    if (!state.shown) return 'hidden';
    return poses.has(id) ? 'placed' : 'unplaced';
  };
  const placedIds = useMemo(
    () => tree.root.flatMap((id) => leavesOf(tree, id)).filter((id) => components[id]?.shown && poses.has(id)),
    [tree, components, poses],
  );
  const placed = useMemo(() => placedIds.map((id) => poses.get(id)!), [placedIds, poses]);

  const selectedLeaves = selected ? leavesOf(tree, selected) : [];
  const gaps = useMemo(() => {
    const own = new Set(selectedLeaves.map((id) => placedIds.indexOf(id)).filter((i) => i >= 0));
    return leafClearances(room, placed, own);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, placed, placedIds, selected, tree]);

  const xs = room.poly.map((p) => p[0]);
  const zs = room.poly.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const pad = span * 0.06;
  const box = [Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...zs) - Math.min(...zs) + 2 * pad];
  const font = span / 38;
  const openings = useMemo(() => roomWalls(room).flatMap((w) => w.holes.map(({ u0, u1 }) => {
    const dx = (w.b[0] - w.a[0]) / w.length;
    const dz = (w.b[1] - w.a[1]) / w.length;
    return { x1: w.a[0] + dx * u0, z1: w.a[1] + dz * u0, x2: w.a[0] + dx * u1, z2: w.a[1] + dz * u1 };
  })), [room]);

  const pick = (leaf: string) => {
    const node = resolvePick(tree, leaf, entered) ?? resolvePick(tree, leaf, null);
    if (node) setSelected(node);
  };
  const inScope = (leaf: string) => resolvePick(tree, leaf, entered) !== null;
  const describe = (id: string) => {
    const p = poses.get(id);
    if (!p || statusOf(id) !== 'placed') return null;
    const [w, d] = footprintCm(p.footprint);
    return `${fmt(w)} × ${fmt(d)} × ${fmt((p.top - p.bottom) * 100)} cm`;
  };
  const statusText: Record<Status, string> = {
    placed: '',
    hidden: 'Hidden — not drawn',
    unplaced: 'Position not ready yet',
    unknown: 'Unknown piece',
  };
  const crumbs = entered ? [...ancestorsOf(tree, entered), entered] : [];
  const select = (id: string) => { setSelected(id); setInspect(false); };

  return (
    <section
      className="room-plan"
      role="dialog"
      aria-label={`${room.name} plan`}
    >
      <div className="room-plan__map">
        <svg className="room-plan__svg" viewBox={box.join(' ')} role="img" aria-label={`Overhead plan of ${room.name}`}>
          <polygon className="room-plan__room" points={points(room.poly)} />
          {openings.map((o, i) => <line key={i} className="room-plan__open" x1={o.x1} y1={o.z1} x2={o.x2} y2={o.z2} />)}
          {placedIds.map((id) => {
            const sel = selectedLeaves.includes(id);
            const cls = `room-plan__piece${inScope(id) ? ' room-plan__piece--scope' : ''}${sel ? ' room-plan__piece--sel' : ''}`;
            return (
              <polygon
                key={id}
                className={cls}
                points={points(poses.get(id)!.footprint)}
                role="button"
                tabIndex={0}
                aria-pressed={sel}
                aria-label={nameOf(id)}
                onClick={() => pick(id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } }}
              />
            );
          })}
          {gaps.filter((g) => g.from.x !== g.to.x || g.from.z !== g.to.z).map((g, i) => (
            <g key={i}>
              <line className="room-plan__guide" x1={g.from.x} y1={g.from.z} x2={g.to.x} y2={g.to.z} />
              <text className="room-plan__text" fontSize={font} textAnchor="middle" x={(g.from.x + g.to.x) / 2} y={(g.from.z + g.to.z) / 2}>{fmt(g.cm)}</text>
            </g>
          ))}
        </svg>
      </div>
      <aside className="room-plan__side">
        <button ref={back} type="button" onClick={onClose}>Back to 3D</button>
        <h2>{room.name} plan</h2>
        <p className="room-plan__note">Top view, read-only. Select a piece to see its distances to the walls.</p>
        <h3>{entered ? nameOf(entered) : 'In the room'}</h3>
        {entered && (
          <div className="room-plan__row">
            <button type="button" onClick={() => { setEntered(parentOf(tree, entered) ?? null); setSelected(entered); setInspect(false); }}>
              Up to {crumbs.length > 1 ? nameOf(crumbs[crumbs.length - 2]) : 'room'}
            </button>
          </div>
        )}
        <ul>
          {childrenOf(tree, entered).map((id) => {
            const group = isGroup(tree, id);
            const pieces = leavesOf(tree, id);
            return (
              <li key={id} className="room-plan__row">
                <button type="button" aria-pressed={selected === id} onClick={() => select(id)}>
                  {nameOf(id)}
                  <span className="room-plan__sub">
                    {group ? `${pieces.length} piece${pieces.length === 1 ? '' : 's'}` : describe(id) ?? statusText[statusOf(id)]}
                  </span>
                </button>
                {group && <button type="button" onClick={() => { setEntered(id); setSelected(null); setInspect(false); }}>Enter</button>}
              </li>
            );
          })}
        </ul>
        {selected && (
          <>
            <h3>{nameOf(selected)}</h3>
            <div className="room-plan__row">
              <button type="button" aria-pressed={inspect} onClick={() => setInspect(!inspect)}>
                {inspect ? 'Hide details' : isGroup(tree, selected) ? 'Inspect members' : 'Inspect'}
              </button>
            </div>
            {inspect && (
              <ul>
                {selectedLeaves.map((id) => {
                  const index = placedIds.indexOf(id);
                  const mine = gaps.filter((g) => index >= 0 && placed[index] && g.leaf === index);
                  return (
                    <li key={id}>
                      <strong>{nameOf(id)}</strong>
                      <span className="room-plan__sub">{describe(id) ?? statusText[statusOf(id)]}</span>
                      {mine.map((g, i) => <span key={i} className="room-plan__sub">{g.label}: {fmt(g.cm)} cm</span>)}
                      {index >= 0 && mine.length === 0 && <span className="room-plan__sub">Touching the walls, or other pieces are in the way</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </aside>
    </section>
  );
}
