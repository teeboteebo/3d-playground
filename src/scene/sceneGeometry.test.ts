/// <reference types="node" />
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PiecePose } from '../data/components';
import { DEFAULTS, type Settings } from '../state/settings';
import { buildBedroom } from './bedroom';
import { loadFurniture } from './furniture';
import { buildOffice } from './office';
import { addRoomLamps } from './roomLamps';
import { sceneGeometry } from './sceneGeometry';

beforeAll(() => {
  const ctx: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : ctx),
    set: () => true,
    apply: () => ctx,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
});

const withPose = (s: Settings, room: 'bedroom' | 'office' | 'living', id: string, pose: PiecePose | undefined, shown = true): Settings => {
  const components = { ...s.rooms[room].components } as Record<string, object>;
  components[id] = { ...components[id], pose, shown };
  return { ...s, rooms: { ...s.rooms, [room]: { ...s.rooms[room], components } } };
};

function world() {
  const scene = new THREE.Scene();
  const bedroom = buildBedroom(scene, '#B5654A');
  const office = buildOffice(scene);
  const lamps = addRoomLamps(scene);
  const geo = sceneGeometry(scene);
  const apply = (s: Settings) => {
    geo.release();
    bedroom.apply(s);
    office.apply(s);
    lamps.apply(s);
    geo.commit(s);
  };
  apply(DEFAULTS);
  return { scene, geo, apply };
}

const snapshot = (scene: THREE.Object3D) => {
  scene.updateMatrixWorld(true);
  const out: number[][] = [];
  scene.traverse((o) => out.push(o.matrixWorld.elements.slice()));
  return out;
};
const xz = (l: { footprint: readonly (readonly [number, number])[] }) => l.footprint.map(([x, z]) => [x, z]);

