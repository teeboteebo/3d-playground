import * as THREE from 'three';
import type { ComponentDef, ComponentState, Mount, PiecePose } from '../data/components';
import { ROOM_DEFS } from '../data/roomDefs';
import type { RoomId, XZ } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { SceneOption } from './options';
import type { PlacedLeaf } from './rigidPlacement';

/** Rugs lie on the floor and do not obstruct other pieces. */
const RUGS = new Set(['rug', 'round-rug']);

/** The scene transform a pose stands for: a turn about the world's y axis through the origin, then the translation. */
export function poseMatrix({ x, y, z, yaw }: PiecePose, out = new THREE.Matrix4()): THREE.Matrix4 {
  return out.makeRotationY(yaw).premultiply(new THREE.Matrix4().makeTranslation(x, y, z));
}

const isIdentity = (p: PiecePose) => p.x === 0 && p.y === 0 && p.z === 0 && p.yaw === 0;
const valid = (p: PiecePose) => [p.x, p.y, p.z, p.yaw].every(Number.isFinite);

/** The convex hull of points in the xz plane (Andrew's monotone chain). */
function hull(points: XZ[]): XZ[] {
  if (points.length < 3) return points;
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: XZ, a: XZ, b: XZ) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (pts: XZ[]) => {
    const out: XZ[] = [];
    for (const p of pts) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...chain(points), ...chain(points.slice().reverse())];
}

/** What the leaf's pieces cover in world space: the hull of every drawn vertex, and its lowest and highest point. */
function measure(roots: readonly THREE.Object3D[]): { footprint: XZ[]; bottom: number; top: number } | null {
  const points: XZ[] = [];
  let bottom = Infinity;
  let top = -Infinity;
  const visit = (o: THREE.Object3D, root: boolean) => {
    if (!root && !o.visible) return;
    const mesh = o as THREE.Mesh;
    const position = mesh.isMesh ? (mesh.geometry as THREE.BufferGeometry).getAttribute('position') : undefined;
    if (position && position.count) {
      const e = mesh.matrixWorld.elements;
      const own: XZ[] = [];
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        const w = e[3] * x + e[7] * y + e[11] * z + e[15];
        const wy = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
        bottom = Math.min(bottom, wy);
        top = Math.max(top, wy);
        own.push([(e[0] * x + e[4] * y + e[8] * z + e[12]) / w, (e[2] * x + e[6] * y + e[10] * z + e[14]) / w]);
      }
      points.push(...hull(own));
    }
    for (const c of o.children) visit(c, false);
  };
  for (const r of roots) {
    r.updateWorldMatrix(true, true);
    visit(r, true);
  }
  return points.length ? { footprint: hull(points), bottom, top } : null;
}

interface Authored {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

type Roots = Map<RoomId, Map<string, THREE.Object3D[]>>;

export interface SceneGeometry {
  /** the room's leaves as they stand now, preview excluded; a leaf with nothing in the scene (a hidden catalog lamp) is absent */
  poses(room: RoomId): ReadonlyMap<string, PlacedLeaf>;
  /** shows absolute transforms for some leaves of the room, or restores the committed ones (null) */
  preview(room: RoomId, poses: ReadonlyMap<string, PiecePose> | null): void;
  /** puts every moved piece back where its builder left it; call before builders reposition anything */
  release(): void;
  /** the settings' committed poses, once the builders have run; keeps the preview showing */
  commit(settings: Settings): void;
  /** the scene gained or rebuilt pieces (a model arrived): poses them again */
  refresh(): void;
}

/**
 * The physical placement of the scene's components. The builders leave every piece at its authored spot; a pose then
 * moves the piece's tagged roots as a rigid transform of the world (see `poseMatrix`), so lights and children move
 * along and nothing else in the scene changes.
 */
export function sceneGeometry(scene: THREE.Object3D): SceneGeometry {
  let settings: Settings | null = null;
  let shownPreview: { room: RoomId; poses: ReadonlyMap<string, PiecePose> } | null = null;
  let roots: Roots | null = null;
  const moved = new Map<THREE.Object3D, Authored>();

  const found = (): Roots => {
    if (roots) return roots;
    const ids = new Map(Object.entries(ROOM_DEFS).map(([room, def]) => [room, new Set<string>(def.components.map((c) => c.id))]));
    const found: Roots = new Map();
    const visit = (o: THREE.Object3D) => {
      const option = o.userData.option as SceneOption | undefined;
      if (option) {
        if (option.path.length === 1 && ids.get(option.room)?.has(option.path[0])) {
          const leaves = found.get(option.room) ?? new Map<string, THREE.Object3D[]>();
          leaves.set(option.path[0], [...(leaves.get(option.path[0]) ?? []), o]);
          found.set(option.room, leaves);
        }
        return;
      }
      o.children.forEach(visit);
    };
    visit(scene);
    return (roots = found);
  };

  const componentOf = (room: RoomId, id: string) => (settings?.rooms[room].components as Record<string, ComponentState> | undefined)?.[id];
  const mountOf = (room: RoomId, id: string): Mount =>
    (ROOM_DEFS[room].components as readonly ComponentDef[]).find((c) => c.id === id)?.mount ?? { kind: 'floor' };

  function restore() {
    for (const [o, a] of moved) {
      o.position.copy(a.position);
      o.quaternion.copy(a.quaternion);
      o.scale.copy(a.scale);
    }
    moved.clear();
  }

  function release() {
    restore();
    roots = null;
  }

  const parentWorld = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const pose = new THREE.Matrix4();
  function place() {
    for (const [room, leaves] of found()) {
      for (const [id, objects] of leaves) {
        if (mountOf(room, id).kind === 'fixed') continue;
        const p = shownPreview?.room === room && shownPreview.poses.has(id) ? shownPreview.poses.get(id) : componentOf(room, id)?.pose;
        if (!p || !valid(p) || isIdentity(p)) continue;
        for (const o of objects) {
          if (!moved.has(o)) moved.set(o, { position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() });
          o.parent?.updateWorldMatrix(true, false);
          parentWorld.copy(o.parent?.matrixWorld ?? local.identity());
          o.updateMatrix();
          local.copy(parentWorld).invert().multiply(poseMatrix(p, pose)).multiply(parentWorld).multiply(o.matrix);
          local.decompose(o.position, o.quaternion, o.scale);
          o.updateMatrixWorld(true);
        }
      }
    }
  }

  const refresh = () => {
    release();
    place();
  };

  return {
    release,
    refresh,
    commit(s) {
      settings = s;
      refresh();
    },
    preview(room, poses) {
      shownPreview = poses ? { room, poses } : null;
      restore();
      place();
    },
    poses(room) {
      const out = new Map<string, PlacedLeaf>();
      const leaves = found().get(room);
      for (const { id } of ROOM_DEFS[room].components) {
        const objects = leaves?.get(id);
        const box = objects && measure(objects);
        if (!box) continue;
        const state = componentOf(room, id);
        const committedPose = state?.pose;
        let mount = mountOf(room, id);
        if (committedPose?.edge !== undefined && 'edge' in mount) mount = { ...mount, edge: committedPose.edge };
        out.set(id, { ...box, mount, obstructs: (state?.shown ?? true) && !RUGS.has(id) });
      }
      return out;
    },
  };
}
