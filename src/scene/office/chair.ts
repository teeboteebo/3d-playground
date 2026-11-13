import * as THREE from 'three';
import type { Kit } from '../bedroom/kit';
import { CHAIR, LIFT } from './dimensions';

/** Desk chair facing +x: five-star base, gas stem, seat and backrest. */
export function buildChair({ add, box }: Kit, fabric: THREE.Material, base: THREE.Material): void {
  const { x, z, seat, seatW, seatD, baseR, backH } = CHAIR;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = box(baseR, 0.03, 0.045, base, x + Math.cos(a) * baseR * 0.5, 0.075, z - Math.sin(a) * baseR * 0.5);
    arm.rotation.y = a;
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 10), base, x + Math.cos(a) * baseR, 0.025 + LIFT, z - Math.sin(a) * baseR);
  }
  add(new THREE.CylinderGeometry(0.03, 0.04, seat - 0.15, 12), base, x, 0.09 + (seat - 0.15) / 2, z);
  box(seatD, 0.08, seatW, fabric, x, seat - 0.04, z);
  box(0.06, backH, seatW - 0.02, fabric, x - seatD / 2 - 0.02, seat + 0.04 + backH / 2, z);
}
