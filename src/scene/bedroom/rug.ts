import * as THREE from 'three';
import { RUG_SIZE, RUGS, findById } from '../../data/catalog';
import { lin } from '../materials';
import { canvasTexture, getRugCanvases } from '../textures';
import type { Kit } from './kit';
import { BEDX, L } from './dimensions';
import type { BedroomMaterials } from './materials';

/** The 200 × 300 cm rug under the bed, its edge 4 cm in front of the bench. Shows the chosen rug's texture. */
export function buildRug({ parent }: Kit, m: BedroomMaterials) {
  const top = new THREE.MeshStandardMaterial({ roughness: 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.018, 1), [m.rugSide, m.rugSide, top, m.rugSide, m.rugSide, m.rugSide]);
  mesh.receiveShadow = true;
  mesh.rotation.y = Math.PI / 2;
  mesh.scale.set(RUG_SIZE.w, 1, RUG_SIZE.l);
  mesh.position.set(BEDX, 0.011, -L / 2 + 0.5 + RUG_SIZE.w / 2);
  parent.add(mesh);
  const textures = new Map<string, THREE.CanvasTexture>();
  const texture = (id: string) => {
    let t = textures.get(id);
    const c = getRugCanvases()[id];
    if (!t && c) textures.set(id, (t = canvasTexture(c)));
    return t ?? null;
  };
  return {
    set(rug: string) {
      const tex = rug === 'none' ? null : texture(rug);
      mesh.visible = !!tex;
      if (tex) {
        top.map = tex;
        top.needsUpdate = true;
        m.rugSide.color.copy(lin(findById(RUGS, rug).edge));
      }
    },
    /** the textures of rugs not currently shown are not in the scene, so free them all here */
    dispose() {
      for (const t of textures.values()) t.dispose();
    },
  };
}
