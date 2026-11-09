import * as THREE from 'three';
import { lin, std } from '../materials';
import type { Kit } from './kit';
import { H, PENDANT_Y } from './dimensions';
import { glowShade } from './lamps';
import type { BedroomMaterials } from './materials';

/** IKEA GULLSUDARE 70 cm rice-paper pendant at the centre of the room, hung with about 2 m clearance below. */
export function buildPendant({ add, collect, parent }: Kit, m: BedroomMaterials) {
  const paper = new THREE.MeshStandardMaterial({ color: lin('#F4F1E8'), roughness: 1, side: THREE.DoubleSide });
  const parts = collect(() => {
    const pg = new THREE.SphereGeometry(0.35, 56, 36);
    const pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const px = pp.getX(i);
      const py = pp.getY(i);
      const pz = pp.getZ(i);
      const rr = Math.hypot(px, pz);
      if (rr > 0.001) {
        const k = 1 + 0.012 * Math.sin(Math.atan2(pz, px) * 28) * Math.min(1, rr / 0.35);
        pp.setXYZ(i, px * k, py, pz * k);
      }
    }
    pg.computeVertexNormals();
    add(pg, paper, 0, PENDANT_Y, 0, true);
    add(new THREE.CylinderGeometry(0.004, 0.004, H - (PENDANT_Y + 0.35), 6), std('#EDEBE4', 0.8), 0, (H + PENDANT_Y + 0.35) / 2, 0, true);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), m.trim, 0, H - 0.015, 0, true);
    add(new THREE.SphereGeometry(0.05, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe6b8 }), 0, PENDANT_Y, 0, true);
  });
  const light = new THREE.PointLight(0xffc890, 0, 9, 1.3);
  light.position.set(0, PENDANT_Y, 0);
  light.shadow.mapSize.set(256, 256);
  light.shadow.radius = 16;
  light.shadow.camera.near = 0.05;
  light.shadow.camera.far = 9;
  light.shadow.bias = -0.002;
  parent.add(light);
  return {
    /** hung or taken down; lit (with shadows) only in the evening */
    set(hung: boolean, evening: boolean) {
      for (const p of parts) p.visible = hung;
      light.intensity = evening && hung ? 0.7 : 0;
      light.castShadow = evening && hung;
      glowShade(paper, evening, 0xffc27a, 0.7);
    },
  };
}
