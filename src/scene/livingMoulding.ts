import * as THREE from 'three';
import { PAINTS, TRIM, findById } from '../data/catalog';
import type { XZ } from '../data/rooms';
import type { LivingSettings, Settings } from '../state/settings';
import { FRAME_T, LOW_Y0, LOW_Y1, RAIL_Y } from './bedroom/dimensions';
import { kit } from './bedroom/kit';
import { gridLayout, wallLayout } from './layout';
import { lin } from './materials';
import { mergeMeshes } from './merge';

export interface LivingMoulding {
  apply(s: Settings): void;
  dispose(): void;
}

/** where a wall's columns go (absolute x), and what the wall is rebuilt on */
interface Columns {
  key: string;
  columns: [number, number][];
}

interface WallSpec {
  name: string;
  /** z of the wall face, and the direction the strips stand out of it (+1 = towards +z) */
  z: number;
  face: 1 | -1;
  /** the rail's x extent, and the line the wall is attached to */
  x0: number;
  x1: number;
  centre: number;
  columns: (s: LivingSettings) => Columns;
  on: (s: LivingSettings) => boolean;
}

/** three columns centred on `centre`, laid out by `wallLayout` */
function threeColumns(centre: number, halfSpan: number, minCentre: number) {
  return (s: LivingSettings): Columns => {
    const l = wallLayout(s.mouldCentre, s.mouldGap, s.mouldSide, halfSpan, minCentre);
    return {
      key: `${l.centreHalf}|${l.gap}|${l.sideWidth}`,
      columns: l.columns.map(([a, b]): [number, number] => [centre + a, centre + b]),
    };
  };
}

const WALLS: WallSpec[] = [
  {
    name: 'living-mould-sofa', z: -1.925, face: 1, x0: 3.69, x1: 8.69, centre: 5.855,
    columns: (s) => ({
      key: `${s.mouldSofaColumns}|${s.mouldSofaGap}`,
      columns: gridLayout(3.69, 8.69, s.mouldSofaColumns, s.mouldSofaGap),
    }),
    on: (s) => s.mouldSofaWall === 'on',
  },
  /* the TV (x 4.85–6.31) stays clear: the centre column is never narrower than 1.66 m */
  {
    name: 'living-mould-tv', z: 2.725, face: -1, x0: 3.69, x1: 7.376, centre: 5.58,
    columns: threeColumns(5.58, 1.75, 1.66),
    on: (s) => s.mouldTvWall === 'on',
  },
];

type Strip = (w: number, h: number, x: number, y: number) => void;

/** a rectangular frame of four strips whose outer edge is x0..x1 by y0..y1 */
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
 * Moulding on the living room's sofa wall and TV wall: a rail at 75 cm and three columns of framed panels, centred
 * on the sofa and on the TV. Each wall hangs in a wrapper group that the apartment shows and hides with its wall (it
 * is attached once, so a rebuild never changes it); the strips sit in an inner group that follows the wall's setting.
 */
export function buildLivingMoulding(
  parent: THREE.Object3D,
  attach: (onWall: XZ, parts: THREE.Object3D[]) => void,
): LivingMoulding {
  const walls = WALLS.map((spec) => {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    material.name = spec.name;
    const wrapper = new THREE.Group();
    wrapper.name = spec.name;
    const inner = new THREE.Group();
    wrapper.add(inner);
    parent.add(wrapper);
    attach([spec.centre, spec.z], [wrapper]);
    return { spec, material, wrapper, inner, key: '' };
  });

  function rebuild(w: (typeof walls)[number], s: LivingSettings) {
    const { spec, material, inner } = w;
    const { key, columns } = spec.columns(s);
    if (key === w.key) return;
    w.key = key;
    for (const p of [...inner.children]) {
      inner.remove(p);
      if (p instanceof THREE.Mesh) p.geometry.dispose();
    }
    const { box } = kit(inner);
    const strip = (sw: number, h: number, x: number, y: number, d = 0.012) => {
      box(sw, h, d, material, x, y, spec.z + (spec.face * d) / 2, true);
    };
    strip(spec.x1 - spec.x0, 0.04, (spec.x0 + spec.x1) / 2, RAIL_Y, 0.014);
    for (const [c0, c1] of columns) {
      frameOf(strip, c0, c1, LOW_Y0, LOW_Y1);
      frameOf(strip, c0, c1, RAIL_Y + 0.08, 3.0);
    }
    mergeMeshes(inner.children);
  }

  return {
    apply(settings) {
      const s = settings.living;
      const paint = findById(PAINTS, settings.walls.living).hex;
      for (const w of walls) {
        w.material.color.copy(lin(s.mouldColour === 'tone' ? paint : TRIM.hex));
        if (s.mouldColour === 'tone') w.material.color.multiplyScalar(0.82);
        rebuild(w, s);
        w.inner.visible = w.spec.on(s);
      }
    },
    dispose() {
      for (const w of walls) {
        parent.remove(w.wrapper);
        w.wrapper.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
        w.material.dispose();
      }
    },
  };
}
