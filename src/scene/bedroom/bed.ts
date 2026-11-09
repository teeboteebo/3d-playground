import * as THREE from 'three';
import { weaveTexture } from '../textures';
import type { Kit } from './kit';
import { BEDX, L } from './dimensions';
import type { BedroomMaterials } from './materials';

/** IKEA TONSTAD 160×200 bed, the ILVA Amigo bench at its foot, and five pillows, centred on BEDX against the back wall. */
export function buildBed({ add, box, collect }: Kit, m: BedroomMaterials): THREE.Object3D[] {
  const bz0 = -L / 2;
  const BF = 0.15;
  const parts = collect(() => {
    for (const [x, z] of [[-0.78, bz0 + 0.1], [0.78, bz0 + 0.1], [-0.78, bz0 + 2.0], [0.78, bz0 + 2.0]]) {
      box(0.06, BF, 0.06, m.oak, x, BF / 2, z);
    }
    box(0.045, 0.3, 2.05, m.oak, -0.8225, 0.19 + BF, bz0 + 0.04 + 1.025);
    box(0.045, 0.3, 2.05, m.oak, 0.8225, 0.19 + BF, bz0 + 0.04 + 1.025);
    for (const sx of [-1, 1]) {
      for (const z of [bz0 + 0.04 + 0.5, bz0 + 0.04 + 1.5]) box(0.014, 0.2, 0.95, m.oakDeep, sx * 0.851, 0.15 + BF, z);
    }
    box(1.6, 0.03, 2.0, m.oakDeep, 0, 0.265 + BF, bz0 + 0.04 + 1.0);
    box(1.69, 1.16 + BF - 0.18, 0.04, m.oak, 0, 0.18 + (1.16 + BF - 0.18) / 2, bz0 + 0.02); // headboard above the 18 cm skirting
    box(1.69, 0.46, 0.03, m.oak, 0, 0.23 + BF, bz0 + 2.09 - 0.015);
    box(1.6, 0.2, 2.0, m.mattress, 0, 0.38 + BF, bz0 + 0.04 + 1.0);
    box(1.64, 0.07, 1.35, m.bedding, 0, 0.515 + BF, -0.625);
    box(0.04, 0.22, 1.35, m.bedding, -0.82, 0.4 + BF, -0.625);
    box(0.04, 0.22, 1.35, m.bedding, 0.82, 0.4 + BF, -0.625);
    box(1.66, 0.085, 0.38, m.throwBlanket, 0, 0.52 + BF, -0.26);
    box(1.66, 0.2, 0.012, m.throwBlanket, 0, 0.41 + BF, -0.07);

    /* bench: 90 x 35 x 45 cm, solid oak, woven seat, low shelf */
    const weaveMat = new THREE.MeshStandardMaterial({ map: weaveTexture(), roughness: 0.9 });
    const bzc = bz0 + 2.09 + 0.02 + 0.175;
    const BW = 0.9;
    const BD = 0.35;
    const BH = 0.45;
    for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      add(new THREE.CylinderGeometry(0.021, 0.019, BH, 14), m.oak, qx * (BW / 2 - 0.03), BH / 2, bzc + qz * (BD / 2 - 0.03));
    }
    for (const sz of [-1, 1]) box(BW - 0.04, 0.06, 0.025, m.oak, 0, BH - 0.05, bzc + sz * (BD / 2 - 0.03));
    for (const sx of [-1, 1]) box(0.025, 0.06, BD - 0.04, m.oak, sx * (BW / 2 - 0.03), BH - 0.05, bzc);
    box(BW - 0.09, 0.022, BD - 0.09, weaveMat, 0, BH - 0.045, bzc);
    for (const k of [-1, 0, 1]) box(BW - 0.07, 0.022, 0.07, m.oak, 0, 0.17, bzc + k * 0.09);

    const pillows: [number, number, number, number, number, number, number][] = [
      // w, h, d, x, y, z, tilt
      [0.62, 0.16, 0.62, -0.4, 0.75, -1.6, -0.45],
      [0.62, 0.16, 0.62, 0.4, 0.75, -1.6, -0.45],
      [0.72, 0.13, 0.48, -0.4, 0.73, -1.3, -0.2],
      [0.72, 0.13, 0.48, 0.4, 0.73, -1.3, -0.2],
      [0.5, 0.1, 0.22, 0, 0.78, -1.1, -0.1],
    ];
    pillows.forEach(([w, h, d, x, y, z, tilt], i) => {
      add(pillowGeo(w, h, d), m.pillows[i], x, y, z).rotation.x = tilt;
    });
  });
  for (const p of parts) p.position.x += BEDX;
  return parts;
}

/** a pillow: a sphere squared off towards a cushion, w × h × d */
function pillowGeo(w: number, h: number, d: number) {
  const g = new THREE.SphereGeometry(0.5, 28, 18);
  const p = g.attributes.position;
  const shape = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * 2;
    const y = p.getY(i) * 2;
    const z = p.getZ(i) * 2;
    p.setXYZ(i, (shape(x, 0.55) * w) / 2, (shape(y, 0.75) * h) / 2, (shape(z, 0.55) * d) / 2);
  }
  g.computeVertexNormals();
  return g;
}
