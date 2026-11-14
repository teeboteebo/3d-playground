import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { trimAbove } from './trimGeometry';

const all = () => true;
const identity = new THREE.Matrix4();

/** a non-indexed geometry from a flat list of triangle corners */
function triangles(points: number[][], uvs?: number[][]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  g.computeVertexNormals();
  return g;
}

const triangleCount = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3;

function maxY(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute('position');
  let max = -Infinity;
  for (let i = 0; i < pos.count; i++) max = Math.max(max, pos.getY(i));
  return max;
}

function area(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute('position');
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let sum = 0;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    sum += new THREE.Triangle(a, b, c).getArea();
  }
  return sum;
}

describe('trimAbove', () => {
  it('keeps a triangle below the cut and drops one above it', () => {
    const g = triangles([
      [0, 0, 0], [1, 0, 0], [0, 0.5, 0],
      [0, 2, 0], [1, 2, 0], [0, 3, 0],
    ]);
    const out = trimAbove(g, identity, 1, all);
    expect(triangleCount(out)).toBe(1);
    expect(maxY(out)).toBeCloseTo(0.5, 6);
  });

  it('clips a straddling triangle so its part below the cut stays', () => {
    const out = trimAbove(triangles([[0, 0, 0], [1, 0, 0], [0, 2, 0]]), identity, 1, all);
    expect(maxY(out)).toBeCloseTo(1, 6);
    expect(area(out)).toBeCloseTo(0.75, 6);
  });

  it('leaves triangles outside the region untouched, even above the cut', () => {
    const g = triangles([
      [0, 2, -1], [1, 2, -1], [0, 3, -1],
      [0, 2, 1], [1, 2, 1], [0, 3, 1],
    ]);
    const out = trimAbove(g, identity, 1, (w) => w.z > 0);
    expect(triangleCount(out)).toBe(1);
    expect(maxY(out)).toBeCloseTo(3, 6);
  });

  it('trims a triangle that reaches into the region from outside it', () => {
    // like the String shelf board that ends inside the shared ladder: one end outside the region, the rest inside
    const g = triangles([[0, 2, -0.2], [0, 2, 1], [0, 3, 1]]);
    const out = trimAbove(g, identity, 1, (w) => w.z > 0);
    expect(triangleCount(out)).toBe(0);
  });

  it('applies the cut in world space', () => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(2, 2, 2),
    );
    // world y = 0.5 + 2 · local y, so a cut at world 1.5 keeps local y ≤ 0.5
    const out = trimAbove(triangles([[0, 0, 0], [1, 0, 0], [0, 2, 0]]), matrix, 1.5, all);
    expect(maxY(out)).toBeCloseTo(0.5, 6);
  });

  it('interpolates normals and uvs at the cut', () => {
    const out = trimAbove(
      triangles([[0, 0, 0], [1, 0, 0], [0, 2, 0]], [[0, 0], [1, 0], [0, 1]]),
      identity,
      1,
      all,
    );
    const pos = out.getAttribute('position');
    const uv = out.getAttribute('uv');
    const normal = out.getAttribute('normal');
    expect(uv).toBeDefined();
    let atCut = 0;
    for (let i = 0; i < pos.count; i++) {
      expect(normal.getZ(i)).toBeCloseTo(1, 6);
      if (Math.abs(pos.getY(i) - 1) < 1e-6) {
        atCut++;
        expect(uv.getY(i)).toBeCloseTo(0.5, 6);
      }
    }
    expect(atCut).toBeGreaterThan(0);
  });
});
