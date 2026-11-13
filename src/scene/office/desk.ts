import type * as THREE from 'three';
import type { Kit } from '../bedroom/kit';
import { DESK, DESK_X, DESK_Z, DRAWERS, LIFT } from './dimensions';

export interface DeskMaterials {
  top: THREE.Material;
  steel: THREE.Material;
  front: THREE.Material;
}

/** IDÅSEN desk: dark top on a dark steel T-leg frame. */
export function buildDesk({ box }: Kit, m: DeskMaterials): void {
  const { w, d, h, top } = DESK;
  box(d, top, w, m.top, DESK_X, h - top / 2, DESK_Z);
  const legH = h - top;
  for (const dz of [-w / 2 + 0.04, w / 2 - 0.04]) {
    box(d - 0.1, 0.04, 0.04, m.steel, DESK_X, 0.02 + LIFT, DESK_Z + dz);
    box(0.04, legH - 0.04, 0.04, m.steel, DESK_X, 0.04 + (legH - 0.04) / 2, DESK_Z + dz);
  }
}

/** IDÅSEN drawer unit: a steel box with three drawer fronts facing the chair. */
export function buildDrawers({ box }: Kit, m: DeskMaterials): void {
  const { w, d, h, x, z } = DRAWERS;
  box(d, h, w, m.steel, x, h / 2 + LIFT, z);
  const fh = (h - 0.04) / 3;
  for (let i = 0; i < 3; i++) box(0.012, fh - 0.01, w - 0.03, m.front, x - d / 2 - 0.006, 0.02 + LIFT + fh * (i + 0.5), z);
}
