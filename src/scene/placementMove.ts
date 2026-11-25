import type { ComponentState, PiecePose, PieceSupport } from '../data/components';
import type { Room, XZ } from '../data/rooms';
import { leavesOf, type RoomTree } from '../data/tree';
import { roomWalls, tangent, type Wall } from './apartment';
import { proposeRigidMove, type MoveProposal, type PlacedLeaf, type Translation } from './rigidPlacement';
import type { PlacementSurface } from './placementSurface';

export const ZERO = { x: 0, y: 0, z: 0 } as const;
const IDENTITY: PiecePose = { ...ZERO, yaw: 0 };
const EPS = 1e-8;
const CONTACT_SNAP_M = 0.05;
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

function reposition(leaf: PlacedLeaf, pose: PiecePose, yaw: number, delta: Translation, support?: PieceSupport) {
  const moved = (x: number, z: number): XZ => {
    const [rx, rz] = rotate(x, z, yaw);
    return [rx + delta.x, rz + delta.z];
  };
  const [x, z] = moved(pose.x, pose.z);
  const mount = support && 'edge' in support && 'edge' in leaf.mount ? { ...leaf.mount, ...support } : support ?? leaf.mount;
  return {
    leaf: { ...leaf, mount, footprint: leaf.footprint.map(([x, z]) => moved(x, z)), bottom: leaf.bottom + delta.y, top: leaf.top + delta.y },
    pose: { ...pose, x, z, y: pose.y + delta.y, yaw: pose.yaw + yaw, ...(support && { support }) },
  };
}

type Intersect = (point: Translation, normal: Translation) => Translation | null;

function wallGap(wall: Wall, footprint: readonly XZ[], delta: Translation = ZERO) {
  const [ux, uz] = tangent(wall);
  return Math.min(...footprint.map(([x, z]) => (z - wall.a[1]) * ux - (x - wall.a[0]) * uz)) + ux * delta.z - uz * delta.x;
}

function fitFloorDrag(room: Room, footprint: readonly XZ[], delta: Translation): Translation {
  const bounds = roomWalls(room).map((wall) => {
    const [ux, uz] = tangent(wall);
    return { nx: -uz, nz: ux, gap: wallGap(wall, footprint, delta) };
  });
  if (bounds.every(({ gap }) => gap > CONTACT_SNAP_M)) return delta;

  // In translation space the nearest legal contact is on a wall line or at the intersection of two.
  let best = Infinity;
  let fitted = delta;
  const consider = (x: number, z: number) => {
    const d = x * x + z * z;
    if (d >= best || bounds.some(({ nx, nz, gap }) => gap + nx * x + nz * z < -EPS)) return;
    best = d;
    fitted = { ...delta, x: delta.x + x, z: delta.z + z };
  };
  bounds.forEach(({ nx, nz, gap }, i) => {
    if (gap <= CONTACT_SNAP_M) consider(-gap * nx, -gap * nz);
    for (const b of bounds.slice(i + 1)) {
      if (gap > CONTACT_SNAP_M && b.gap > CONTACT_SNAP_M) continue;
      const det = nx * b.nz - nz * b.nx;
      if (Math.abs(det) > EPS) consider((nz * b.gap - gap * b.nz) / det, (gap * b.nx - nx * b.gap) / det);
    }
  });
  return fitted;
}

