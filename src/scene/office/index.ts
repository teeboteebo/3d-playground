import * as THREE from 'three';
import { PAINTS, findById } from '../../data/catalog';
import type { Settings } from '../../state/settings';
import { kit } from '../bedroom/kit';
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
  const k = kit(parent);
  const cabinet = std('#D8CDBB', 0.85);
  cabinet.name = 'office-cabinet';
  const gap = std('#1E1E1E', 1);
  const desk = { top: std('#3B3A38', 0.6), steel: std('#2B2B2B', 0.5, 0.5), front: std('#333333', 0.5, 0.5) };
  const fabric = std('#3A3D40', 1);
  mergeMeshes(k.collect(() => buildCabinets(k, cabinet, gap)));
  mergeMeshes(k.collect(() => buildDesk(k, desk)));
  mergeMeshes(k.collect(() => buildDrawers(k, desk)));
  mergeMeshes(k.collect(() => buildChair(k, fabric, desk.steel)));
  return {
    apply(s) {
      cabinet.color.copy(lin(findById(PAINTS, s.walls.office).hex));
    },
    dispose() {},
  };
}
