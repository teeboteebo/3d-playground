import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildBed, buildBench } from './bed';
import { BEDX, NIGHTSTAND, L, NIGHTSTAND_X, W, WARD_FRONT } from './dimensions';
import { kit } from './kit';
import { bedroomMaterials } from './materials';
import { buildBedside } from './bedside';
import { mergeMeshes } from '../merge';

/* jsdom has no 2D canvas: the textures only need something that swallows every drawing call */
beforeAll(() => {
  const ctx: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : ctx),
    set: () => true,
    apply: () => ctx,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
});

/** the bounding box of every mesh that uses `mat`, optionally only the vertices with x in [x0, x1] */
function oakBox(parent: THREE.Object3D, mat: THREE.Material, x0 = -Infinity, x1 = Infinity) {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  parent.updateMatrixWorld(true);
  parent.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.material !== mat) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.x >= x0 && v.x <= x1) box.expandByPoint(v);
    }
  });
  return box;
}

describe('nightstands', () => {
  it('stand at their measured distances, and the bed is centred between them', () => {
    expect(NIGHTSTAND_X[0]).toBeCloseTo(-1.48);
    expect(NIGHTSTAND_X[1]).toBeCloseTo(0.82);
    expect(BEDX).toBeCloseTo(-0.33);
  });

  it('are 40 x 23 x 30 cm, 48 cm off the floor, at the right distance from the walls', () => {
    const parent = new THREE.Group();
    const m = bedroomMaterials('#888888');
    const b = buildBedside(kit(parent), m);
    const mid = BEDX;
    const left = oakBox(parent, m.oak, -Infinity, mid);
    const right = oakBox(parent, m.oak, mid, Infinity);
    for (const box of [left, right]) {
      const s = box.getSize(new THREE.Vector3());
      expect(s.x).toBeCloseTo(NIGHTSTAND.w, 2);
      expect(s.y).toBeCloseTo(NIGHTSTAND.h, 2);
      expect(s.z).toBeCloseTo(NIGHTSTAND.d, 2);
      expect(box.min.y).toBeCloseTo(0.48, 2);
    }
    expect(left.min.x - -W / 2).toBeCloseTo(0.47, 2);
    expect(WARD_FRONT - right.max.x).toBeCloseTo(0.55, 2);
    expect(b.lamps.left.key.position.x).toBeCloseTo(NIGHTSTAND_X[0], 6);
    expect(b.lamps.right.key.position.x).toBeCloseTo(NIGHTSTAND_X[1], 6);
  });

  it('stand off the wall by the moulding depth they are given, flush before that', () => {
    const parent = new THREE.Group();
    const m = bedroomMaterials('#888888');
    const b = buildBedside(kit(parent), m);
    expect(oakBox(parent, m.oak).min.z - -L / 2).toBeCloseTo(0, 6);
    b.standOff(0.02);
    expect(oakBox(parent, m.oak).min.z - -L / 2).toBeCloseTo(0.02, 6);
    b.standOff(0.012);
    expect(oakBox(parent, m.oak).min.z - -L / 2).toBeCloseTo(0.012, 6);
  });

  it('stand about 10 cm from the headboard on each side', () => {
    const parent = new THREE.Group();
    const m = bedroomMaterials('#888888');
    const k = kit(parent);
    buildBedside(k, m);
    const bedParent = new THREE.Group();
    buildBed(kit(bedParent), m);
    let head = new THREE.Box3();
    bedParent.updateMatrixWorld(true);
    bedParent.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.material !== m.oak) return;
      const b = new THREE.Box3().setFromObject(o);
      if (Math.abs(b.max.x - b.min.x - 1.69) < 1e-3 && b.max.y > 1) head = b;
    });
    expect(head.min.x).toBeCloseTo(BEDX - 0.845, 3);
    expect(head.max.x).toBeCloseTo(BEDX + 0.845, 3);
    const left = oakBox(parent, m.oak, -Infinity, BEDX);
    const right = oakBox(parent, m.oak, BEDX, Infinity);
    expect(head.min.x - left.max.x).toBeCloseTo(0.1, 1);
    expect(right.min.x - head.max.x).toBeCloseTo(0.1, 1);
  });
});

