import * as THREE from 'three';
import type { Kit } from './kit';
import { DOOR_H, DOOR_Z0, DOOR_Z1, H, L, W, WARD_END, WIN_SPRING, WIN_W, WIN_Y0, WIN_Z } from './dimensions';
import type { BedroomMaterials } from './materials';

/** an arched window's outline in a wall's plane, centred on `cx` */
export function archPath<P extends THREE.Path>(P: P, cx: number): P {
  P.moveTo(cx - WIN_W / 2, WIN_Y0);
  P.lineTo(cx + WIN_W / 2, WIN_Y0);
  P.lineTo(cx + WIN_W / 2, WIN_SPRING);
  P.absarc(cx, WIN_SPRING, WIN_W / 2, 0, Math.PI, false);
  P.lineTo(cx - WIN_W / 2, WIN_Y0);
  return P;
}

/**
 * Floor, four single-sided walls facing in (window arches in the west wall, the doorway to the hall in the east,
 * the door in the south) and an invisible ceiling that still casts shadows.
 */
export function buildShell({ parent }: Kit, m: BedroomMaterials): void {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), m.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  parent.add(floor);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m.wall);
  back.position.set(0, H / 2, -L / 2);
  back.receiveShadow = back.castShadow = true;
  parent.add(back);

  function wall(points: [number, number][], holes: THREE.Path[] = [], segments = 12) {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) s.lineTo(x, y);
    s.holes = holes;
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s, segments), m.wall);
    mesh.receiveShadow = mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const left = wall(
    [[-L / 2, 0], [L / 2, 0], [L / 2, H], [-L / 2, H], [-L / 2, 0]],
    WIN_Z.map((z) => archPath(new THREE.Path(), -z)),
    24,
  );
  left.rotation.y = Math.PI / 2;
  left.position.set(-W / 2, 0, 0);

  const right = wall([
    [-L / 2, 0], [DOOR_Z0, 0], [DOOR_Z0, DOOR_H], [DOOR_Z1, DOOR_H], [DOOR_Z1, 0], [L / 2, 0], [L / 2, H], [-L / 2, H], [-L / 2, 0],
  ]);
  right.rotation.y = -Math.PI / 2;
  right.position.set(W / 2, 0, 0);

  const front = wall([[-W / 2, 0], [-1.35, 0], [-1.35, 2.58], [-0.45, 2.58], [-0.45, 0], [W / 2, 0], [W / 2, H], [-W / 2, H], [-W / 2, 0]]);
  front.rotation.y = Math.PI;
  front.position.set(0, 0, L / 2);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.2, L + 0.2),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, 0);
  ceil.castShadow = true;
  parent.add(ceil);
}

/** Skirting along the bed wall, the window wall and the east wall either side of the doorway. */
export function buildSkirting({ box }: Kit, m: BedroomMaterials): void {
  box(W - 0.58, 0.18, 0.02, m.trim, -0.29, 0.09, -L / 2 + 0.01);
  box(0.02, 0.18, L, m.trim, -W / 2 + 0.01, 0.09, 0);
  /* east wall: from the end of the wardrobes to the doorway, and from the doorway to the corner */
  box(0.02, 0.18, DOOR_Z0 - WARD_END, m.trim, W / 2 - 0.01, 0.09, (WARD_END + DOOR_Z0) / 2);
  box(0.02, 0.18, L / 2 - DOOR_Z1, m.trim, W / 2 - 0.01, 0.09, (DOOR_Z1 + L / 2) / 2);
}

/** The open doorway to the hall (east wall): just its frame, no doors. */
export function buildHallDoorway({ box, collect }: Kit, m: BedroomMaterials): THREE.Object3D[] {
  return collect(() => {
    const postH = DOOR_H + 0.02;
    box(0.03, postH, 0.07, m.trim, W / 2 - 0.015, postH / 2, DOOR_Z0 - 0.035);
    box(0.03, postH, 0.07, m.trim, W / 2 - 0.015, postH / 2, DOOR_Z1 + 0.035);
    box(0.03, 0.07, DOOR_Z1 - DOOR_Z0 + 0.14, m.trim, W / 2 - 0.015, DOOR_H + 0.035, (DOOR_Z0 + DOOR_Z1) / 2);
  });
}

/** The door in the front wall, left of the dresser, and the front wall's skirting. */
export function buildFrontDoor({ add, box, collect }: Kit, m: BedroomMaterials): THREE.Object3D[] {
  return collect(() => {
    box(0.86, 2.56, 0.04, m.trim, 0.9, 1.28, L / 2 - 0.04);
    box(0.07, 2.6, 0.03, m.trim, 0.9 - 0.485, 1.3, L / 2 - 0.015);
    box(0.07, 2.6, 0.03, m.trim, 0.9 + 0.485, 1.3, L / 2 - 0.015);
    box(1.04, 0.07, 0.03, m.trim, 0.9, 2.615, L / 2 - 0.015);
    add(new THREE.SphereGeometry(0.03, 16, 12), m.brass, 0.6, 1.0, L / 2 - 0.085);
    box(2.6, 0.18, 0.02, m.trim, -0.85, 0.09, L / 2 - 0.01);
    box(0.8, 0.18, 0.02, m.trim, 1.75, 0.09, L / 2 - 0.01);
  });
}
