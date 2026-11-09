import * as THREE from 'three';
import type { Kit } from './kit';
import { L, W } from './dimensions';
import type { BedroomMaterials } from './materials';

/** Two built-in IKEA Pax wardrobes along the east wall, 1 m wide each, with two doors and brass handles. */
export function buildWardrobes({ add, box }: Kit, m: BedroomMaterials): void {
  for (const [z0, z1] of [[-L / 2, -L / 2 + 1], [-L / 2 + 1, -L / 2 + 2]]) {
    const zc = (z0 + z1) / 2;
    box(0.58, 3.0, 1.0, m.wardrobe, W / 2 - 0.29, 1.5, zc);
    for (const i of [0, 1]) {
      const zd = z0 + 0.01 + i * 0.495;
      box(0.02, 2.36, 0.485, m.wardrobe, W / 2 - 0.58, 1.25, zd + 0.2425);
      box(0.02, 0.5, 0.485, m.wardrobe, W / 2 - 0.58, 2.72, zd + 0.2425);
    }
    for (const o of [-0.04, 0.04]) {
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 10), m.brass, W / 2 - 0.6, 1.05, zc + o);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 10), m.brass, W / 2 - 0.6, 2.6, zc + o);
    }
  }
}