export function dragToSurface(s: MoveSelection, motion: Motion, target: PlacementSurface, grab: Translation, intersect: Intersect): MoveResult | null {
  if (motion.kind === 'blocked' && motion.reason !== 'pinned') return { ok: false, member: motion.member, reason: motion.reason };
  const ids = leavesOf(s.tree, s.node);
  const leaves = ids.map((id) => s.poses.get(id)!);
  const footprint = leaves.flatMap((leaf) => leaf.footprint);
  const bottom = Math.min(...leaves.map((leaf) => leaf.bottom));
  const floorY = motion.kind === 'floor' ? 0 : -bottom;
  const onFloor = (delta: Translation) => {
    const fitted = fitFloorDrag(s.room, footprint, { ...delta, y: floorY });
    return motion.kind === 'floor' ? translateSelection(s, fitted) : remount(s, ids, 0, fitted, { kind: 'floor' });
  };
  const floorPoint = intersect({ ...grab, y: grab.y + floorY }, { ...ZERO, y: 1 });
  const floorDelta = floorPoint && { x: floorPoint.x - grab.x, y: floorY, z: floorPoint.z - grab.z };
  let wall: Wall;
  if (target.kind === 'wall') wall = target.wall;
  else {
    if (!floorDelta) return null;
    if (motion.kind !== 'wall' || !motion.canRemount) return onFloor(floorDelta);
    wall = motion.wall;
    if (wallGap(wall, footprint, floorDelta) > CONTACT_SNAP_M) return onFloor(floorDelta);
  }

  const [ux, uz] = tangent(wall);
  const normal = { x: -uz, y: 0, z: ux };
  const alongCurrentWall = motion.kind === 'wall' && motion.slide && motion.wall.edge === wall.edge;
  const sameWall = alongCurrentWall && motion.lift;
  let yaw = 0;
  if (motion.kind === 'wall' && motion.wall.edge !== wall.edge) {
    const [ax, az] = tangent(motion.wall);
    yaw = Math.atan2(az, ax) - Math.atan2(uz, ux);
  }
  const [gx, gz] = rotate(grab.x, grab.z, yaw);
  const gap = sameWall ? 0 : wallGap(wall, yaw ? footprint.map(([x, z]) => rotate(x, z, yaw)) : footprint);
  const p = intersect({ x: gx - normal.x * gap, y: grab.y, z: gz - normal.z * gap }, normal);
  if (!p) return target.kind === 'floor' && floorDelta ? onFloor(floorDelta) : null;
  const delta = { x: p.x - gx, y: p.y - grab.y, z: p.z - gz };
  const height = bottom + delta.y;
  if (target.kind === 'wall' && (motion.kind === 'floor' || alongCurrentWall) && height < -CONTACT_SNAP_M && floorDelta) return onFloor(floorDelta);
  if (height <= CONTACT_SNAP_M) {
    if (motion.kind === 'floor') return onFloor(delta);
    if (alongCurrentWall && !motion.lift) return translateSelection(s, constrainedDelta(motion, delta));
    delta.y = -bottom;
  }
  return sameWall ? translateSelection(s, constrainedDelta(motion, delta)) : remount(s, ids, yaw, delta, { kind: 'wall', edge: wall.edge });
}

function remount(s: MoveSelection, ids: readonly string[], yaw: number, delta: Translation, support: PieceSupport): MoveResult {
  const candidates = new Map(s.poses);
  const transforms = new Map<string, PiecePose>();
  for (const id of ids) {
    const moved = reposition(s.poses.get(id)!, s.components[id]?.pose ?? IDENTITY, yaw, delta, support);
    candidates.set(id, moved.leaf);
    transforms.set(id, moved.pose);
  }
  const result = proposeRigidMove(s.room, s.tree, s.node, candidates, ZERO);
  return result.ok ? { ...result, transforms } : result;
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
    const leaf = s.poses.get(id)!;
    const support = 'edge' in leaf.mount ? { kind: leaf.mount.kind, edge: target.edge } : undefined;
    const moved = reposition(leaf, s.components[id]?.pose ?? IDENTITY, yaw, { x: tx, y: 0, z: tz }, support);
    transforms.set(id, moved.pose);
    rotated.set(id, moved.leaf);
    // Legal intervals along the target wall only change when a vertex meets a room edge or an opening's end.
    for (const [x, z] of moved.leaf.footprint) {
      s.room.poly.forEach(([x0, z0], i, poly) => {
        const [x1, z1] = poly[(i + 1) % poly.length];
        const dx = x1 - x0, dz = z1 - z0, slope = dx * bz - dz * bx;
        if (Math.abs(slope) > EPS) offsets.add((dz * (x - x0) - dx * (z - z0)) / slope);
      });
      if (!support) continue;
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
