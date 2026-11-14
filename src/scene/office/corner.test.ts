import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DRESSERS, READING_CHAIRS, ROUND_RUGS } from '../../data/catalog';
import { ROOMS } from '../../data/rooms';
import { DEFAULTS, type Settings } from '../../state/settings';
import { roomAt } from '../pickRoom';
import { buildCorner } from './corner';
import { FLOOR_LAMP_SPOT } from '../roomLamps';
import { CORNER } from './dimensions';
import { buildOffice } from './index';

const NAMES = ['office-reading-chair', 'office-dresser', 'office-round-rug'];
const NONE = { readingChair: 'none', dresser: 'none', roundRug: 'none' };
const settings = (o: Partial<Settings['office']>): Settings => ({
  ...DEFAULTS,
  office: { ...DEFAULTS.office, ...NONE, ...o },
});

/** the office furniture and the corner, built into one group, with `o` applied */
const build = (o: Partial<Settings['office']>) => {
  const g = new THREE.Group();
  const office = buildOffice(g);
  office.apply(settings(o));
  g.updateMatrixWorld(true);
  return g;
};
const boxOf = (g: THREE.Object3D, name: string) => new THREE.Box3().setFromObject(g.getObjectByName(name)!);
const inOffice = (x: number, z: number) => roomAt(x, z, ROOMS) === 'office';

/** the footprint corners of a piece: its box's bottom corners in the piece's own frame, placed in the world */
function footprint(g: THREE.Object3D, name: string): THREE.Vector3[] {
  const piece = g.getObjectByName(name)!;
  const local = new THREE.Box3();
  piece.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox!.clone();
    /* each mesh's own transform, up to (not including) the piece group */
    const m = new THREE.Matrix4();
    for (let p: THREE.Object3D | null = o; p && p !== piece; p = p.parent) m.premultiply(p.matrix);
    local.union(b.applyMatrix4(m));
  });
  const { min, max } = local;
  return [
    [min.x, min.z],
    [max.x, min.z],
    [max.x, max.z],
    [min.x, max.z],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(piece.matrixWorld));
}

/** whether the convex quad `q` (x, z) overlaps the axis-aligned box `b`'s footprint, by separating axes */
function quadHitsBox(q: THREE.Vector3[], b: THREE.Box3): boolean {
  const rect = [
    new THREE.Vector3(b.min.x, 0, b.min.z),
    new THREE.Vector3(b.max.x, 0, b.min.z),
    new THREE.Vector3(b.max.x, 0, b.max.z),
    new THREE.Vector3(b.min.x, 0, b.max.z),
  ];
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)];
  for (let i = 0; i < q.length; i++) {
    const e = q[(i + 1) % q.length].clone().sub(q[i]);
    axes.push(new THREE.Vector3(-e.z, 0, e.x));
  }
  for (const a of axes) {
    const pa = q.map((p) => p.dot(a));
    const pb = rect.map((p) => p.dot(a));
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
  }
  return true;
}

