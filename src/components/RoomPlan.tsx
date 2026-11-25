import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentState } from '../data/components';
import { ROOM_DEFS } from '../data/roomDefs';
import type { Room, XZ } from '../data/rooms';
import { ancestorsOf, childrenOf, isGroup, leavesOf, parentOf, resolvePick, type Parent, type RoomTree } from '../data/tree';
import { footprintCm, leafClearances } from '../lib/clearances';
import type { Opening } from '../data/rooms';
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
const OPENING_NAME = { door: 'Door', window: 'Window', passage: 'Doorway' } as const;

function insideConvex(fp: readonly XZ[], [x, z]: XZ): boolean {
  let sign = 0;
  for (let i = 0; i < fp.length; i++) {
    const [ax, az] = fp[i];
    const [bx, bz] = fp[(i + 1) % fp.length];
    const c = (bx - ax) * (z - az) - (bz - az) * (x - ax);
    if (Math.abs(c) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

const points = (fp: readonly XZ[]) => fp.map(([x, z]) => `${x},${z}`).join(' ');

function KeyLine({ cls }: { cls: string }) {
  return <svg className="room-plan__swatch" width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><line className={cls} x1="2" y1="5" x2="28" y2="5" /></svg>;
}

/** Overhead, read-only plan of one room: where each piece stands, with the gaps that a drag in 3D is measured against. */
export function RoomPlan({ room, tree, poses, components, onClose, initialSelection }: Props) {
  const names = useMemo(() => new Map(ROOM_DEFS[room.id].components.map((c) => [c.id as string, c.name])), [room.id]);
  const valid = initialSelection !== undefined && parentOf(tree, initialSelection) !== undefined;
  const [rawEntered, setEntered] = useState<Parent>(() => (valid ? parentOf(tree, initialSelection) ?? null : null));
  const [rawSelected, setSelected] = useState<string | null>(valid ? initialSelection : null);
  const [hot, setHot] = useState<string | null>(null);
  // an undo or regroup can remove what the plan had open; fall back rather than point at a node that is gone
  const entered: Parent = rawEntered !== null && isGroup(tree, rawEntered) ? rawEntered : null;
  const selected = rawSelected !== null && parentOf(tree, rawSelected) !== undefined ? rawSelected : null;
  const hotLeaves = hot !== null && parentOf(tree, hot) !== undefined ? leavesOf(tree, hot) : [];
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

  const numbers = useMemo(() => {
    const all = tree.root.flatMap((id) => leavesOf(tree, id));
    return new Map(all.map((id, i) => [id, i + 1]));
  }, [tree]);
  const numbersOf = (id: string) => leavesOf(tree, id).map((l) => numbers.get(l)).filter((n) => n !== undefined);
  const range = (id: string) => {
    const n = numbersOf(id);
    return n.length === 0 ? '' : n.length === 1 ? `${n[0]}` : `${n[0]}–${n[n.length - 1]}`;
  };
  // rugs lie beneath, then pieces from low to high, so the highest shape is the one a click lands on
  const drawOrder = useMemo(
    () => [...placedIds].sort((a, b) => {
      const pa = poses.get(a)!;
      const pb = poses.get(b)!;
      return Number(pa.obstructs) - Number(pb.obstructs) || pa.top - pb.top || pa.bottom - pb.bottom;
    }),
    [placedIds, poses],
  );
  const badgeAt = (id: string): XZ => {
    const fp = poses.get(id)!.footprint;
    const c: XZ = [fp.reduce((s, p) => s + p[0], 0) / fp.length, fp.reduce((s, p) => s + p[1], 0) / fp.length];
    const covered = (q: XZ) => placedIds.some((o) => o !== id && poses.get(o)!.obstructs && insideConvex(poses.get(o)!.footprint, q));
    if (!covered(c)) return c;
    const pulled = fp.map(([x, z]): XZ => [x + (c[0] - x) * 0.2, z + (c[1] - z) * 0.2]);
    return pulled.find((q) => !covered(q)) ?? c;
  };

  const selectedLeaves = selected ? leavesOf(tree, selected) : [];
  const gaps = useMemo(() => {
    const own = new Set(selectedLeaves.map((id) => placedIds.indexOf(id)).filter((i) => i >= 0));
    return leafClearances(room, placed, own);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, placed, placedIds, selected, tree]);

  const xs = room.poly.map((p) => p[0]);
  const zs = room.poly.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const pad = span * 0.12;
  const box = [Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...zs) - Math.min(...zs) + 2 * pad];
  const font = span / 34;
  const walls = useMemo(() => roomWalls(room), [room]);
  const openings = useMemo(() => walls.flatMap((w) => w.holes.map(({ opening, u0, u1 }) => {
    const dx = (w.b[0] - w.a[0]) / w.length;
    const dz = (w.b[1] - w.a[1]) / w.length;
    return { kind: opening.kind, x1: w.a[0] + dx * u0, z1: w.a[1] + dz * u0, x2: w.a[0] + dx * u1, z2: w.a[1] + dz * u1 };
  })), [walls]);
  const kinds = [...new Set(openings.map((o) => o.kind))];
  const hasOpenEdge = (room.open ?? []).length > 0;
  const edges = useMemo(() => {
    const cx = xs.reduce((s, x) => s + x, 0) / xs.length;
    const cz = zs.reduce((s, z) => s + z, 0) / zs.length;
    return room.poly.map(([ax, az], i) => {
      const [bx, bz] = room.poly[(i + 1) % room.poly.length];
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const len = Math.hypot(mx - cx, mz - cz) || 1;
      return { i, ax, az, bx, bz, mx, mz, nx: (mx - cx) / len, nz: (mz - cz) / len, open: room.open?.includes(i) ?? false };
    });
  }, [room, xs, zs]);

  const pick = (leaf: string) => {
    // like the 3D editor: a piece outside the open group leaves it and selects from the room
    let node = resolvePick(tree, leaf, entered);
    if (node === null) {
      setEntered(null);
      node = resolvePick(tree, leaf, null);
    }
    if (node) { setSelected(node); setInspect(false); }
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
          {edges.map((e) => (
            <g key={e.i}>
              <line className={`room-plan__wall${e.open ? ' room-plan__wall--open' : ''}`} x1={e.ax} y1={e.az} x2={e.bx} y2={e.bz} />
              <text
                className="room-plan__text room-plan__text--wall"
                style={{ strokeWidth: font * 0.25 }}
                fontSize={font * 0.8}
                textAnchor="middle"
                dominantBaseline="middle"
                x={e.mx + e.nx * font * 1.4}
                y={e.mz + e.nz * font * 1.4}
              >
                {e.open ? `Wall ${e.i + 1} · open` : `Wall ${e.i + 1}`}
              </text>
            </g>
          ))}
          {openings.map((o, i) => (
            <line key={i} className={`room-plan__open room-plan__open--${o.kind}`} x1={o.x1} y1={o.z1} x2={o.x2} y2={o.z2} />
          ))}
          {drawOrder.map((id) => {
            const sel = selectedLeaves.includes(id);
            const cls = `room-plan__piece${inScope(id) ? ' room-plan__piece--scope' : ''}${sel ? ' room-plan__piece--sel' : ''}${hotLeaves.includes(id) ? ' room-plan__piece--hot' : ''}`;
            return (
              <polygon
                key={id}
                className={cls}
                points={points(poses.get(id)!.footprint)}
                role="button"
                tabIndex={0}
                aria-pressed={sel}
                aria-label={`${numbers.get(id)}. ${nameOf(id)}`}
                onClick={() => pick(id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } }}
              >
                <title>{`${numbers.get(id)}. ${nameOf(id)}`}</title>
              </polygon>
            );
          })}
          {drawOrder.map((id) => {
            const [x, z] = badgeAt(id);
            return (
              <g key={id} className="room-plan__badge" pointerEvents="none">
                <circle cx={x} cy={z} r={font * 0.7} />
                <text fontSize={font * 0.85} textAnchor="middle" dominantBaseline="central" x={x} y={z}>{numbers.get(id)}</text>
              </g>
            );
          })}
          {gaps.filter((g) => g.from.x !== g.to.x || g.from.z !== g.to.z).map((g, i) => (
            <g key={i}>
              <line className="room-plan__guide" x1={g.from.x} y1={g.from.z} x2={g.to.x} y2={g.to.z} />
              <text
                className="room-plan__text"
                style={{ strokeWidth: font * 0.25 }}
                fontSize={font}
                textAnchor="middle"
                x={(g.from.x + g.to.x) / 2}
                y={(g.from.z + g.to.z) / 2}
              >
                {fmt(g.cm)}
              </text>
            </g>
          ))}
          <g aria-hidden="true">
            <line className="room-plan__scale" x1={box[0] + pad * 0.5} y1={box[1] + box[3] - pad * 0.45} x2={box[0] + pad * 0.5 + 1} y2={box[1] + box[3] - pad * 0.45} />
            <text className="room-plan__text" style={{ strokeWidth: font * 0.25 }} fontSize={font * 0.8} x={box[0] + pad * 0.5 + 1.1} y={box[1] + box[3] - pad * 0.45 + font * 0.28}>1 m</text>
          </g>
        </svg>
        <p className="room-plan__axes">Top view · +X → right · +Z ↓ down · gaps in cm</p>
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
                <button
                  type="button"
                  aria-pressed={selected === id}
                  onClick={() => select(id)}
                  onMouseEnter={() => setHot(id)}
                  onMouseLeave={() => setHot(null)}
                  onFocus={() => setHot(id)}
                  onBlur={() => setHot(null)}
                >
                  <span className="room-plan__num">{range(id)}</span> {nameOf(id)}
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
                      <strong><span className="room-plan__num">{numbers.get(id)}</span> {nameOf(id)}</strong>
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
        {(kinds.length > 0 || hasOpenEdge) && (
          <>
            <h3>Map key</h3>
            <ul className="room-plan__key">
              {kinds.map((k) => <li key={k}><KeyLine cls={`room-plan__open room-plan__open--${k}`} />{OPENING_NAME[k as Opening['kind']]}</li>)}
              {hasOpenEdge && <li><KeyLine cls="room-plan__wall room-plan__wall--open" />Open edge, no wall</li>}
              <li><KeyLine cls="room-plan__wall" />Wall — numbered like the wall mounts</li>
            </ul>
          </>
        )}
      </aside>
    </section>
  );
}
