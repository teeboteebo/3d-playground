import * as THREE from 'three';
import { PAINTS, findById } from '../../data/catalog';
import type { OfficeComponentId } from '../../data/office';
import { roomById } from '../../data/rooms';
import type { Settings } from '../../state/settings';
import { kit, type Kit } from '../bedroom/kit';
import { lin, std } from '../materials';
import { mergeMeshes } from '../merge';
import { buildCabinets } from './cabinets';
import { buildChair } from './chair';
import { buildCorner } from './corner';
import { buildDesk, buildDrawers } from './desk';
import { tagOption } from '../options';

export interface Office {
  apply(s: Settings): void;
  dispose(): void;
}

/**
 * The office's furniture, built by hand into `parent`: two cabinet stacks, desk, drawer unit and chair, and the
 * reading corner's chosen armchair, dresser and round rug (placed on `apply`).
 */
export function buildOffice(parent: THREE.Object3D): Office {
  const cabinet = std(findById(PAINTS, roomById('office').paint).hex, 0.85);
  cabinet.name = 'office-cabinet';
  const gap = std('#1E1E1E', 1);
  const desk = { top: std('#3B3A38', 0.6), steel: std('#2B2B2B', 0.5, 0.5), front: std('#333333', 0.5, 0.5) };
  const fabric = std('#C9B8A0', 0.8);
  /* each piece is its own group, so its meshes merge on their own and its footprint can be told apart */
  const pieces = {} as Record<'cabinets' | 'desk' | 'drawers' | 'desk-chair', THREE.Group>;
  const piece = (name: string, id: keyof typeof pieces & OfficeComponentId, build: (k: Kit) => void) => {
    const g = new THREE.Group();
    g.name = name;
    /* each piece is described on its own page */
    tagOption([g], 'office', [id]);
    pieces[id] = g;
    parent.add(g);
    const k = kit(g);
    mergeMeshes(k.collect(() => build(k)));
  };
  piece('office-cabinets', 'cabinets', (k) => buildCabinets(k, cabinet, gap));
  piece('office-desk', 'desk', (k) => buildDesk(k, desk));
  piece('office-drawers', 'drawers', (k) => buildDrawers(k, desk));
  piece('office-chair', 'desk-chair', (k) => buildChair(k, fabric, desk.steel));
  const corner = buildCorner(parent);
  return {
    apply(s) {
      cabinet.color.copy(lin(findById(PAINTS, s.walls.office).hex));
      for (const id of Object.keys(pieces) as (keyof typeof pieces)[]) pieces[id].visible = s.office.components[id].shown;
      corner.apply(s);
    },
    dispose() {
      corner.dispose();
    },
  };
}
