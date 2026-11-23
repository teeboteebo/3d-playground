import * as THREE from 'three';
import { FURNITURE, SHELVING_CUT, TV_BENCH, TV_BOTTOM, type FurniturePiece } from '../data/catalog';
import { disposeTree } from './dispose';
import { trimAbove } from './trimGeometry';

/** cuts the String shelving's two left columns to about half height (see `SHELVING_CUT`), in place */
function trimShelving(shelving: THREE.Object3D): void {
  shelving.updateMatrixWorld(true);
  shelving.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const { zFrom, zTo, y } of SHELVING_CUT) {
      const old = o.geometry as THREE.BufferGeometry;
      o.geometry = trimAbove(old, o.matrixWorld, y, (world) => world.z > zFrom && world.z <= zTo);
      old.dispose();
    }
  });
}

/**
 * Moves the TV bench and the TV from their model positions to where they stand (see `TV_BENCH`): the bench is scaled
 * to the sideboard's width and height and keeps its depth against the wall; the TV keeps its size, centred above it.
 */
export function placePiece(id: string, obj: THREE.Object3D): void {
  if (id !== 'tv-bench' && id !== 'tv') return;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  if (id === 'tv-bench') {
    const sx = TV_BENCH.w / size.x;
    const sy = TV_BENCH.h / size.y;
    obj.scale.set(sx, sy, 1);
    obj.position.set(TV_BENCH.x0 - sx * box.min.x, -sy * box.min.y, 0);
  } else {
    obj.position.set(TV_BENCH.x0 + TV_BENCH.w / 2 - (box.min.x + box.max.x) / 2, TV_BOTTOM - box.min.y, 0);
  }
  obj.updateMatrixWorld(true);
}

export interface Furniture {
  /** hide these furniture ids, show the rest (also applies to pieces still loading) */
  setHidden(ids: readonly string[]): void;
  /** settles once every piece has loaded or failed; never rejects */
  ready: Promise<void>;
  /** stop adding pieces: any that finish loading later are freed instead (the scene owns the ones already added) */
  dispose(): void;
}

/**
 * Loads the living-room furniture into `parent`. Each piece is already in scene coordinates and appears as soon
 * as it loads. A piece that fails to load is skipped with one warning; the rest of the room still works.
 */
export function loadFurniture(
  parent: THREE.Object3D,
  load: (piece: FurniturePiece) => Promise<THREE.Object3D>,
  /** called after each piece is added */
  onAdded: () => void = () => {},
  /** called with each piece once it is in the scene (not for pieces that arrive after dispose) */
  onPiece?: (id: string, obj: THREE.Object3D) => void,
): Furniture {
  let hidden: readonly string[] = [];
  const loaded = new Map<string, THREE.Object3D>();
  let warned = false;
  let pieceWarned = false;
  let disposed = false;

  const ready = Promise.all(
    FURNITURE.map((piece) =>
      load(piece).then(
        (obj) => {
          if (disposed) {
            disposeTree(obj);
            return;
          }
          const { id } = piece;
          if (id === 'shelving') trimShelving(obj);
          placePiece(id, obj);
          obj.name = id;
          obj.visible = !hidden.includes(id);
          obj.traverse((o) => {
            o.castShadow = true;
            o.receiveShadow = true;
          });
          loaded.set(id, obj);
          parent.add(obj);
          try {
            onPiece?.(id, obj);
          } catch (err) {
            if (!pieceWarned) console.warn(`The living-room piece ${id} could not be set up`, err);
            pieceWarned = true;
          }
          onAdded();
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
      onAdded();
    },
    ready,
    dispose() {
      disposed = true;
    },
  };
}
