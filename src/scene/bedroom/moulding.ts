import * as THREE from 'three';
import type { MouldShop } from '../../state/mouldShop';
import type { BedroomMoulding } from '../../state/settings';
import type { BedroomSection } from '../../state/mould';
import { mergeMeshes } from '../merge';
import { drawRail, drawSection } from '../mouldStrips';
import { mouldProfile, mouldRoom } from '../mouldProfile';
import { BEDROOM_MOULD_WALLS, wallLayouts, type MouldWallDef } from '../mouldWalls';
import type { Kit } from './kit';
import { BEDX, L } from './dimensions';
import type { BedroomMaterials } from './materials';
import { tagOption } from '../options';

export interface MouldWallParts {
  readonly parts: readonly THREE.Object3D[];
  /** rebuilds the wall when its layout changed */
  layout(s: BedroomMoulding, shop: MouldShop): void;
}

/** a wall's strips stand out of the wall at `wallZ`, towards `face` (+1 = +z), as deep as the moulding product is */
function mouldWall(
  { box, parent }: Kit,
  def: MouldWallDef<BedroomSection>,
  material: THREE.Material,
  wallZ: number,
  face: 1 | -1,
): MouldWallParts {
  let parts: THREE.Object3D[] = [];
  let lastKey = '';
  return {
    get parts(): readonly THREE.Object3D[] {
      return parts;
    },
    layout(s, shop) {
      const profile = mouldProfile(shop);
      const layouts = wallLayouts(def, mouldRoom(s, shop), s.mouldWalls, BEDX);
      const key = JSON.stringify([layouts, profile]);
      if (key === lastKey) return;
      lastKey = key;
      for (const p of parts) {
        parent.remove(p);
        if (p instanceof THREE.Mesh) p.geometry.dispose();
      }
      parts = [];
      const strip = (w: number, h: number, x: number, y: number, d = profile.frameDepth) => {
        parts.push(box(w, h, d, material, x, y, wallZ + (face * d) / 2, true));
      };
      for (const l of layouts) drawSection(strip, l, profile.frameWidth);
      drawRail(strip, def.rail, layouts[0].rows.rail, profile.railDepth);
      parts = mergeMeshes(parts);
      tagOption(parts, 'bedroom', ['moulding', def.sections[0].key]);
    },
  };
}

/** Bed-wall moulding (back wall) and dresser-wall moulding (front wall), laid out by the shared moulding layout. */
export function bedroomMoulding(k: Kit, m: BedroomMaterials): { bed: MouldWallParts; dresser: MouldWallParts } {
  const [bed, dresser] = BEDROOM_MOULD_WALLS;
  return {
    bed: mouldWall(k, bed, m.mouldBed, -L / 2, 1),
    dresser: mouldWall(k, dresser, m.mouldDresser, L / 2, -1),
  };
}
