import * as THREE from 'three';
import type { Kit } from '../bedroom/kit';
import { CHAIR, LIFT } from './dimensions';

const BACK_T = 0.07;
const BACK_R = 0.6;

/** The padded back: a thin, slightly curved band (concave towards +x) of the seat's width, `h` high. */
function backGeometry(width: number, h: number): THREE.BufferGeometry {
  const a = Math.asin(width / 2 / BACK_R);
  const shape = new THREE.Shape();
  shape.absarc(BACK_R, 0, BACK_R, Math.PI - a, Math.PI + a, false);
  shape.absarc(BACK_R, 0, BACK_R - BACK_T, Math.PI + a, Math.PI - a, true);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 8 });
  /* extruded along z; stand it up along y */
  return g.rotateX(-Math.PI / 2);
}

/** IKEA ALEFJÄLL, simplified, facing +x: padded seat and back, no armrests, dark five-star base with castors and a gas stem. */
export function buildChair({ add, box }: Kit, fabric: THREE.Material, base: THREE.Material): void {
  const { x, z, seat, seatW, seatD, baseR, height } = CHAIR;
  const castorR = 0.025;
  const reach = baseR - castorR;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = box(reach, 0.03, 0.045, base, x + Math.cos(a) * reach * 0.5, 0.075, z - Math.sin(a) * reach * 0.5);
    arm.rotation.y = a;
    add(new THREE.CylinderGeometry(castorR, castorR, 0.05, 10), base, x + Math.cos(a) * reach, 0.025 + LIFT, z - Math.sin(a) * reach);
  }
  const seatT = 0.1;
  add(new THREE.CylinderGeometry(0.03, 0.04, seat - seatT - 0.09, 12), base, x, 0.09 + (seat - seatT - 0.09) / 2, z);
  box(seatD, seatT, seatW, fabric, x, seat - seatT / 2, z);
  const backBottom = seat + 0.06;
  add(backGeometry(seatW, height - backBottom), fabric, x - seatD / 2 - BACK_T - 0.01, backBottom, z);
}
