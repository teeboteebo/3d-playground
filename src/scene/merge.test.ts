import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mergeMeshes } from './merge';

describe('mergeMeshes', () => {
  it('draws many meshes as one per material and shadow setting, in the same places', () => {
    const scene = new THREE.Scene();
    const a = new THREE.MeshStandardMaterial();
    const b = new THREE.MeshStandardMaterial();
    const box = (mat: THREE.Material, x: number, cast = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
      m.position.x = x;
      m.castShadow = cast;
      scene.add(m);
      return m;
    };
    const parts = [box(a, 0), box(a, 5), box(b, 10), box(a, 20, false)];
    const merged = mergeMeshes(parts);
    expect(merged).toHaveLength(3);
    expect(scene.children).toHaveLength(3);
    expect(merged).toContain(parts[2]); // alone in its bucket: kept as it is
    expect(merged).toContain(parts[3]);
    const first = merged.find((m): m is THREE.Mesh => m instanceof THREE.Mesh && m.material === a && m.castShadow)!;
    first.geometry.computeBoundingBox();
    expect(first.geometry.boundingBox!.min.x).toBeCloseTo(-0.5);
    expect(first.geometry.boundingBox!.max.x).toBeCloseTo(5.5);
  });

  it('leaves meshes with several materials as they are', () => {
    const scene = new THREE.Scene();
    const multi = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);
    scene.add(multi);
    expect(mergeMeshes([multi])).toEqual([multi]);
    expect(scene.children).toEqual([multi]);
  });
});
