import * as THREE from 'three';
import { FRAMES, findById } from '../../data/catalog';
import type { Settings } from '../../state/settings';
import { lin, std } from '../materials';
import { artTexture } from '../textures';
import type { Kit } from './kit';
import { DRESSER_X, DRESSER_Z, L, MIRROR_X } from './dimensions';
import { bulb, glowShade } from './lamps';
import type { BedroomMaterials } from './materials';

/** Mio TOVA dresser (80 × 42 × 100 cm) in the front-left corner, with a table lamp, a vase and a tray. */
export function buildDresser({ add, box }: Kit, m: BedroomMaterials): void {
  const dcx = DRESSER_X;
  const dcz = DRESSER_Z;
  const dfz = dcz - 0.21;
  const slotMat = std('#3A2D20', 1);
  for (const [qx, qz] of [[-0.35, -0.15], [0.35, -0.15], [-0.35, 0.15], [0.35, 0.15]]) box(0.04, 0.2, 0.04, m.oak, dcx + qx, 0.1, dcz + qz);
  box(0.8, 0.77, 0.42, m.oakDeep, dcx, 0.585, dcz);
  box(0.82, 0.03, 0.44, m.oak, dcx, 0.985, dcz);
  for (let di = 0; di < 5; di++) {
    const dy = 0.283 + di * 0.153;
    box(0.76, 0.142, 0.02, m.oak, dcx, dy, dfz - 0.005);
    box(0.26, 0.012, 0.006, slotMat, dcx, dy + 0.045, dfz - 0.018, true);
  }
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 20), m.brass, dcx - 0.2, 1.11, dcz);
  m.shade.side = THREE.DoubleSide;
  add(new THREE.CylinderGeometry(0.11, 0.16, 0.2, 24, 1, true), m.shade, dcx - 0.2, 1.32, dcz);
  add(new THREE.CylinderGeometry(0.055, 0.07, 0.24, 20), m.vase, dcx + 0.22, 1.12, dcz);
  box(0.12, 0.03, 0.18, m.trim, dcx + 0.02, 1.015, dcz);
}

/** Full-length mirror on the front wall, left of the dresser. */
export function buildMirror({ parent }: Kit, m: BedroomMaterials): THREE.Group {
  const mirror = new THREE.Group();
  const mf = new THREE.Mesh(new THREE.BoxGeometry(0.59, 1.74, 0.03), m.oak);
  mf.castShadow = mf.receiveShadow = true;
  const mg = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.7), m.mirror);
  mg.rotation.y = Math.PI;
  mg.position.z = -0.0166;
  mirror.add(mf, mg);
  mirror.position.set(MIRROR_X, 1.15, L / 2 - 0.02);
  parent.add(mirror);
  return mirror;
}

/** The framed painting above the dresser. */
export function buildPainting({ box, collect }: Kit, m: BedroomMaterials): THREE.Object3D[] {
  return collect(() => {
    const py = 1.95;
    box(0.9, 0.64, 0.04, m.frame, DRESSER_X, py, L / 2 - 0.02);
    box(0.78, 0.52, 0.01, m.mat, DRESSER_X, py, L / 2 - 0.045, true);
    box(0.66, 0.418, 0.008, m.art, DRESSER_X, py, L / 2 - 0.052, true);
  });
}

/** The dresser lamp's light. */
export function dresserLamp(parent: THREE.Object3D) {
  return bulb(parent, DRESSER_X - 0.2, 1.3, DRESSER_Z, 8, 0.55, 0.5);
}

/** Repaints the painting (its picture and frame) and the vase for the settings. */
export function paintingApplier(m: BedroomMaterials) {
  let artKey = '';
  return (s: Settings, evening: boolean) => {
    m.vase.color.copy(lin(s.accent));
    if (artKey !== `${s.art}|${s.accent}`) {
      artKey = `${s.art}|${s.accent}`;
      m.art.map?.dispose();
      m.art.map = artTexture(s.art, s.accent);
      m.art.needsUpdate = true;
    }
    const fr = findById(FRAMES, s.frame);
    m.frame.color.copy(lin(fr.hex));
    m.frame.metalness = s.frame === 'brass' ? 0.4 : 0;
    m.frame.roughness = s.frame === 'brass' ? 0.4 : 0.7;
    m.mirror.color.setScalar(evening ? 0.35 : 1);
    glowShade(m.shade, evening);
  };
}