describe('buildCorner', () => {
  it.each(ROUND_RUGS.slice(1).map((r) => [r.id]))('fits rug %s inside the office, clear of desk and cabinets', (id) => {
    const g = build({ roundRug: id });
    const rug = g.getObjectByName('office-round-rug')!;
    const b = boxOf(g, 'office-round-rug');
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    const r = (b.max.x - b.min.x) / 2;
    expect(cx).toBeCloseTo(CORNER.rug.x, 3);
    expect(cz + r).toBeCloseTo(CORNER.rug.windowZ - CORNER.rug.gap, 3);
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      expect(inOffice(cx + Math.cos(a) * r, cz + Math.sin(a) * r)).toBe(true);
    }
    expect(b.max.y - b.min.y).toBeLessThanOrEqual(0.015);
    expect(b.intersectsBox(boxOf(g, 'office-desk'))).toBe(false);
    expect(b.intersectsBox(boxOf(g, 'office-cabinets'))).toBe(false);
    rug.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        expect(o.castShadow).toBe(false);
        expect(o.receiveShadow).toBe(true);
      }
    });
  });

  const chairs = READING_CHAIRS.slice(1).map((c) => [c.id]);
  it.each(chairs)('stands chair %s inside the office, clear of the desk and lamp spot', (id) => {
    const g = build({ readingChair: id });
    const corners = footprint(g, 'office-reading-chair');
    for (const p of corners) expect(inOffice(p.x, p.z)).toBe(true);
    /* strictly inside the outline too (roomAt allows for wall thickness): east wall and the door's angled wall */
    for (const p of corners) {
      expect(p.x).toBeLessThan(11.89);
      expect(-0.8 * (p.x - 11.89) - 0.6 * (p.z - 1.355)).toBeGreaterThan(0.049);
    }
    expect(quadHitsBox(corners, boxOf(g, 'office-desk'))).toBe(false);
    const { x: lx, z: lz } = FLOOR_LAMP_SPOT.office;
    const lamp = new THREE.Box3(new THREE.Vector3(lx - 0.3, 0, lz - 0.3), new THREE.Vector3(lx + 0.3, 1, lz + 0.3));
    expect(quadHitsBox(corners, lamp)).toBe(false);
    g.getObjectByName('office-reading-chair')!.traverse((o) => {
      if (o instanceof THREE.Mesh) expect(o.castShadow).toBe(true);
    });
  });

  it.each(DRESSERS.slice(1).map((d) => [d.id]))('stands dresser %s against the angled wall, inside the office', (id) => {
    const g = build({ dresser: id });
    const corners = footprint(g, 'office-dresser');
    for (const p of corners) expect(inOffice(p.x, p.z)).toBe(true);
    const [[ax, az], [bx, bz]] = [CORNER.dresserWall.a, CORNER.dresserWall.b];
    const len = Math.hypot(bx - ax, bz - az);
    /* inward normal of the wall */
    const nx = (bz - az) / len;
    const nz = -(bx - ax) / len;
    const dist = corners.map((p) => (p.x - ax) * nx + (p.z - az) * nz);
    expect(Math.abs(Math.min(...dist) - 0.05)).toBeLessThanOrEqual(0.01);
    /* the back is parallel to the wall: the two nearest corners are equally far */
    const sorted = [...dist].sort((a, b) => a - b);
    expect(sorted[1] - sorted[0]).toBeLessThan(0.001);
  });

  const pairs = READING_CHAIRS.slice(1).flatMap((c) => DRESSERS.slice(1).map((d) => [c.id, d.id]));
  it.each(pairs)('keeps chair %s and dresser %s from overlapping', (chair, dresser) => {
    const g = build({ readingChair: chair, dresser });
    const c = footprint(g, 'office-reading-chair');
    const d = footprint(g, 'office-dresser');
    const axes = [c, d].flatMap((q) =>
      q.map((p, i) => {
        const e = q[(i + 1) % q.length].clone().sub(p);
        return new THREE.Vector3(-e.z, 0, e.x);
      }),
    );
    const separated = axes.some((a) => {
      const pa = c.map((p) => p.dot(a));
      const pb = d.map((p) => p.dot(a));
      return Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa);
    });
    expect(separated).toBe(true);
  });

  it('swaps pieces without leaking', () => {
    const g = new THREE.Group();
    const corner = buildCorner(g);
    const [a, b] = [READING_CHAIRS[1].id, READING_CHAIRS[2].id];
    corner.apply(settings({ readingChair: a }));
    const disposed = new Set<THREE.BufferGeometry>();
    const geos: THREE.BufferGeometry[] = [];
    const disposedMats = new Set<THREE.Material>();
    const mats = new Set<THREE.Material>();
    g.getObjectByName('office-reading-chair')!.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geos.push(o.geometry);
        o.geometry.addEventListener('dispose', () => disposed.add(o.geometry));
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          mats.add(m);
          m.addEventListener('dispose', () => disposedMats.add(m));
        }
      }
    });
    const first = g.getObjectByName('office-reading-chair');
    corner.apply(settings({ readingChair: a }));
    expect(g.getObjectByName('office-reading-chair')).toBe(first);
    expect(disposed.size).toBe(0);
    corner.apply(settings({ readingChair: b }));
    expect(disposed.size).toBe(geos.length);
    expect(disposedMats.size).toBe(mats.size);
    corner.apply(settings({ readingChair: a }));
    expect(g.children.filter((c) => c.name === 'office-reading-chair')).toHaveLength(1);
  });

  it('shows nothing for none', () => {
    const g = new THREE.Group();
    const corner = buildCorner(g);
    corner.apply(settings({ readingChair: READING_CHAIRS[1].id, dresser: DRESSERS[1].id, roundRug: ROUND_RUGS[1].id }));
    for (const n of NAMES) expect(g.getObjectByName(n)).toBeDefined();
    corner.apply(settings({}));
    for (const n of NAMES) expect(g.getObjectByName(n)).toBeUndefined();
  });
});
