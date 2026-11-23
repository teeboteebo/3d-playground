import * as THREE from 'three';

/** one Box3 per strip of a merged mesh: merged boxes are 36 non-indexed vertices each */
export function strips(mesh: THREE.Mesh): THREE.Box3[] {
  const pos = mesh.geometry.attributes.position;
  const out: THREE.Box3[] = [];
  for (let i = 0; i < pos.count; i += 36) {
    const b = new THREE.Box3();
    for (let j = i; j < i + 36; j++) b.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, j));
    out.push(b);
  }
  return out;
}