describe('the tables and the lamps', () => {
  const build = () => {
    const parent = new THREE.Group();
    const m = bedroomMaterials('#888888');
    const b = buildBedside(kit(parent), m);
    const tables = [...b.tables.left, ...b.tables.right];
    const lampParts = [...b.lampParts.left, ...b.lampParts.right];
    return { parent, m, b, tables, lampParts };
  };
  const bounds = (parts: THREE.Object3D[]) => parts.reduce((box, o) => box.union(new THREE.Box3().setFromObject(o)), new THREE.Box3());
  const mats = (parts: THREE.Object3D[]) => new Set(parts.map((o) => (o as THREE.Mesh).material));

  it('are separate meshes, together everything the bedside builder adds', () => {
    const { parent, tables, lampParts } = build();
    const meshes = parent.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    expect(tables.length).toBeGreaterThan(0);
    expect(lampParts.length).toBeGreaterThan(0);
    expect(tables.some((o) => lampParts.includes(o))).toBe(false);
    expect(new Set([...tables, ...lampParts])).toEqual(new Set(meshes));
  });

  it('keep each table and each lamp in meshes of its own, so one side can be hidden alone', () => {
    const { b } = build();
    const all = [b.tables.left, b.tables.right, b.lampParts.left, b.lampParts.right];
    all.forEach((parts, i) => all.slice(i + 1).forEach((other) => expect(parts.some((o) => other.includes(o))).toBe(false)));
    for (const parts of all) expect(parts.length).toBeGreaterThan(0);
  });

  it('put each table, and each lamp, on its own side of the bed at the measured places', () => {
    const { b } = build();
    const left = bounds(b.tables.left);
    const right = bounds(b.tables.right);
    for (const [box, x] of [[left, NIGHTSTAND_X[0]], [right, NIGHTSTAND_X[1]]] as const) {
      const s = box.getSize(new THREE.Vector3());
      expect(s.x).toBeCloseTo(NIGHTSTAND.w, 2);
      expect(s.y).toBeCloseTo(NIGHTSTAND.h, 2);
      expect((box.min.x + box.max.x) / 2).toBeCloseTo(x, 3);
    }
    expect(left.max.x).toBeLessThan(right.min.x);
    const leftLamp = bounds(b.lampParts.left);
    const rightLamp = bounds(b.lampParts.right);
    expect((leftLamp.min.x + leftLamp.max.x) / 2).toBeCloseTo(NIGHTSTAND_X[0], 1);
    expect((rightLamp.min.x + rightLamp.max.x) / 2).toBeCloseTo(NIGHTSTAND_X[1], 1);
    expect(leftLamp.max.x).toBeLessThan(rightLamp.min.x);
  });

  it('share no material between tables and lamps, so hiding one kind leaves the other drawn', () => {
    const { tables, lampParts } = build();
    const tableMats = mats(tables);
    for (const mat of mats(lampParts)) expect(tableMats.has(mat)).toBe(false);
  });

  it('keep the lamps in place when the tables stand off the wall', () => {
    const { b, tables, lampParts } = build();
    const lamps0 = bounds(lampParts).min.z;
    const tables0 = bounds(tables).min.z;
    b.standOff(0.02);
    expect(bounds(lampParts).min.z).toBeCloseTo(lamps0, 6);
    expect(bounds(tables).min.z).toBeCloseTo(tables0 + 0.02, 6);
  });

  it('light each lamp on its own, and no table', () => {
    const { b } = build();
    b.setEvening({ left: true, right: false });
    expect(b.lamps.left.key.intensity).toBeGreaterThan(0);
    expect(b.lamps.right.key.intensity).toBe(0);
    b.setEvening({ left: true, right: true });
    expect(b.lamps.left.key.intensity).toBeGreaterThan(0);
    expect(b.lamps.right.key.intensity).toBeGreaterThan(0);
    b.setEvening({ left: false, right: false });
    expect(b.lamps.left.key.intensity + b.lamps.right.key.intensity).toBe(0);
  });
});

describe('the bed and the bench', () => {
  const bounds = (parts: THREE.Object3D[]) => parts.reduce((box, o) => box.union(new THREE.Box3().setFromObject(o)), new THREE.Box3());
  const build = () => {
    const parent = new THREE.Group();
    const m = bedroomMaterials('#888888');
    const k = kit(parent);
    const bed = buildBed(k, m);
    const bench = buildBench(k, m);
    return { parent, m, bed, bench };
  };

  it('are built as two sets of meshes with nothing in common', () => {
    const { parent, bed, bench } = build();
    expect(bed.length).toBeGreaterThan(0);
    expect(bench.length).toBeGreaterThan(0);
    expect(bed.some((o) => bench.includes(o))).toBe(false);
    expect(new Set([...bed, ...bench])).toEqual(new Set(parent.children));
  });

  it('keep the bench at the foot of the bed, 90 × 45 cm and centred on it', () => {
    const { bed, bench } = build();
    const bedBox = bounds(bed);
    const benchBox = bounds(bench);
    const size = benchBox.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(0.9, 1);
    expect(size.y).toBeCloseTo(0.45, 2);
    expect(size.z).toBeCloseTo(0.35, 1);
    expect((benchBox.min.x + benchBox.max.x) / 2).toBeCloseTo(BEDX, 2);
    expect(benchBox.min.z).toBeGreaterThanOrEqual(bedBox.max.z);
    expect(benchBox.min.z - bedBox.max.z).toBeLessThan(0.05);
  });

  it('leave the pillows and the throw with the bed', () => {
    const { m, bed, bench } = build();
    const used = (parts: THREE.Object3D[]) => new Set(parts.map((o) => (o as THREE.Mesh).material));
    for (const mat of [...m.pillows, m.throwBlanket, m.mattress, m.bedding]) {
      expect(used(bed).has(mat)).toBe(true);
      expect(used(bench).has(mat)).toBe(false);
    }
  });

  it('merge apart, each into one mesh per material', () => {
    const { bed, bench } = build();
    const mats = (parts: THREE.Object3D[]) => parts.map((o) => (o as THREE.Mesh).material);
    const mergedBench = mergeMeshes(bench);
    expect(new Set(mats(mergedBench)).size).toBe(mergedBench.length);
    const mergedBed = mergeMeshes(bed);
    expect(mergedBed.length).toBeLessThan(bed.length);
    expect(mergedBed.some((o) => mergedBench.includes(o))).toBe(false);
  });
});
