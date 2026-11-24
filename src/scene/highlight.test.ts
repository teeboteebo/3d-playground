import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { highlighter } from './highlight';
import { tagOption } from './options';

/** a scene with one mesh per path in the bedroom, each its own material */
function scene(...paths: string[][]) {
  const root = new THREE.Group();
  const meshes = paths.map((path) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
    tagOption([m], 'bedroom', path);
    root.add(m);
    return m;
  });
  return { root, meshes };
}
const own = (m: THREE.Mesh, before: THREE.Material) => m.material === before;

describe('highlighter', () => {
  it('tints only the option itself', () => {
    const { root, meshes } = scene(['moulding', 'bed'], ['moulding', 'dresser'], ['rug']);
    const before = meshes.map((m) => m.material as THREE.Material);
    highlighter(root, () => {}).set({ kind: 'option', option: { room: 'bedroom', path: ['moulding', 'bed'] } });
    expect(meshes.map((m, i) => own(m, before[i]))).toEqual([false, true, true]);
  });

  it('tints every option under it when asked to', () => {
    const { root, meshes } = scene(['moulding', 'bed'], ['moulding', 'dresser'], ['rug']);
    const before = meshes.map((m) => m.material as THREE.Material);
    const h = highlighter(root, () => {});
    h.set({ kind: 'option', option: { room: 'bedroom', path: ['moulding'] }, within: true });
    expect(meshes.map((m, i) => own(m, before[i]))).toEqual([false, false, true]);
    h.set(null);
    expect(meshes.map((m, i) => own(m, before[i]))).toEqual([true, true, true]);
  });

  it('takes in nothing from another room', () => {
    const { root, meshes } = scene(['rug']);
    const before = meshes[0].material as THREE.Material;
    highlighter(root, () => {}).set({ kind: 'option', option: { room: 'office', path: ['rug'] }, within: true });
    expect(own(meshes[0], before)).toBe(true);
  });
});
