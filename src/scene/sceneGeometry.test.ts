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
const lowestY = (l: { bottom: number }) => l.bottom;

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

  it('previews absolute rigid transforms, restores exactly, and leaves other geometry alone', () => {
    const { scene, geo } = world();
    const before = geo.poses('bedroom');
    const base = snapshot(scene);
    const yaw = Math.PI / 2;
    geo.preview('bedroom', new Map([['dresser', { x: 0.5, y: 0, z: -0.25, yaw }]]));
    const after = geo.poses('bedroom');
    const was = before.get('dresser')!;
    const expected = was.footprint.map(([x, z]) => [x * Math.cos(yaw) + z * Math.sin(yaw) + 0.5, -x * Math.sin(yaw) + z * Math.cos(yaw) - 0.25]);
    const sort = (p: number[][]) => p.map(([x, z]) => [Math.round(x * 1e4), Math.round(z * 1e4)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(sort(xz(after.get('dresser')!))).toEqual(sort(expected));
    expect(lowestY(after.get('dresser')!)).toBeCloseTo(was.bottom);
    expect(xz(after.get('bed')!)).toEqual(xz(before.get('bed')!));
    geo.preview('bedroom', new Map([['dresser', { x: 0.5, y: 0, z: -0.25, yaw }]]));
    expect(sort(xz(geo.poses('bedroom').get('dresser')!))).toEqual(sort(expected));
    geo.preview('bedroom', null);
    expect(snapshot(scene)).toEqual(base);
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
    geo.preview('bedroom', new Map([['rug', { x: 1, y: 0, z: 0, yaw: 0 }]]));
    const moved = geo.poses('bedroom').get('rug')!;
    const cx = (l: typeof home) => l.footprint.reduce((a, p) => a + p[0], 0) / l.footprint.length;
    expect(cx(moved) - cx(home)).toBeCloseTo(1);
    geo.preview('bedroom', null);
    expect(rug.position.toArray()).toEqual([0, 0, 0]);
  });
});
