import * as THREE from 'three';
import { OAK, TV_BENCH } from '../data/catalog';
import { kit } from './bedroom/kit';
import { std } from './materials';
import { mergeMeshes } from './merge';
import { woodTexture } from './textures';

/** the sideboard's depth, and the z of its back: 16 mm off the TV wall, where the old bench model stood */
const DEPTH = 0.48;
const BACK_Z = 2.709;
/** legs, top slab and the fronts' thickness, gaps and inset from the body's edges */
const LEG_H = 0.15;
const LEG = 0.04;
const TOP_T = 0.03;
const FRONT_T = 0.02;
const GAP = 0.004;
const INSET = 0.015;

/**
 * The living room's TV sideboard (see `TV_BENCH`), in the bedroom dresser's style: oak legs, a deeper-toned oak body,
 * an oak top that overhangs by a centimetre, and oak fronts with a dark slot to pull each one. Seen from the front,
 * three columns: a door, a door, and three drawers. Built in scene coordinates, its front facing the room (−z).
 */
export function sideboard(): THREE.Group {
  const g = new THREE.Group();
  const k = kit(g);
  const wood = woodTexture(OAK.hex);
  const oak = new THREE.MeshStandardMaterial({ roughness: 0.6, map: wood });
  const oakDeep = new THREE.MeshStandardMaterial({ roughness: 0.65, color: new THREE.Color(0.8, 0.8, 0.8), map: wood });
  const slot = std('#3A2D20', 1);

  const { x0, w, h } = TV_BENCH;
  const cx = x0 + w / 2;
  const bodyD = DEPTH - FRONT_T - 0.005;
  const bodyZ = BACK_Z - bodyD / 2;
  const frontZ = BACK_Z - bodyD - FRONT_T / 2;
  const bodyY0 = LEG_H;
  const bodyY1 = h - TOP_T;

  const parts = k.collect(() => {
    for (const lx of [x0 + 0.05, x0 + w - 0.05]) {
      for (const lz of [BACK_Z - 0.05, BACK_Z - bodyD + 0.05]) k.box(LEG, LEG_H, LEG, oak, lx, LEG_H / 2, lz);
    }
    k.box(w, bodyY1 - bodyY0, bodyD, oakDeep, cx, (bodyY0 + bodyY1) / 2, bodyZ);
    k.box(w + 0.02, TOP_T, DEPTH + 0.01, oak, cx, h - TOP_T / 2, BACK_Z - (DEPTH + 0.01) / 2);

    /* the fronts: three columns across, the door columns one front tall, the drawer column three */
    const fx0 = x0 + INSET;
    const fy0 = bodyY0 + INSET;
    const fy1 = bodyY1 - INSET;
    const colW = (w - 2 * INSET - 2 * GAP) / 3;
    const front = (x: number, y0: number, y1: number, fw: number) => {
      k.box(fw, y1 - y0, FRONT_T, oak, x, (y0 + y1) / 2, frontZ);
      /* the pull: a dark slot near the top of the front, as on the dresser's drawers */
      k.box(Math.min(0.26, fw * 0.5), 0.012, 0.006, slot, x, y1 - 0.035, frontZ - FRONT_T / 2 - 0.002, true);
    };
    /* columns from the front's left (+x, seen facing the wall) to its right */
    const colX = (i: number) => fx0 + w - 2 * INSET - (i * (colW + GAP) + colW / 2);
    front(colX(0), fy0, fy1, colW);
    front(colX(1), fy0, fy1, colW);
    const drawerH = (fy1 - fy0 - 2 * GAP) / 3;
    for (let d = 0; d < 3; d++) {
      const y0 = fy0 + d * (drawerH + GAP);
      front(colX(2), y0, y0 + drawerH, colW);
    }
  });
  mergeMeshes(parts);
  return g;
}
