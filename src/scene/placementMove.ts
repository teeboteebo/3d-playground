import type { ComponentState, PiecePose } from '../data/components';
import type { Room, XZ } from '../data/rooms';
import { leavesOf, type RoomTree } from '../data/tree';
import { roomWalls, type Wall } from './apartment';
import { proposeRigidMove, type MoveProposal, type PlacedLeaf, type Translation } from './rigidPlacement';

export const ZERO = { x: 0, y: 0, z: 0 } as const;
const IDENTITY: PiecePose = { ...ZERO, yaw: 0 };
const EPS = 1e-8;
export const tangent = (wall: Wall): XZ => [(wall.b[0] - wall.a[0]) / wall.length, (wall.b[1] - wall.a[1]) / wall.length];
const rotate = (x: number, z: number, yaw: number): XZ =>
  [Math.cos(yaw) * x + Math.sin(yaw) * z, -Math.sin(yaw) * x + Math.cos(yaw) * z];

export interface MoveSelection {
  room: Room;
  tree: RoomTree;
  node: string;
  poses: ReadonlyMap<string, PlacedLeaf>;
  components: Readonly<Record<string, ComponentState>>;
}

export type Motion =
  | { kind: 'blocked'; member: string; reason: 'fixed' | 'unavailable' | 'pinned' }
  | { kind: 'floor' }
  | { kind: 'wall'; wall: Wall; slide: boolean; lift: boolean; canRemount: boolean };

export function motionFor({ room, tree, node, poses }: MoveSelection): Motion {
  const edges = new Set<number>();
  let floor = false;
  for (const member of leavesOf(tree, node)) {
    const leaf = poses.get(member);
    if (!leaf) return { kind: 'blocked', member, reason: 'unavailable' };
    if (leaf.mount.kind === 'fixed') return { kind: 'blocked', member, reason: 'fixed' };
    if (leaf.mount.kind !== 'wall') floor = true;
    if ('edge' in leaf.mount) edges.add(leaf.mount.edge);
  }
  if (!edges.size) return { kind: 'floor' };
  const walls = roomWalls(room).filter((w) => edges.has(w.edge));
  const wall = walls[0];
  if (!wall || edges.size !== walls.length) return { kind: 'blocked', member: node, reason: 'unavailable' };
  const [x, z] = tangent(wall);
  const slide = walls.every((w) => {
    const [dx, dz] = tangent(w);
    return Math.abs(dx * z - dz * x) < EPS;
  });
  if (!slide && floor) return { kind: 'blocked', member: node, reason: 'pinned' };
  return { kind: 'wall', wall, lift: !floor, slide, canRemount: edges.size === 1 };
}

export function constrainedDelta(motion: Exclude<Motion, { kind: 'blocked' }>, raw: Translation): Translation {
  if (motion.kind === 'floor') return { ...raw, y: 0 };
  const [dx, dz] = tangent(motion.wall);
  const distance = motion.slide ? raw.x * dx + raw.z * dz : 0;
  return { x: distance * dx, y: motion.lift ? raw.y : 0, z: distance * dz };
}

export type MoveResult = Extract<MoveProposal, { ok: false }> | {
  ok: true;
  leaves: ReadonlyMap<string, PlacedLeaf>;
  overlaps: readonly string[];
  transforms: ReadonlyMap<string, PiecePose>;
};

export function translateSelection(s: MoveSelection, delta: Translation): MoveResult {
  const result = proposeRigidMove(s.room, s.tree, s.node, s.poses, delta);
  if (!result.ok) return result;
  const transforms = new Map<string, PiecePose>();
  for (const id of result.leaves.keys()) {
    const p = s.components[id]?.pose ?? IDENTITY;
    transforms.set(id, { ...p, x: p.x + delta.x, y: p.y + delta.y, z: p.z + delta.z });
  }
  return { ...result, transforms };
}

/** Face the new wall as one rigid assembly. Prefer the same relative spot along it, then the nearest spot that fits. */
export function changeWall(s: MoveSelection, target: Wall): MoveResult {
  const motion = motionFor(s);
  if (motion.kind !== 'wall' || !motion.canRemount || target.room.id !== s.room.id || target.edge === motion.wall.edge)
    return { ok: false, member: s.node, reason: 'wall' };
  const old = motion.wall;
  const [ax, az] = tangent(old);
  const [bx, bz] = tangent(target);
  const yaw = Math.atan2(az, ax) - Math.atan2(bz, bx);
  const ids = leavesOf(s.tree, s.node);
  const along = ids.flatMap((id) => s.poses.get(id)!.footprint.map(([x, z]) => (x - old.a[0]) * ax + (z - old.a[1]) * az));
  const middle = (Math.min(...along) + Math.max(...along)) / 2;
  const to = middle / old.length * target.length;
  const [ox, oz] = rotate(old.a[0] + middle * ax, old.a[1] + middle * az, yaw);
  const tx = target.a[0] + to * bx - ox;
  const tz = target.a[1] + to * bz - oz;
  const rotated = new Map(s.poses);
  const transforms = new Map<string, PiecePose>();
  const offsets = new Set([0]);
  for (const id of ids) {
    const p = s.components[id]?.pose ?? IDENTITY;
    const [px, pz] = rotate(p.x, p.z, yaw);
    const leaf = s.poses.get(id)!;
    const attached = 'edge' in leaf.mount;
    transforms.set(id, { x: px + tx, z: pz + tz, y: p.y, yaw: p.yaw + yaw, ...(attached && { edge: target.edge }) });
    const footprint = leaf.footprint.map(([x, z]): XZ => {
      const [rx, rz] = rotate(x, z, yaw);
      return [rx + tx, rz + tz];
    });
    const mount = 'edge' in leaf.mount ? { ...leaf.mount, edge: target.edge } : leaf.mount;
    rotated.set(id, { ...leaf, footprint, mount });
    // Legal intervals along the target wall only change when a vertex meets a room edge or an opening's end.
    for (const [x, z] of footprint) {
      s.room.poly.forEach(([x0, z0], i, poly) => {
        const [x1, z1] = poly[(i + 1) % poly.length];
        const dx = x1 - x0, dz = z1 - z0, slope = dx * bz - dz * bx;
        if (Math.abs(slope) > EPS) offsets.add((dz * (x - x0) - dx * (z - z0)) / slope);
      });
      if (!attached) continue;
      const u = (x - target.a[0]) * bx + (z - target.a[1]) * bz;
      for (const { u0, u1, opening } of target.holes) {
        if (leaf.top <= opening.y0 || leaf.bottom >= opening.y1) continue;
        const radius = (u1 - u0) / 2;
        const height = Math.max(0, leaf.bottom - (opening.y1 - radius));
        const half = opening.arch ? Math.sqrt(Math.max(0, radius ** 2 - height ** 2)) : radius;
        offsets.add(u0 + radius - half - u);
        offsets.add(u0 + radius + half - u);
      }
    }
  }
  let failure: Extract<MoveResult, { ok: false }> = { ok: false, member: s.node, reason: 'outside' };
  for (const offset of [...offsets].sort((a, b) => Math.abs(a) - Math.abs(b))) {
    const delta = { x: bx * offset, y: 0, z: bz * offset };
    const result = proposeRigidMove(s.room, s.tree, s.node, rotated, delta);
    if (!result.ok) { failure = result; continue; }
    for (const [id, p] of transforms) transforms.set(id, { ...p, x: p.x + delta.x, z: p.z + delta.z });
    return { ...result, transforms };
  }
  return failure;
}
