import * as THREE from 'three';
import { PAINTS, TRIM, findById } from '../data/catalog';
import type { XZ } from '../data/rooms';
import type { LivingSettings, Settings } from '../state/settings';
import type { LivingSection } from '../state/mould';
import { FRAME_T } from './bedroom/dimensions';
import { kit } from './bedroom/kit';
import { lin } from './materials';
import { mergeMeshes } from './merge';
import { drawRail, drawSection } from './mouldStrips';
import { LIVING_MOULD_WALLS, wallLayouts, type MouldWallDef } from './mouldWalls';
import { tagOption } from './options';

export interface LivingMoulding {
  apply(s: Settings): void;
  dispose(): void;
}

interface WallSpec {
  name: string;
  /** z of the wall face, and the direction the strips stand out of it (+1 = towards +z) */
  z: number;
  face: 1 | -1;
  /** the line the wall is attached to */
  centre: number;
  def: MouldWallDef<LivingSection>;
}

const [SOFA, TV] = LIVING_MOULD_WALLS;
const WALLS: WallSpec[] = [
  { name: 'living-mould-sofa', z: -1.925, face: 1, centre: 5.855, def: SOFA },
  { name: 'living-mould-tv', z: 2.725, face: -1, centre: 5.58, def: TV },
];

/**
 * Moulding on the living room's sofa wall and TV wall: a rail and columns of framed panels, laid out by the shared
 * moulding layout (one spacing on every side; the walls' columns and fixed column come from the settings). Each
 * wall hangs in a wrapper group that the apartment shows and hides with its wall (it is attached once, so a rebuild
 * never changes it); the strips sit in an inner group that follows the wall's setting.
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
    tagOption([wrapper], 'living', ['moulding', spec.def.sections[0].key]);
    const inner = new THREE.Group();
    wrapper.add(inner);
    parent.add(wrapper);
    attach([spec.centre, spec.z], [wrapper]);
    return { spec, material, wrapper, inner, key: '' };
  });

  function rebuild(w: (typeof walls)[number], s: LivingSettings) {
    const { spec, material, inner } = w;
    const layouts = wallLayouts(spec.def, { spacing: s.mouldSpacing, dado: s.mouldDado }, s.mouldWalls);
    const key = JSON.stringify(layouts);
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
    for (const l of layouts) drawSection(strip, l, FRAME_T);
    drawRail(strip, spec.def.rail, layouts[0].rows.rail, 0.014);
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
        w.inner.visible = s[w.spec.def.toggle as 'mouldSofaWall' | 'mouldTvWall'] === 'on';
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
