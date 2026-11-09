import * as THREE from 'three';

/** Small helpers for building the bedroom straight into a parent (the scene). */
export interface Kit {
  /** a mesh at (x, y, z); casts and receives shadows unless `noCast` */
  add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, noCast?: boolean): THREE.Mesh;
  /** a box mesh of size w × h × d centred at (x, y, z) */
  box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, noCast?: boolean): THREE.Mesh;
  /** runs `build` and returns every object it added to the parent */
  collect(build: () => void): THREE.Object3D[];
  parent: THREE.Object3D;
}

export function kit(parent: THREE.Object3D): Kit {
  function add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, noCast = false) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !noCast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  return {
    parent,
    add,
    box: (w, h, d, mat, x, y, z, noCast = false) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, noCast),
    collect(build) {
      const n0 = parent.children.length;
      build();
      return parent.children.slice(n0);
    },
  };
}

export const setVisible = (parts: readonly THREE.Object3D[], v: boolean) => {
  for (const m of parts) m.visible = v;
};