describe('scene geometry', () => {
  it('measures real hulls, mounts and obstruction per leaf', () => {
    const { geo, apply } = world();
    const poses = geo.poses('bedroom');
    const bed = poses.get('bed')!;
    expect(bed.footprint.length).toBeGreaterThanOrEqual(4);
    expect(bed.top).toBeGreaterThan(0.8);
    expect(bed.obstructs).toBe(true);
    expect(poses.get('rug')!.obstructs).toBe(false);
    expect(poses.get('wardrobes')!.mount).toMatchObject({ kind: 'wall-and-floor', edge: 1 });
    apply(withPose(DEFAULTS, 'bedroom', 'dresser', undefined, false));
    const hidden = geo.poses('bedroom').get('dresser')!;
    expect(hidden.obstructs).toBe(false);
    expect(hidden.footprint).toEqual(poses.get('dresser')!.footprint);
    apply({ ...DEFAULTS, time: 'eve' });
    expect(geo.poses('office').has('desk')).toBe(true);
  });

  it('previews absolute rigid transforms, restores exactly, and keeps poses() on the committed geometry', () => {
    const { scene, geo } = world();
    const before = geo.poses('bedroom');
    const base = snapshot(scene);
    const yaw = Math.PI / 2;
    let root: THREE.Object3D | undefined;
    scene.traverse((o) => {
      const t = o.userData.option;
      if (!root && t?.room === 'bedroom' && t.path.length === 1 && t.path[0] === 'dresser') root = o;
    });
    const dresser = () => new THREE.Box3().setFromObject(root!);
    const box0 = dresser();
    geo.preview('bedroom', new Map([['dresser', { x: 0.5, y: 0, z: -0.25, yaw }]]));
    expect(snapshot(scene)).not.toEqual(base);
    const during = geo.poses('bedroom');
    for (const [id, leaf] of before) expect(xz(during.get(id)!)).toEqual(xz(leaf));
    expect(snapshot(scene).length).toBe(base.length);
    expect(dresser().equals(box0)).toBe(false);
    geo.preview('bedroom', null);
    expect(snapshot(scene)).toEqual(base);
  });

  it('hides wall-mounted pieces with their destination wall and keeps hidden leaves measurable', () => {
    const { scene, geo, apply } = world();
    const office = DEFAULTS.rooms.office;
    const hidden = geo.poses('office').get('floor-lamp');
    expect(hidden?.obstructs).toBe(false);
    expect(hidden?.footprint.length).toBeGreaterThan(2);
    const lamp = scene.getObjectByName('office-floor-lamp')!;
    const moved = withPose(DEFAULTS, 'office', 'floor-lamp', { x: 0.4, y: 0, z: 0.3, yaw: 0 }, false);
    apply(moved);
    expect(lamp.visible).toBe(false);
    const was = hidden!.footprint[0];
    const now = geo.poses('office').get('floor-lamp')!.footprint.map(([x, z]) => [Math.round(x * 1e3), Math.round(z * 1e3)]);
    expect(now).toContainEqual([Math.round((was[0] + 0.4) * 1e3), Math.round((was[1] + 0.3) * 1e3)]);
    expect(office).toBeDefined();
    geo.showFrom(new THREE.Vector3(0, 5, 0));
    expect(lamp.visible).toBe(false);
  });

  it('keeps committed poses through apply, even for pieces the builders reposition, and ignores fixed mounts', () => {
    const { scene, geo, apply } = world();
    const base = snapshot(scene);
    const dresser = geo.poses('office').get('dresser')!;
    const s = withPose(withPose(DEFAULTS, 'office', 'dresser', { x: 0, y: 0, z: 0.4, yaw: 0 }), 'bedroom', 'ceiling-light', { x: 1, y: 0, z: 0, yaw: 0 });
    apply(s);
    apply(s);
    const moved = geo.poses('office').get('dresser')!;
    moved.footprint.forEach(([, z], i) => expect(z).toBeCloseTo(dresser.footprint[i][1] + 0.4, 5));
    expect(geo.poses('bedroom').get('ceiling-light')!.footprint).toEqual(world().geo.poses('bedroom').get('ceiling-light')!.footprint);
    apply(DEFAULTS);
    expect(snapshot(scene)).toEqual(base);
  });

  it('applies a committed pose to a piece that arrives late, and reports an overriding wall edge', async () => {
    const scene = new THREE.Scene();
    const geo = sceneGeometry(scene);
    const bytes = readFileSync('public/models/living/shelving.glb');
    const { scene: shelf } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(Uint8Array.from(bytes).buffer, '');
    const s = withPose(DEFAULTS, 'living', 'shelving', { x: 0, y: 0, z: 0.3, yaw: 0, edge: 2 });
    geo.commit(s);
    expect(geo.poses('living').size).toBe(0);
    await loadFurniture(scene, async ({ id }) => (id === 'shelving' ? shelf : new THREE.Group()), () => {}, () => geo.refresh()).ready;
    const moved = geo.poses('living').get('shelving')!;
    geo.release();
    const home = geo.poses('living').get('shelving')!;
    expect(Math.min(...moved.footprint.map((p) => p[1])) - Math.min(...home.footprint.map((p) => p[1]))).toBeCloseTo(0.3);
    expect(moved.mount).toMatchObject({ kind: 'wall-and-floor', edge: 2, embedDepth: 0.004 });
  });

  it('moves a root under a transformed parent by the same world transform', () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    parent.position.set(2, 0, 1);
    parent.rotation.y = 0.7;
    scene.add(parent);
    const rug = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 2));
    rug.userData.option = { room: 'bedroom', path: ['rug'] };
    parent.add(rug);
    const geo = sceneGeometry(scene);
    const home = geo.poses('bedroom').get('rug')!;
    const cx = (l: typeof home) => l.footprint.reduce((a, p) => a + p[0], 0) / l.footprint.length;
    const centre0 = new THREE.Box3().setFromObject(rug).getCenter(new THREE.Vector3());
    geo.preview('bedroom', new Map([['rug', { x: 1, y: 0, z: 0, yaw: 0 }]]));
    expect(new THREE.Box3().setFromObject(rug).getCenter(new THREE.Vector3()).x - centre0.x).toBeCloseTo(1);
    expect(cx(geo.poses('bedroom').get('rug')!)).toBeCloseTo(cx(home));
    geo.preview('bedroom', null);
    expect(rug.position.toArray()).toEqual([0, 0, 0]);
  });
});
