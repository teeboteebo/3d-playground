import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';

/**
 * Replaces many small meshes with one mesh per material (and shadow setting), baking each mesh's transform into
 * the merged geometry, so the scene draws a handful of meshes instead of hundreds. Only for parts that never move
 * on their own: the merged meshes can still be moved, hidden or shown together. A mesh with nothing to merge
 * with, or with several materials, is left as it is. Returns the meshes that now stand for `objects`.
 */
export function mergeMeshes(objects: readonly THREE.Object3D[]): THREE.Object3D[] {
  const buckets = new Map<string, THREE.Mesh[]>();
  const result: THREE.Object3D[] = [];
  for (const o of objects) {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || !o.parent || o.children.length) {
      result.push(o);
      continue;
    }
    const key = `${o.parent.uuid}|${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.visible}`;
    const b = buckets.get(key);
    if (b) b.push(o);
    else buckets.set(key, [o]);
  }
  for (const meshes of buckets.values()) {
    if (meshes.length === 1) {
      result.push(meshes[0]);
      continue;
    }
    const geos = meshes.map((o) => {
      o.updateMatrix();
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrix);
      g.clearGroups();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      return g;
    });
    const first = meshes[0];
    const merged = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(geos), first.material);
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.visible = first.visible;
    first.parent!.add(merged);
    for (const g of geos) g.dispose();
    for (const o of meshes) {
      o.parent!.remove(o);
      o.geometry.dispose();
    }
    result.push(merged);
  }
  return result;
}
