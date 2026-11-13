import * as THREE from 'three';
import { PAINTS, findById } from '../../data/catalog';
import { roomById } from '../../data/rooms';
import type { Settings } from '../../state/settings';
import { kit, type Kit } from '../bedroom/kit';
import { lin, std } from '../materials';
import { mergeMeshes } from '../merge';
import { buildCabinets } from './cabinets';
import { buildChair } from './chair';
import { buildDesk, buildDrawers } from './desk';

export interface Office {
  apply(s: Settings): void;
  dispose(): void;
}

/** The office's furniture, built by hand into `parent`: two cabinet stacks, desk, drawer unit and chair. */
export function buildOffice(parent: THREE.Object3D): Office {
  const cabinet = std(findById(PAINTS, roomById('office').paint).hex, 0.85);
  cabinet.name = 'office-cabinet';
  const gap = std('#1E1E1E', 1);
  const desk = { top: std('#3B3A38', 0.6), steel: std('#2B2B2B', 0.5, 0.5), front: std('#333333', 0.5, 0.5) };
  const fabric = std('#C9B8A0', 0.8);
  /* each piece is its own group, so its meshes merge on their own and its footprint can be told apart */
  const piece = (name: string, build: (k: Kit) => void) => {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    const k = kit(g);
    mergeMeshes(k.collect(() => build(k)));
  };
  piece('office-cabinets', (k) => buildCabinets(k, cabinet, gap));
  piece('office-desk', (k) => buildDesk(k, desk));
  piece('office-drawers', (k) => buildDrawers(k, desk));
  piece('office-chair', (k) => buildChair(k, fabric, desk.steel));
  return {
    apply(s) {
      cabinet.color.copy(lin(findById(PAINTS, s.walls.office).hex));
    },
    dispose() {},
  };
}
