import * as THREE from 'three';
import type { BedroomSettings } from '../../state/settings';
import type { BedroomSection } from '../../state/mould';
import { mergeMeshes } from '../merge';
import { drawRail, drawSection } from '../mouldStrips';
import { BEDROOM_MOULD_WALLS, wallLayouts, type MouldWallDef } from '../mouldWalls';
import type { Kit } from './kit';
import { BEDX, FRAME_T, L } from './dimensions';
import type { BedroomMaterials } from './materials';

export interface MouldWallParts {
  readonly parts: readonly THREE.Object3D[];
  /** rebuilds the wall when its layout changed */
  layout(s: BedroomSettings): void;
}

/** how far the bed-wall strips stand out of the wall, m */
export const BED_WALL_STRIP_DEPTH = 0.014;

/** a wall's strips stand `depth` out of the wall at `wallZ`, towards `face` (+1 = +z) */
function mouldWall(
  { box, parent }: Kit,
  def: MouldWallDef<BedroomSection>,
  material: THREE.Material,
  wallZ: number,
  face: 1 | -1,
  depth: number,
  railDepth: number,
): MouldWallParts {
  let parts: THREE.Object3D[] = [];
  let lastKey = '';
  return {
    get parts(): readonly THREE.Object3D[] {
      return parts;
    },
    layout(s) {
      const layouts = wallLayouts(def, { spacing: s.mouldSpacing, dado: s.mouldDado }, s.mouldWalls, BEDX);
      const key = JSON.stringify(layouts);
      if (key === lastKey) return;
      lastKey = key;
      for (const p of parts) {
        parent.remove(p);
        if (p instanceof THREE.Mesh) p.geometry.dispose();
      }
      parts = [];
      const strip = (w: number, h: number, x: number, y: number, d = depth) => {
        parts.push(box(w, h, d, material, x, y, wallZ + (face * d) / 2, true));
      };
      for (const l of layouts) drawSection(strip, l, FRAME_T);
      drawRail(strip, def.rail, layouts[0].rows.rail, railDepth);
      parts = mergeMeshes(parts);
    },
  };
}

/** Bed-wall moulding (back wall) and dresser-wall moulding (front wall), laid out by the shared moulding layout. */
export function bedroomMoulding(k: Kit, m: BedroomMaterials): { bed: MouldWallParts; dresser: MouldWallParts } {
  const [bed, dresser] = BEDROOM_MOULD_WALLS;
  return {
    bed: mouldWall(k, bed, m.mouldBed, -L / 2, 1, BED_WALL_STRIP_DEPTH, 0.02),
    dresser: mouldWall(k, dresser, m.mouldDresser, L / 2, -1, 0.009, 0.012),
  };
}
