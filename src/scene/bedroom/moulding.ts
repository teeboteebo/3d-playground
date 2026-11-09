import * as THREE from 'three';
import type { Settings } from '../../state/settings';
import { bedWallLayout } from '../layout';
import type { Kit } from './kit';
import { BEDX, FRAME_T, FRONT_DOOR_X0, FRONT_DOOR_X1, L, LOW_Y0, LOW_Y1, MIRROR_HALF, MIRROR_X, RAIL_Y, W } from './dimensions';
import type { BedroomMaterials } from './materials';

type Strip = (w: number, h: number, x: number, y: number) => void;

/** a rectangular frame of four strips, inset so its outer edge is x0..x1 by y0..y1 */
function frameOf(strip: Strip, x0: number, x1: number, y0: number, y1: number) {
  const t = FRAME_T;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  strip(x1 - x0, t, cx, y0 + t / 2);
  strip(x1 - x0, t, cx, y1 - t / 2);
  strip(t, y1 - y0 - 2 * t, x0 + t / 2, cy);
  strip(t, y1 - y0 - 2 * t, x1 - t / 2, cy);
}

/**
 * Bed-wall moulding: a rail at 75 cm and three columns of panels, big above the rail and small below. The layout
 * follows the moulding sliders, and the bedside tables ride in the side columns (`onTables` gets their x).
 */
export function bedWallMoulding({ box, parent }: Kit, m: BedroomMaterials, onTables: (left: number, right: number) => void) {
  let parts: THREE.Mesh[] = [];
  let lastLayout = '';
  const strip = (w: number, h: number, x: number, y: number, d = 0.014) => {
    parts.push(box(w, h, d, m.mouldBed, x, y, -L / 2 + d / 2, true));
  };
  return {
    get parts(): readonly THREE.Object3D[] {
      return parts;
    },
    layout(s: Settings) {
      const layout = bedWallLayout(s.mcen, s.mgap, s.msw);
      const key = `${layout.centreHalf}|${layout.gap}|${layout.sideWidth}`;
      if (key === lastLayout) return;
      lastLayout = key;
      for (const p of parts) {
        parent.remove(p);
        p.geometry.dispose();
      }
      parts = [];
      strip(W, 0.04, 0, RAIL_Y, 0.02);
      for (const [x0, x1] of layout.columns) {
        frameOf(strip, BEDX + x0, BEDX + x1, LOW_Y0, LOW_Y1);
        frameOf(strip, BEDX + x0, BEDX + x1, RAIL_Y + 0.08, 3.0);
      }
      onTables(BEDX - layout.tableOffset, BEDX + layout.tableOffset);
    },
  };
}

/** Dresser-wall moulding: a rail and frames in the free sections of the front wall, around the mirror and door. */
export function dresserWallMoulding({ box, collect }: Kit, m: BedroomMaterials): THREE.Object3D[] {
  return collect(() => {
    const strip = (w: number, h: number, x: number, y: number, d = 0.009) => box(w, h, d, m.mouldDresser, x, y, L / 2 - d / 2, true);
    for (const [r0, r1] of [[-W / 2, -1.75], [-0.95, MIRROR_X - MIRROR_HALF], [MIRROR_X + MIRROR_HALF, FRONT_DOOR_X0], [FRONT_DOOR_X1, W / 2]]) {
      if (r1 > r0) strip(r1 - r0, 0.04, (r0 + r1) / 2, RAIL_Y, 0.012);
    }
    for (const [c0, c1] of [[-1.9, -0.8], [1.485, 2.05]]) {
      frameOf(strip, c0, c1, LOW_Y0, LOW_Y1);
      frameOf(strip, c0, c1, RAIL_Y + 0.08, 3.0);
    }
  });
}

