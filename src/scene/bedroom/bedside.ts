import * as THREE from 'three';
import { BRASS } from '../../data/catalog';
import { std } from '../materials';
import { mergeMeshes } from '../merge';
import type { Kit } from './kit';
import { ADINA_SHADE_Y, ADINA_STEM_OUT, L, NIGHTSTAND, NIGHTSTAND_X } from './dimensions';
import { bulb, glowShade, type Bulb } from './lamps';
import type { BedroomMaterials } from './materials';

export interface Bedside {
  setEvening(on: boolean): void;
  lamps: Bulb[];
}

/**
 * Wall-hung bedside tables (AC Design Cholet, 40 × 23 × 30 cm), one each side of the bed, each with a Mio Adina wall
 * lamp centred above it. They stand at fixed distances from the window wall and the wardrobes (`NIGHTSTAND_X`).
 */
export function buildBedside({ add, box, collect, parent }: Kit, m: BedroomMaterials): Bedside {
  const lampBrass = std(BRASS, 0.55, 0.5); // brushed: rougher and duller than the polished brass handles
  const lampCord = std('#1F1F1D', 0.7, 0);
  const lampShade = std('#DCCDAE', 0.95);
  lampShade.side = THREE.DoubleSide;
  const lampBulb = new THREE.MeshBasicMaterial({ color: 0xffe6b8 });
  const { w, h, d, y0 } = NIGHTSTAND;
  mergeMeshes(NIGHTSTAND_X.flatMap((x) =>
    collect(() => {
      const zc = -L / 2 + d / 2;
      const TOP = y0 + h;
      box(w, 0.02, d, m.oak, x, TOP - 0.01, zc);
      box(w, 0.02, d, m.oak, x, y0 + 0.01, zc);
      for (const o of [-(w / 2 - 0.01), w / 2 - 0.01]) box(0.02, h - 0.04, d, m.oak, x + o, y0 + h / 2, zc);
      box(w - 0.04, h - 0.04, 0.01, m.oakDeep, x, y0 + h / 2, -L / 2 + 0.005);
      box(w - 0.04, 0.07, 0.02, m.oak, x, TOP - 0.055, zc + d / 2 - 0.01);
      box(w - 0.04, 0.015, d - 0.03, m.oak, x, y0 + h / 2 - 0.0075, zc);
      add(new THREE.SphereGeometry(0.012, 12, 10), m.brass, x, TOP - 0.055, zc + d / 2 + 0.01);
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
    }),
  ));
  const lamps = NIGHTSTAND_X.map((x) => bulb(parent, x, ADINA_SHADE_Y - 0.015, -L / 2 + ADINA_STEM_OUT, 7, 0.35, 0.35));
  return {
    lamps,
    setEvening(on) {
      for (const l of lamps) l.set(on);
      glowShade(lampShade, on);
    },
  };
}
