import * as THREE from 'three';
import type { Kit } from './kit';
import { DOOR_H, DOOR_Z0, DOOR_Z1, FRONT_DOOR_H, FRONT_DOOR_W, FRONT_DOOR_X, L, W } from './dimensions';
import type { BedroomMaterials } from './materials';

/*
 * The bedroom's walls, floor, ceiling and skirting are built from its outline with the rest of the apartment
 * (buildApartment.ts); these are the fittings of its two door openings.
 */

/** The open doorway to the hall (east wall): just its frame, no doors. */
export function buildHallDoorway({ box, collect }: Kit, m: BedroomMaterials): THREE.Object3D[] {
  return collect(() => {
    const postH = DOOR_H + 0.02;
    box(0.03, postH, 0.07, m.trim, W / 2 - 0.015, postH / 2, DOOR_Z0 - 0.035);
    box(0.03, postH, 0.07, m.trim, W / 2 - 0.015, postH / 2, DOOR_Z1 + 0.035);
    box(0.03, 0.07, DOOR_Z1 - DOOR_Z0 + 0.14, m.trim, W / 2 - 0.015, DOOR_H + 0.035, (DOOR_Z0 + DOOR_Z1) / 2);
  });
}

/** The closed door in the front (south) wall, left of the dresser seen from inside: slab, frame and handle. */
export function buildFrontDoor({ add, box, collect }: Kit, m: BedroomMaterials): THREE.Object3D[] {
  const x = FRONT_DOOR_X;
  const post = FRONT_DOOR_W / 2 + 0.035;
  return collect(() => {
    box(FRONT_DOOR_W - 0.04, FRONT_DOOR_H - 0.02, 0.04, m.trim, x, (FRONT_DOOR_H - 0.02) / 2, L / 2 - 0.04);
    box(0.07, FRONT_DOOR_H + 0.02, 0.03, m.trim, x - post, (FRONT_DOOR_H + 0.02) / 2, L / 2 - 0.015);
    box(0.07, FRONT_DOOR_H + 0.02, 0.03, m.trim, x + post, (FRONT_DOOR_H + 0.02) / 2, L / 2 - 0.015);
    box(FRONT_DOOR_W + 0.14, 0.07, 0.03, m.trim, x, FRONT_DOOR_H + 0.035, L / 2 - 0.015);
    add(new THREE.SphereGeometry(0.03, 16, 12), m.brass, x - 0.3, 1.0, L / 2 - 0.085);
  });
}
