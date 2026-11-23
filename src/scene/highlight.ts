import * as THREE from 'three';
import { lin } from './materials';
import { optionOf, sameOption, type SceneOption } from './options';

/** the tint a hovered option takes on: the UI's accent, so it reads on white moulding and dark furniture alike */
const TINT = lin('#E39577');

export interface Highlight {
  /** tints every object of `option` (none when null) */
  set(option: SceneOption | null): void;
  /** tints again after the scene changed (a setting rebuilt or recoloured parts) */
  refresh(): void;
  dispose(): void;
}

/**
 * Highlights the objects of one menu option under `root`. Each object gets a tinted copy of its material while it is
 * highlighted and its own back afterwards, so materials shared with other objects are never changed.
 */
export function highlighter(root: THREE.Object3D, invalidate: () => void): Highlight {
  let current: SceneOption | null = null;
  /* each tinted mesh: its own material and the tinted copy it shows instead */
  const swapped = new Map<THREE.Mesh, { own: THREE.Material | THREE.Material[]; shown: THREE.Material | THREE.Material[] }>();
  const copies: THREE.Material[] = [];

  const tinted = (m: THREE.Material): THREE.Material => {
    const c = m.clone();
    /* clone() leaves out shader patches (the sofa's triplanar fabric), so the copy draws like its material */
    c.onBeforeCompile = m.onBeforeCompile;
    c.customProgramCacheKey = m.customProgramCacheKey;
    const colour = (c as THREE.MeshStandardMaterial).color;
    if (colour) colour.lerp(TINT, 0.4);
    const glow = (c as THREE.MeshStandardMaterial).emissive;
    if (glow) {
      glow.copy(TINT).multiplyScalar(0.12);
      (c as THREE.MeshStandardMaterial).emissiveIntensity = 1;
    }
    copies.push(c);
    return c;
  };

  function clear() {
    /* a mesh whose material was replaced meanwhile (the sofa's fabric arriving) keeps the new one */
    for (const [mesh, { own, shown }] of swapped) if (mesh.material === shown) mesh.material = own;
    swapped.clear();
    for (const c of copies) c.dispose();
    copies.length = 0;
  }

  function paint() {
    if (!current) return;
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !sameOption(optionOf(o), current)) return;
      const own = o.material;
      o.material = Array.isArray(own) ? own.map(tinted) : tinted(own);
      swapped.set(o, { own, shown: o.material });
    });
  }

  return {
    set(option) {
      if (sameOption(option, current)) return;
      clear();
      current = option;
      paint();
      invalidate();
    },
    refresh() {
      if (!current) return;
      clear();
      paint();
      invalidate();
    },
    dispose() {
      clear();
      current = null;
    },
  };
}
