import * as THREE from 'three';
import { FURNITURE } from '../data/catalog';

export interface Furniture {
  /** hide these furniture ids, show the rest (also applies to pieces still loading) */
  setHidden(ids: readonly string[]): void;
  /** settles once every piece has loaded or failed; never rejects */
  ready: Promise<void>;
}

/**
 * Loads the living-room furniture into `parent`. Each piece is already in scene coordinates and appears as soon
 * as it loads. A piece that fails to load is skipped with one warning; the rest of the room still works.
 */
export function loadFurniture(parent: THREE.Object3D, load: (url: string) => Promise<THREE.Object3D>): Furniture {
  let hidden: readonly string[] = [];
  const loaded = new Map<string, THREE.Object3D>();
  let warned = false;

  const ready = Promise.all(
    FURNITURE.map(({ id, file }) =>
      load(file).then(
        (obj) => {
          obj.name = id;
          obj.visible = !hidden.includes(id);
          obj.traverse((o) => {
            o.castShadow = true;
            o.receiveShadow = true;
          });
          loaded.set(id, obj);
          parent.add(obj);
        },
        (err: unknown) => {
          if (!warned) console.warn('Some living-room furniture could not be loaded', err);
          warned = true;
        },
      ),
    ),
  ).then(() => undefined);

  return {
    setHidden(ids) {
      hidden = ids;
      for (const [id, obj] of loaded) obj.visible = !hidden.includes(id);
    },
    ready,
  };
}
