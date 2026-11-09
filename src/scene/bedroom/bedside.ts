import * as THREE from 'three';
import { BRASS } from '../../data/catalog';
import { std } from '../materials';
import { mergeMeshes } from '../merge';
import type { Kit } from './kit';
import { ADINA_SHADE_Y, ADINA_STEM_OUT, BEDX, L, LOW_Y0, LOW_Y1 } from './dimensions';
import { bulb, glowShade, type Bulb } from './lamps';
import type { BedroomMaterials } from './materials';

export interface Bedside {
  /** slide table `i` (0 = left, 1 = right) and its lamp to x */
  moveTo(i: number, x: number): void;
  setEvening(on: boolean): void;
  lamps: Bulb[];
}

/**
 * Wall-hung bedside tables (AC Design Cholet, 50 × 35 × 25 cm), one each side of the bed, each with a Mio Adina wall
 * lamp above it. They start 1.32 m either side of the bed; the bed-wall moulding moves them into its side panels.
 */
export function buildBedside({ add, box, collect, parent }: Kit, m: BedroomMaterials): Bedside {
  const tableX = [BEDX - 1.32, BEDX + 1.32];
  const lampBrass = std(BRASS, 0.55, 0.5); // brushed: rougher and duller than the polished brass handles
  const lampCord = std('#1F1F1D', 0.7, 0);
  const lampShade = std('#DCCDAE', 0.95);
  lampShade.side = THREE.DoubleSide;
  const lampBulb = new THREE.MeshBasicMaterial({ color: 0xffe6b8 });
  const parts = tableX.map((x) =>
    mergeMeshes(collect(() => {
      const zc = -L / 2 + 0.175;
      /* 24 cm tall, centred inside the lower panel's frame so it sits clear of the rail and the frame strips */
      const TOP = (LOW_Y0 + LOW_Y1) / 2 + 0.12;
      box(0.5, 0.02, 0.35, m.oak, x, TOP - 0.01, zc);
      box(0.5, 0.02, 0.35, m.oak, x, TOP - 0.24, zc);
      for (const o of [-0.24, 0.24]) box(0.02, 0.21, 0.35, m.oak, x + o, TOP - 0.125, zc);
      box(0.46, 0.21, 0.01, m.oakDeep, x, TOP - 0.125, -L / 2 + 0.005);
      box(0.46, 0.07, 0.02, m.oak, x, TOP - 0.055, zc + 0.165);
      box(0.46, 0.015, 0.32, m.oak, x, TOP - 0.0975, zc);
      add(new THREE.SphereGeometry(0.012, 12, 10), m.brass, x, TOP - 0.055, zc + 0.185);
      /* Mio Adina, H26 × B18 cm, in brushed brass: round wall disc, a short arm out to a vertical stem, a tapered
         textile shade on top of the stem, and a black cord with an inline switch down to the table */
      const wz = -L / 2;
      const sz = wz + ADINA_STEM_OUT;
      const shadeY0 = ADINA_SHADE_Y - 0.06;
      const lampY0 = shadeY0 + 0.12 - 0.26; // bottom of the stem: 26 cm below the top of the shade
      const armY = shadeY0 + 0.12 - 0.173;
      const disc = add(new THREE.CylinderGeometry(0.055, 0.055, 0.022, 40), lampBrass, x, armY, wz + 0.011);
      disc.rotation.x = Math.PI / 2;
      const arm = add(new THREE.CylinderGeometry(0.005, 0.005, ADINA_STEM_OUT - 0.022, 10), lampBrass, x, armY, wz + (0.022 + ADINA_STEM_OUT) / 2);
      arm.rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.006, 0.006, shadeY0 - lampY0, 12), lampBrass, x, (shadeY0 + lampY0) / 2, sz);
      add(new THREE.CylinderGeometry(0.013, 0.013, 0.026, 16), lampBrass, x, shadeY0 + 0.013, sz, true); // bulb socket
      add(new THREE.CylinderGeometry(0.058, 0.09, 0.12, 40, 1, true), lampShade, x, ADINA_SHADE_Y, sz);
      add(new THREE.SphereGeometry(0.02, 12, 10), lampBulb, x, shadeY0 + 0.045, sz, true);
      /* cord from the bottom of the disc down the wall to the table top, with the inline switch */
      const cordX = x + 0.012;
      const cordTop = armY - 0.05;
      add(new THREE.CylinderGeometry(0.0025, 0.0025, cordTop - TOP, 6), lampCord, cordX, (cordTop + TOP) / 2, wz + 0.004, true);
      box(0.022, 0.06, 0.016, lampCord, cordX, cordTop - 0.22, wz + 0.01, true);
    })),
  );
  const lamps = tableX.map((x) => bulb(parent, x, ADINA_SHADE_Y - 0.015, -L / 2 + ADINA_STEM_OUT, 7, 0.35, 0.35));
  return {
    lamps,
    moveTo(i, x) {
      const dx = x - tableX[i];
      tableX[i] = x;
      for (const p of parts[i]) p.position.x += dx;
      lamps[i].moveX(x);
    },
    setEvening(on) {
      for (const l of lamps) l.set(on);
      glowShade(lampShade, on);
    },
  };
}
