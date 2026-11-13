import type * as THREE from 'three';
import type { Kit } from '../bedroom/kit';
import { CABINET, CABINET_X, CABINET_Z, LIFT } from './dimensions';

const LINE = 0.003;

/** Two stacks of a high METOD cabinet with two top cabinets: flat fronts, 3 mm gap lines, plinth in the same paint. */
export function buildCabinets({ box }: Kit, paint: THREE.Material, gap: THREE.Material): void {
  const { w, d, h, plinth, topH, tops } = CABINET;
  const front = CABINET_Z + d / 2;
  for (const x of CABINET_X) {
    box(w - 0.04, plinth, d - 0.06, paint, x, plinth / 2 + LIFT, CABINET_Z - 0.03);
    box(w, h, d, paint, x, plinth + h / 2, CABINET_Z);
    /* the two doors of the high cabinet */
    box(LINE, h - 0.02, LINE, gap, x, plinth + h / 2, front + LINE / 2, true);
    let y = plinth + h;
    for (let i = 0; i < tops; i++) {
      box(w, LINE, LINE, gap, x, y, front + LINE / 2, true);
      box(w, topH, d, paint, x, y + topH / 2, CABINET_Z);
      y += topH;
    }
  }
}
