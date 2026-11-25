import * as THREE from 'three';
import type { ComponentDef, ComponentState, Mount, PiecePose } from '../data/components';
import { ROOM_DEFS } from '../data/roomDefs';
import { roomById, type RoomId, type XZ } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { SceneOption } from './options';
import { roomWalls, wallFacesCamera, type Wall } from './apartment';
import type { PlacedLeaf } from './rigidPlacement';

const NON_OBSTRUCTING = new Set(['rug', 'round-rug']);

export function poseMatrix({ x, y, z, yaw }: PiecePose, out = new THREE.Matrix4()): THREE.Matrix4 {
  return out.makeRotationY(yaw).premultiply(new THREE.Matrix4().makeTranslation(x, y, z));
}

const isIdentity = (p: PiecePose) => p.x === 0 && p.y === 0 && p.z === 0 && p.yaw === 0;
const valid = (p: PiecePose) => [p.x, p.y, p.z, p.yaw].every(Number.isFinite);

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

function worldExtent(roots: readonly THREE.Object3D[]): { footprint: XZ[]; bottom: number; top: number } | null {
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
  /** Committed leaves only. A model that has not loaded has no footprint yet. */
  poses(room: RoomId): ReadonlyMap<string, PlacedLeaf>;
  /** shows absolute transforms for some leaves of the room, or restores the committed ones (null) */
  preview(room: RoomId, poses: ReadonlyMap<string, PiecePose> | null): void;
  /** puts every moved piece back where its builder left it; call before builders reposition anything */
  release(): void;
  /** the settings' committed poses, once the builders have run; keeps the preview showing */
  commit(settings: Settings): void;
  /** Apply the destination wall's cutaway to a remounted piece. Builders own visibility at the authored wall. */
  showFrom(camera: THREE.Vector3): void;
  restoreVisibility(): void;
  /** the scene gained or rebuilt pieces (a model arrived): poses them again */
  refresh(): void;
}

export function sceneGeometry(scene: THREE.Object3D): SceneGeometry {
  let settings: Settings | null = null;
  let shownPreview: { room: RoomId; poses: ReadonlyMap<string, PiecePose> } | null = null;
  let roots: Roots | null = null;
  const moved = new Map<THREE.Object3D, Authored>();
  const visibility = new Map<THREE.Object3D, boolean>();
  function restoreVisibility() {
    for (const [o, shown] of visibility) o.visible = shown;
    visibility.clear();
  }

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
    restoreVisibility();
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

  const walls = new Map<RoomId, Wall[]>();
  const wallOf = (room: RoomId, edge: number) => {
    if (!walls.has(room)) walls.set(room, roomWalls(roomById(room)));
    return walls.get(room)!.find((w) => w.edge === edge);
  };

  const refresh = () => {
    release();
    place();
  };

  return {
    release,
    restoreVisibility,
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
    showFrom(camera) {
      for (const [room, leaves] of found()) {
        for (const [id, objects] of leaves) {
          const state = componentOf(room, id);
          const preview = shownPreview?.room === room ? shownPreview.poses.get(id) : undefined;
          const support = (preview ?? state?.pose)?.support;
          if (!support) continue;
          const wall = 'edge' in support ? wallOf(room, support.edge) : undefined;
          const visible = (state?.shown ?? true) && (!wall || wallFacesCamera(wall, camera));
          for (const o of objects) {
            visibility.set(o, o.visible);
            o.visible = visible;
          }
        }
      }
    },
    poses(room) {
      const held = shownPreview;
      if (held) {
        shownPreview = null;
        restore();
        place();
      }
      try {
        return committed(room);
      } finally {
        if (held) {
          shownPreview = held;
          restore();
          place();
        }
      }
    },
  };

  function committed(room: RoomId) {
    const out = new Map<string, PlacedLeaf>();
    const leaves = found().get(room);
    for (const { id } of ROOM_DEFS[room].components) {
      const objects = leaves?.get(id);
      const box = objects && worldExtent(objects);
      if (!box) continue;
      const state = componentOf(room, id);
      const authored = mountOf(room, id);
      const support = state?.pose?.support;
      const mount = support && 'edge' in support && 'edge' in authored ? { ...authored, ...support } : support ?? authored;
      out.set(id, { ...box, mount, obstructs: (state?.shown ?? true) && !NON_OBSTRUCTING.has(id) });
    }
    return out;
  }
}
