import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ComponentState } from '../data/components';
import { ROOM_DEFS } from '../data/roomDefs';
import { CEILING, OPENING_NAMES, centroid, extent, type Room, type XZ } from '../data/rooms';
import { ancestorsOf, childrenOf, isGroup, leavesOf, parentOf, resolvePick, type Parent, type RoomTree } from '../data/tree';
import { footprintCm, leafClearances } from '../lib/clearances';
import { elevationGuides, elevationOutline, projectOnWall, type PlanGuide } from '../lib/wallElevation';
import { roomWalls } from '../scene/apartment';
import type { PlacedLeaf } from '../scene/rigidPlacement';
import { OverheadRoom, WallFace, WallLocator } from './PlanSurfaces';
import './RoomPlan.css';

interface Props {
  room: Room;
  tree: RoomTree;
  poses: ReadonlyMap<string, PlacedLeaf>;
  components: Readonly<Record<string, ComponentState>>;
  onClose: () => void;
  initialSelection?: string;
  mapHost?: HTMLElement;
  wallEdge?: number | null;
}

type Status = 'placed' | 'hidden' | 'unplaced' | 'unknown';

const fmt = (n: number) => String(Math.round(n * 10) / 10);

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

export function RoomPlan({ room, tree, poses, components, onClose, initialSelection, mapHost, wallEdge }: Props) {
  const names = useMemo(() => new Map(ROOM_DEFS[room.id].components.map((c) => [c.id as string, c.name])), [room.id]);
  const valid = initialSelection !== undefined && parentOf(tree, initialSelection) !== undefined;
  const [rawEntered, setEntered] = useState<Parent>(() => (valid ? parentOf(tree, initialSelection) ?? null : null));
  const [rawSelected, setSelected] = useState<string | null>(valid ? initialSelection : null);
  const [hot, setHot] = useState<string | null>(null);
  const entered: Parent = rawEntered !== null && isGroup(tree, rawEntered) ? rawEntered : null;
  const selected = rawSelected !== null && parentOf(tree, rawSelected) !== undefined ? rawSelected : null;
  const hotLeaves = hot !== null && parentOf(tree, hot) !== undefined ? leavesOf(tree, hot) : [];
  const [inspect, setInspect] = useState(valid);
  const walls = useMemo(() => roomWalls(room), [room]);
  const wall = walls.find((w) => w.edge === wallEdge);

  const select = (id: string | null) => { setSelected(id); setInspect(false); };
  const leave = () => {
    if (entered === null) onClose();
    else {
      setEntered(parentOf(tree, entered) ?? null);
      select(entered);
    }
  };
  const escape = useRef(leave);
  useEffect(() => { escape.current = leave; });
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
  const projections = useMemo(() => new Map(wall ? placedIds.flatMap((id) => {
    const p = projectOnWall(wall, poses.get(id)!);
    return p ? [[id, p] as const] : [];
  }) : []), [wall, placedIds, poses]);
  const outlines = useMemo(() => new Map(wall
    ? [...projections].sort(([, a], [, b]) => a.setback - b.setback).map(([id, p]) => [id, elevationOutline(p)] as const)
    : [...placedIds].sort((a, b) => {
      const pa = poses.get(a)!;
      const pb = poses.get(b)!;
      return Number(pa.obstructs) - Number(pb.obstructs) || pa.top - pb.top || pa.bottom - pb.bottom;
    }).map((id) => [id, poses.get(id)!.footprint] as const)), [wall, projections, placedIds, poses]);

  const selectedLeaves = useMemo(() => selected ? leavesOf(tree, selected) : [], [selected, tree]);
  const gaps = useMemo(() => {
    if (wall) return [];
    const own = new Set(selectedLeaves.map((id) => placedIds.indexOf(id)).filter((i) => i >= 0));
    return leafClearances(room, placed, own);
  }, [wall, room, placed, placedIds, selectedLeaves]);

  const { minX, maxX, minZ, maxZ } = wall ? { minX: 0, maxX: wall.length, minZ: 0, maxZ: CEILING } : extent(room.poly);
  const span = Math.max(maxX - minX, maxZ - minZ);
  const pad = span * 0.12;
  const box = [minX - pad, minZ - pad, maxX - minX + 2 * pad, maxZ - minZ + 2 * pad];
  const font = span / 34;
  const guides: PlanGuide[] = wall ? elevationGuides(wall, selectedLeaves.flatMap((id) => projections.get(id) ?? []))
    : gaps.filter((g) => g.from.x !== g.to.x || g.from.z !== g.to.z).map((g) => ({
      from: [g.from.x, g.from.z], to: [g.to.x, g.to.z], cm: g.cm,
    }));
  const badges: { id: string; at: XZ; anchor: XZ }[] = [];
  for (const [id, fp] of [...outlines].reverse()) {
    const center = centroid(fp);
    const free = ([x, z]: XZ) => badges.every(({ at }) => Math.hypot(x - at[0], z - at[1]) >= font * 1.6)
      && guides.every((g) => Math.abs(x - (g.from[0] + g.to[0]) / 2) > font * (fmt(g.cm).length * 0.32 + 0.8)
        || Math.abs(z - (g.from[1] + g.to[1]) / 2 + font * 0.3) > font * 1.3);
    const candidates = [center, ...fp.map(([x, z]): XZ => [0.8 * x + 0.2 * center[0], 0.8 * z + 0.2 * center[1]])];
    let at = candidates.find((q) => free(q) && badges.every((b) => !insideConvex(outlines.get(b.id)!, q))) ?? candidates.find(free);
    for (let radius = 1; !at; radius++) {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const q: XZ = [center[0] + Math.cos(angle) * radius * font * 1.7, center[1] + Math.sin(angle) * radius * font * 1.7];
        if (free(q)) { at = q; break; }
      }
    }
    badges.push({ id, at, anchor: insideConvex(fp, at) ? at : center });
  }
  const kinds = [...new Set((wall ? [wall] : walls).flatMap((w) => w.holes.map((h) => h.opening.kind)))];
  const hasOpenEdge = !wall && (room.open ?? []).length > 0;

  const pick = (leaf: string) => {
    let node = resolvePick(tree, leaf, entered);
    if (node === null) {
      setEntered(null);
      node = resolvePick(tree, leaf, null);
    }
    if (node) select(node);
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
  const wallPosition = (id: string) => {
    if (!wall || statusOf(id) !== 'placed') return null;
    const p = projections.get(id);
    if (p) return `${fmt(p.setback * 100)} cm from wall · ${fmt((CEILING - p.bottom) * 100)} cm above floor`;
    const { mount } = poses.get(id)!;
    return 'edge' in mount ? `Mounted on Wall ${mount.edge + 1}` : 'Outside this wall’s width';
  };

  const map = (
      <div className="room-plan__map">
        <svg className={`room-plan__svg${wall ? ' room-plan__svg--wall' : ''}`} viewBox={box.join(' ')} role="img" aria-label={wall ? `${room.name} facing Wall ${wall.edge + 1}` : `Overhead plan of ${room.name}`}>
          {wall ? <WallFace wall={wall} font={font} /> : <OverheadRoom room={room} walls={walls} font={font} />}
          {[...outlines].map(([id, outline]) => {
            const sel = selectedLeaves.includes(id);
            const cls = `room-plan__piece${inScope(id) ? ' room-plan__piece--scope' : ''}${sel ? ' room-plan__piece--sel' : ''}${hotLeaves.includes(id) ? ' room-plan__piece--hot' : ''}`;
            return (
              <polygon
                key={id}
                className={cls}
                points={points(outline)}
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
          {guides.map((g, i) => (
            <g key={i} pointerEvents="none">
              <line className="room-plan__guide" x1={g.from[0]} y1={g.from[1]} x2={g.to[0]} y2={g.to[1]} />
              <text
                className="room-plan__text"
                style={{ strokeWidth: font * 0.25 }}
                fontSize={font}
                textAnchor="middle"
                x={(g.from[0] + g.to[0]) / 2}
                y={(g.from[1] + g.to[1]) / 2}
              >
                {fmt(g.cm)}
              </text>
            </g>
          ))}
          {badges.map(({ id, at: [x, z], anchor }) => (
            <g key={id} className="room-plan__badge" aria-hidden="true" onClick={() => pick(id)}>
              {(x !== anchor[0] || z !== anchor[1]) && <line x1={x} y1={z} x2={anchor[0]} y2={anchor[1]} />}
              <circle cx={x} cy={z} r={font * 0.7} />
              <text fontSize={font * 0.85} textAnchor="middle" dominantBaseline="central" x={x} y={z}>{numbers.get(id)}</text>
              <title>{nameOf(id)}</title>
            </g>
          ))}
          <g aria-hidden="true">
            <line className="room-plan__scale" x1={box[0] + pad * 0.5} y1={box[1] + box[3] - pad * 0.45} x2={box[0] + pad * 0.5 + 1} y2={box[1] + box[3] - pad * 0.45} />
            <text className="room-plan__text" style={{ strokeWidth: font * 0.25 }} fontSize={font * 0.8} x={box[0] + pad * 0.5 + 1.1} y={box[1] + box[3] - pad * 0.45 + font * 0.28}>1 m</text>
          </g>
        </svg>
        <p className="room-plan__axes">{wall ? `Facing Wall ${wall.edge + 1} from inside · ceiling ${CEILING * 100} cm · gaps in cm` : 'Top view · +X → right · +Z ↓ down · gaps in cm'}</p>
      </div>
  );
  return (
    <section className="room-plan" aria-label={`${room.name} plan`}>
      {mapHost ? createPortal(map, mapHost) : map}
      <aside className="room-plan__side">
        <h2>{room.name} plan</h2>
        {wall ? <div className="room-plan__orientation">
          <WallLocator wall={wall} footprints={placedIds.filter((id) => selectedLeaves.includes(id)).map((id) => poses.get(id)!.footprint)} />
          <p className="room-plan__note">Facing Wall {wall.edge + 1} from inside. Boxes show piece width and height. Pieces mounted on other walls are not drawn.</p>
        </div> : <p className="room-plan__note">Top view, read-only. Select a piece to see its distances to the walls.</p>}
        <h3>{entered ? nameOf(entered) : 'In the room'}</h3>
        {entered && (
          <div className="room-plan__row">
            <button type="button" onClick={leave}>
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
                  {wall && <span className="room-plan__sub">{group ? `${pieces.filter((p) => projections.has(p)).length} in this view` : wallPosition(id)}</span>}
                </button>
                {group && <button type="button" aria-label={`Enter ${nameOf(id)}`} onClick={() => { setEntered(id); select(null); }}>Enter</button>}
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
                  const projection = projections.get(id);
                  const mine = wall ? elevationGuides(wall, projection ? [projection] : []) : gaps.filter((g) => g.leafIndex === index);
                  return (
                    <li key={id}>
                      <strong><span className="room-plan__num">{numbers.get(id)}</span> {nameOf(id)}</strong>
                      <span className="room-plan__sub">{describe(id) ?? statusText[statusOf(id)]}</span>
                      {wall && <span className="room-plan__sub">{wallPosition(id)}</span>}
                      {mine.map((g, i) => <span key={i} className="room-plan__sub">{g.label}: {fmt(g.cm)} cm</span>)}
                      {!wall && index >= 0 && mine.length === 0 && <span className="room-plan__sub">Touching the walls, or other pieces are in the way</span>}
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
              {kinds.map((k) => <li key={k}><KeyLine cls={`room-plan__open room-plan__open--${k}`} />{OPENING_NAMES[k]}</li>)}
              {hasOpenEdge && <li><KeyLine cls="room-plan__wall room-plan__wall--open" />Open edge, no wall</li>}
              <li><KeyLine cls="room-plan__wall" />Wall — numbered like the wall mounts</li>
            </ul>
          </>
        )}
      </aside>
    </section>
  );
}
