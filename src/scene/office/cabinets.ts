import type * as THREE from 'three';
import type { Kit } from '../bedroom/kit';
import { CABINET, CABINET_X, CABINET_Z, LIFT } from './dimensions';

const LINE = 0.003;

/** Two stacks of a high METOD cabinet with two top cabinets: flat fronts (facing +x), 3 mm gap lines, plinth in the same paint. */
export function buildCabinets({ box }: Kit, paint: THREE.Material, gap: THREE.Material): void {
  const { w, d, h, plinth, topH, tops } = CABINET;
  const front = CABINET_X + d / 2;
  for (const z of CABINET_Z) {
    box(d - 0.06, plinth, w - 0.04, paint, CABINET_X - 0.03, plinth / 2 + LIFT, z);
    box(d, h, w, paint, CABINET_X, plinth + h / 2, z);
    /* the two doors of the high cabinet */
    box(LINE, h - 0.02, LINE, gap, front + LINE / 2, plinth + h / 2, z, true);
    let y = plinth + h;
    for (let i = 0; i < tops; i++) {
      box(LINE, LINE, w, gap, front + LINE / 2, y, z, true);
      box(d, topH, w, paint, CABINET_X, y + topH / 2, z);
      y += topH;
    }
  }
}
