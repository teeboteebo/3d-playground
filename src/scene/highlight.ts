import * as THREE from 'three';
import { lin } from './materials';
import type { RoomId } from '../data/rooms';
import { optionOf, sameOption, type SceneOption } from './options';

/**
 * what to highlight: one menu option, or a whole room (its walls and floor), for the click that selects it. An option
 * with `within` set also takes in every option under it (the menu's "Wall moulding" row takes in each wall's moulding).
 */
export type HighlightTarget = { kind: 'option'; option: SceneOption; within?: boolean } | { kind: 'room'; room: RoomId };

const sameTarget = (a: HighlightTarget | null, b: HighlightTarget | null): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    (a.kind === 'room'
      ? b.kind === 'room' && a.room === b.room
      : b.kind === 'option' && sameOption(a.option, b.option) && !a.within === !b.within));

/** whether `option` is `under`, or (for `within`) any option whose path starts with its path */
function matches(option: SceneOption | null, under: SceneOption, within: boolean): boolean {
  if (!within) return sameOption(option, under);
  return !!option && option.room === under.room && under.path.every((id, i) => option.path[i] === id);
}

/** whether `o` is part of the target: a mesh of the option, or a room's walls and floor */
function partOf(o: THREE.Object3D, t: HighlightTarget): boolean {
  const option = optionOf(o);
  if (t.kind === 'option') return matches(option, t.option, !!t.within);
  return o.name === `${t.room}-floor` || (option?.room === t.room && option.path[0] === 'walls');
}

/** the tint a hovered option takes on: the UI's accent, so it reads on white moulding and dark furniture alike */
const TINT = lin('#E39577');

export interface Highlight {
  /** tints every object of the target (none when null) */
  set(target: HighlightTarget | null): void;
  /** tints again after the scene changed (a setting rebuilt or recoloured parts) */
  refresh(): void;
  dispose(): void;
}

/**
 * Highlights the objects of one menu option, or one room, under `root`. Each object gets a tinted copy of its material while it is
 * highlighted and its own back afterwards, so materials shared with other objects are never changed.
 */
export function highlighter(root: THREE.Object3D, invalidate: () => void): Highlight {
  let current: HighlightTarget | null = null;
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
      if (!(o instanceof THREE.Mesh) || !partOf(o, current!)) return;
      const own = o.material;
      o.material = Array.isArray(own) ? own.map(tinted) : tinted(own);
      swapped.set(o, { own, shown: o.material });
    });
  }

  return {
    set(target) {
      if (sameTarget(target, current)) return;
      clear();
      current = target;
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
