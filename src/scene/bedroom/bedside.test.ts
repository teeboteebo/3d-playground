import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildBed } from './bed';
import { BEDX, NIGHTSTAND, L, NIGHTSTAND_X, W, WARD_FRONT } from './dimensions';
import { kit } from './kit';
import { bedroomMaterials } from './materials';
import { buildBedside } from './bedside';
import { BED_WALL_STRIP_DEPTH } from './moulding';

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
      // the back panel stands in front of the bed-wall moulding strips
      expect(box.min.z - -L / 2).toBeGreaterThanOrEqual(BED_WALL_STRIP_DEPTH - 1e-9);
    }
    expect(left.min.x - -W / 2).toBeCloseTo(0.47, 2);
    expect(WARD_FRONT - right.max.x).toBeCloseTo(0.55, 2);
    b.lamps.forEach((l, i) => expect(l.key.position.x).toBeCloseTo(NIGHTSTAND_X[i], 6));
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
