import * as THREE from 'three';
import { TV_BENCH } from '../data/catalog';
import { kit } from './bedroom/kit';
import { std } from './materials';
import { mergeMeshes } from './merge';
import { woodTexture } from './textures';

/** the String shelving's beige: its shelves' wood colour in shelving.glb ("string furniture hout"), here with grain */
const SHELF_BEIGE = '#C1AA8F';

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

/** a knob: its round head and the neck that holds it off the front, metres */
const KNOB = { r: 0.016, t: 0.012, neckR: 0.006, neck: 0.014 };

/** the fronts' layout: each front's centre x, bottom and top (scene metres) and width, and where each knob sits */
export interface SideboardLayout {
  fronts: { kind: 'door' | 'drawer'; x: number; y0: number; y1: number; w: number }[];
  knobs: [number, number][];
}

/**
 * Seen from the front, three columns: a door, a door, and three drawers. The doors open from the middle, so their
 * knobs sit high on each, 5 cm from the seam between them; each drawer has one knob in its centre.
 */
export function sideboardLayout(): SideboardLayout {
  const { x0, w, h } = TV_BENCH;
  const fy0 = LEG_H + INSET;
  const fy1 = h - TOP_T - INSET;
  const colW = (w - 2 * INSET - 2 * GAP) / 3;
  /* columns from the front's left (+x, seen facing the wall) to its right */
  const colX = (i: number) => x0 + w - INSET - (i * (colW + GAP) + colW / 2);
  const knobY = fy1 - 0.08;
  const drawerH = (fy1 - fy0 - 2 * GAP) / 3;
  const drawers = [0, 1, 2].map((d) => fy0 + d * (drawerH + GAP));
  return {
    fronts: [
      { kind: 'door', x: colX(0), y0: fy0, y1: fy1, w: colW },
      { kind: 'door', x: colX(1), y0: fy0, y1: fy1, w: colW },
      ...drawers.map((y0) => ({ kind: 'drawer' as const, x: colX(2), y0, y1: y0 + drawerH, w: colW })),
    ],
    knobs: [
      [colX(0) - colW / 2 + 0.05, knobY],
      [colX(1) + colW / 2 - 0.05, knobY],
      ...drawers.map((y0): [number, number] => [colX(2), y0 + drawerH / 2]),
    ],
  };
}

/**
 * The living room's TV sideboard (see `TV_BENCH`), in the bedroom dresser's style, in the String shelving's beige
 * with a wood grain: legs, a slightly deeper-toned body, a top that overhangs by a centimetre, and fronts with a dark
 * round knob each (see `sideboardLayout`). Built in scene coordinates, its front facing the room (−z).
 */
export function sideboard(): THREE.Group {
  const g = new THREE.Group();
  const k = kit(g);
  const wood = woodTexture(SHELF_BEIGE);
  const oak = new THREE.MeshStandardMaterial({ roughness: 0.6, map: wood });
  const oakDeep = new THREE.MeshStandardMaterial({ roughness: 0.65, color: new THREE.Color(0.9, 0.9, 0.9), map: wood });
  const knob = std('#3A2D20', 0.5);

  const { x0, w, h } = TV_BENCH;
  const cx = x0 + w / 2;
  const bodyD = DEPTH - FRONT_T - 0.005;
  const bodyZ = BACK_Z - bodyD / 2;
  const frontZ = BACK_Z - bodyD - FRONT_T / 2;
  const face = frontZ - FRONT_T / 2;
  const bodyY0 = LEG_H;
  const bodyY1 = h - TOP_T;
  const { fronts, knobs } = sideboardLayout();

  const parts = k.collect(() => {
    for (const lx of [x0 + 0.05, x0 + w - 0.05]) {
      for (const lz of [BACK_Z - 0.05, BACK_Z - bodyD + 0.05]) k.box(LEG, LEG_H, LEG, oak, lx, LEG_H / 2, lz);
    }
    k.box(w, bodyY1 - bodyY0, bodyD, oakDeep, cx, (bodyY0 + bodyY1) / 2, bodyZ);
    k.box(w + 0.02, TOP_T, DEPTH + 0.01, oak, cx, h - TOP_T / 2, BACK_Z - (DEPTH + 0.01) / 2);
    for (const f of fronts) k.box(f.w, f.y1 - f.y0, FRONT_T, oak, f.x, (f.y0 + f.y1) / 2, frontZ);
    /* each knob: a neck out of the front, and a round head on it, both along −z (+y turns to +z, so the head's wider
       end faces the room) */
    for (const [x, y] of knobs) {
      k.add(new THREE.CylinderGeometry(KNOB.neckR, KNOB.neckR, KNOB.neck, 12), knob, x, y, face - KNOB.neck / 2, true).rotation.x = Math.PI / 2;
      k.add(new THREE.CylinderGeometry(KNOB.r * 0.85, KNOB.r, KNOB.t, 20), knob, x, y, face - KNOB.neck - KNOB.t / 2, true).rotation.x = Math.PI / 2;
    }
  });
  mergeMeshes(parts);
  return g;
}
