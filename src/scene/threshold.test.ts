import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { OPENINGS } from '../data/rooms';
import { buildApartment } from './buildApartment';

describe('thresholds', () => {
  const threshold = new THREE.MeshStandardMaterial();
  const apartment = buildApartment({
    trim: new THREE.MeshStandardMaterial(),
    glass: new THREE.MeshBasicMaterial(),
    floor: () => new THREE.MeshStandardMaterial(),
    threshold,
  });
  apartment.group.updateMatrixWorld(true);
  const passages = OPENINGS.filter((o) => o.kind === 'passage');

  it.each(passages.map((o) => [`${o.a.join(',')} → ${o.b.join(',')}`, o] as const))(
    'covers the floor through the doorway at %s with oak, 12 mm up',
    (_, o) => {
      const [x, z] = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(apartment.group, true)[0];
      expect(hit?.object instanceof THREE.Mesh && hit.object.material).toBe(threshold);
      expect(hit.point.y).toBeCloseTo(0.012);
    },
  );

  it('reaches 1 cm past both faces of the wall', () => {
    const o = passages[0];
    const [x, z] = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
    /* the first passage runs along z through an x-facing wall, so its depth is along x */
    expect(o.a[0]).toBe(o.b[0]);
    for (const dx of [o.depth / 2 + 0.005, -(o.depth / 2 + 0.005)]) {
      const hit = new THREE.Raycaster(new THREE.Vector3(x + dx, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(apartment.group, true)[0];
      expect(hit?.object instanceof THREE.Mesh && hit.object.material).toBe(threshold);
    }
  });
});
