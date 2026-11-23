import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FURNITURE, SHELVING_CUT } from '../data/catalog';
import { loadFurniture, placePiece } from './furniture';
import { sideboard } from './sideboard';

afterEach(() => vi.restoreAllMocks());

const byFile = (scene: THREE.Object3D, id: string) => scene.children.find((c) => c.name === id)!;

describe('loadFurniture', () => {
  it('hands the loader each piece, the sideboard and rug without a model file', async () => {
    const seen = new Map<string, string | undefined>();
    await loadFurniture(new THREE.Scene(), (piece) => {
      seen.set(piece.id, piece.file);
      return Promise.resolve(new THREE.Group());
    }).ready;
    expect(seen.get('sofa')).toBe('models/living/sofa.glb');
    expect(seen.get('tv-bench')).toBeUndefined();
    expect(seen.get('rug')).toBeUndefined();
  });

  it('adds every piece that loads and carries on past one that fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const f = loadFurniture(scene, (piece) => (piece.id === 'tv' ? Promise.reject(new Error('404')) : Promise.resolve(new THREE.Group())));
    await f.ready;
    expect(scene.children).toHaveLength(FURNITURE.length - 1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('hides the pieces switched off and shows the rest', async () => {
    const scene = new THREE.Scene();
    const f = loadFurniture(scene, () => Promise.resolve(new THREE.Group()));
    await f.ready;
    f.setHidden(['sofa']);
    expect(byFile(scene, 'sofa').visible).toBe(false);
    expect(byFile(scene, 'plant').visible).toBe(true);
    f.setHidden([]);
    expect(byFile(scene, 'sofa').visible).toBe(true);
  });

  it('applies the hidden list to a piece that arrives late', async () => {
    const scene = new THREE.Scene();
    let release!: (o: THREE.Object3D) => void;
    const late = new Promise<THREE.Object3D>((r) => (release = r));
    const f = loadFurniture(scene, (piece) => (piece.id === 'sofa' ? late : Promise.resolve(new THREE.Group())));
    f.setHidden(['sofa']);
    release(new THREE.Group());
    await f.ready;
    expect(byFile(scene, 'sofa').visible).toBe(false);
  });

  it('trims the shelving when it loads and keeps it toggleable', async () => {
    const scene = new THREE.Scene();
    // a tall box spanning z −1.8…0.6, y 0…2, finely divided so the cut has vertices on both sides
    const box = new THREE.BoxGeometry(0.3, 2, 2.4, 1, 8, 12).translate(3.84, 1, -0.6);
    // and a ladder between the middle and leftmost columns (z −0.232…−0.202)
    const ladder = new THREE.BoxGeometry(0.3, 2, 0.03, 1, 8, 1).translate(3.84, 1, -0.217);
    const material = new THREE.MeshStandardMaterial();
    const ladderMesh = new THREE.Mesh(ladder, material);
    const shelving = new THREE.Group().add(new THREE.Mesh(box, material), ladderMesh);
    const f = loadFurniture(scene, (piece) => Promise.resolve(piece.id === 'shelving' ? shelving : new THREE.Group()));
    await f.ready;
    const piece = byFile(scene, 'shelving');
    piece.updateMatrixWorld(true);
    const firstCut = Math.min(...SHELVING_CUT.map((r) => r.zFrom));
    let fullHeight = 0;
    let ladderTop = -Infinity;
    const v = new THREE.Vector3();
    piece.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const pos = (o.geometry as THREE.BufferGeometry).getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        for (const r of SHELVING_CUT) if (v.z > r.zFrom && v.z <= r.zTo) expect(v.y).toBeLessThanOrEqual(r.y + 1e-6);
        if (v.z < firstCut && v.y > 2 - 1e-6) fullHeight++;
        if (o === ladderMesh) ladderTop = Math.max(ladderTop, v.y);
      }
    });
    expect(fullHeight).toBeGreaterThan(0);
    // the shared ladder keeps the middle column's height, not the lower leftmost one
    const [middle, leftmost] = SHELVING_CUT;
    expect(middle.y).toBeGreaterThan(leftmost.y);
    expect(ladderTop).toBeCloseTo(middle.y, 5);
    f.setHidden(['shelving']);
    expect(piece.visible).toBe(false);
    f.setHidden([]);
    expect(piece.visible).toBe(true);
  });

  it('frees a piece that finishes loading after dispose, instead of adding it', async () => {
    const scene = new THREE.Scene();
    let release!: (o: THREE.Object3D) => void;
    const late = new Promise<THREE.Object3D>((r) => (release = r));
    const f = loadFurniture(scene, (piece) => (piece.id === 'sofa' ? late : Promise.resolve(new THREE.Group())));
    await Promise.resolve();
    f.dispose();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const freed = [vi.spyOn(geometry, 'dispose'), vi.spyOn(material, 'dispose'), vi.spyOn(material.map!, 'dispose')];
    const sofa = new THREE.Group().add(new THREE.Mesh(geometry, material));
    release(sofa);
    await f.ready;
    expect(scene.getObjectByName('sofa')).toBeUndefined();
    for (const spy of freed) expect(spy).toHaveBeenCalled();
  });

  it('hands each piece to onPiece once it is in the scene, but not a piece that arrives after dispose', async () => {
    const scene = new THREE.Scene();
    let release!: (o: THREE.Object3D) => void;
    const late = new Promise<THREE.Object3D>((r) => (release = r));
    const seen: [string, THREE.Object3D, boolean][] = [];
    const f = loadFurniture(
      scene,
      (piece) => (piece.id === 'tv' ? late : Promise.resolve(new THREE.Group())),
      () => {},
      (id, obj) => seen.push([id, obj, obj.parent === scene]),
    );
    await Promise.resolve();
    await Promise.resolve();
    const sofa = seen.find(([id]) => id === 'sofa');
    expect(sofa?.[1]).toBe(byFile(scene, 'sofa'));
    expect(sofa?.[2]).toBe(true);
    f.dispose();
    release(new THREE.Group());
    await f.ready;
    expect(seen.map(([id]) => id)).not.toContain('tv');
  });

  it('warns once and carries on when onPiece throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const onAdded = vi.fn();
    const f = loadFurniture(scene, () => Promise.resolve(new THREE.Group()), onAdded, () => {
      throw new Error('boom');
    });
    await expect(f.ready).resolves.toBeUndefined();
    expect(scene.children).toHaveLength(FURNITURE.length);
    expect(onAdded).toHaveBeenCalledTimes(FURNITURE.length);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('leaves the sofa\'s materials alone when it is hidden and shown again', async () => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial({ name: 'Surf-Fabric' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const sofa = new THREE.Group().add(mesh);
    const f = loadFurniture(scene, (piece) => Promise.resolve(piece.id === 'sofa' ? sofa : new THREE.Group()));
    await f.ready;
    f.setHidden(['sofa']);
    f.setHidden([]);
    expect(mesh.material).toBe(material);
  });
});

describe('sideboard', () => {
  /* jsdom has no 2D canvas: the wood texture only needs something that swallows every drawing call (each test, as the
     file restores every mock after each) */
  beforeEach(() => {
    const ctx: unknown = new Proxy(function () {}, {
      get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : ctx),
      set: () => true,
      apply: () => ctx,
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
  });

  it('is 160 × 75 × 48 cm (with its top\'s overhang), 126 cm from the hall-side wall, its back on the TV wall', () => {
    const b = new THREE.Box3().setFromObject(sideboard());
    expect(b.min.x - 3.69).toBeCloseTo(1.25);
    expect(b.max.x - b.min.x).toBeCloseTo(1.62);
    expect([b.min.y, b.max.y]).toEqual([expect.closeTo(0), expect.closeTo(0.75)]);
    expect(b.max.z).toBeCloseTo(2.709);
    expect(b.max.z - b.min.z).toBeCloseTo(0.49);
  });

  it('has two doors and then three drawers from its left, each with a dark pull', () => {
    const board = sideboard();
    /* the pulls are the dark slots, merged into one mesh; each is a box of 36 corners */
    const pulls = board.children.find(
      (o) => o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).color.getHexString() !== 'ffffff' && !(o.material as THREE.MeshStandardMaterial).map,
    ) as THREE.Mesh;
    const pos = pulls.geometry.getAttribute('position');
    const centres: [number, number][] = [];
    for (let i = 0; i < pos.count; i += 36) {
      let x = 0;
      let y = 0;
      for (let j = i; j < i + 36; j++) {
        x += pos.getX(j) / 36;
        y += pos.getY(j) / 36;
      }
      centres.push([x, y]);
    }
    expect(centres).toHaveLength(5);
    /* seen facing the wall, left is +x: the two door pulls are the furthest left, at one height; the three drawer
       pulls are in the right-hand column, one above another */
    const byX = [...centres].sort((a, b) => b[0] - a[0]);
    expect(byX[0][1]).toBeCloseTo(byX[1][1]);
    const drawers = byX.slice(2);
    for (const [x] of drawers) expect(x).toBeCloseTo(drawers[0][0]);
    expect(new Set(drawers.map(([, y]) => y.toFixed(3))).size).toBe(3);
    expect(drawers[0][0]).toBeLessThan(byX[1][0]);
  });
});

describe('placePiece', () => {
  /** a box spanning min..max, its geometry in scene coordinates like the exported models */
  const piece = (min: [number, number, number], max: [number, number, number]) => {
    const size = max.map((v, i) => v - min[i]) as [number, number, number];
    const g = new THREE.BoxGeometry(...size).translate(...(max.map((v, i) => (v + min[i]) / 2) as [number, number, number]));
    const group = new THREE.Group();
    group.add(new THREE.Mesh(g));
    return group;
  };
  const bounds = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

  it('centres the TV over the bench, 86 cm up, 11 cm above it, at its own size', () => {
    const tv = piece([4.853, 1.002, 2.675], [6.306, 1.832, 2.718]);
    placePiece('tv', tv);
    const b = bounds(tv);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(3.69 + 1.26 + 0.8);
    expect(b.min.y).toBeCloseTo(0.86);
    expect(b.min.y - 0.75).toBeCloseTo(0.11);
    expect(b.max.x - b.min.x).toBeCloseTo(1.453);
    expect(b.max.z).toBeCloseTo(2.718);
  });

  it('leaves every other piece where the model put it', () => {
    const sofa = piece([1, 0, 1], [2, 1, 2]);
    placePiece('sofa', sofa);
    expect(sofa.position.toArray()).toEqual([0, 0, 0]);
    expect(sofa.scale.toArray()).toEqual([1, 1, 1]);
  });
});
