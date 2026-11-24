import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FURNITURE, SHELVING_CUT } from '../data/catalog';
import { LIVING } from '../data/living';
import { loadFurniture, placePiece } from './furniture';
import { optionOf } from './options';
import { sideboard, sideboardLayout } from './sideboard';

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

  it('tags each piece with its own component', async () => {
    const scene = new THREE.Scene();
    await loadFurniture(scene, () => Promise.resolve(new THREE.Group())).ready;
    for (const piece of FURNITURE) expect(optionOf(byFile(scene, piece.id))).toEqual({ room: 'living', path: [piece.id] });
    const ids = FURNITURE.map((f) => f.id).sort();
    expect(ids).toEqual(LIVING.components.filter((c) => c.category !== 'lighting').map((c) => c.id).sort());
  });

  it('adds every piece that loads and carries on past one that fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const f = loadFurniture(scene, (piece) => (piece.id === 'tv' ? Promise.reject(new Error('404')) : Promise.resolve(new THREE.Group())));
    await f.ready;
    expect(scene.children).toHaveLength(FURNITURE.length - 1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('shows only the pieces switched on', async () => {
    const scene = new THREE.Scene();
    const f = loadFurniture(scene, () => Promise.resolve(new THREE.Group()));
    await f.ready;
    f.setShown((id) => id !== 'sofa');
    expect(byFile(scene, 'sofa').visible).toBe(false);
    expect(byFile(scene, 'plant').visible).toBe(true);
    f.setShown(() => true);
    expect(byFile(scene, 'sofa').visible).toBe(true);
  });

  it('applies the shown predicate to a piece that arrives late', async () => {
    const scene = new THREE.Scene();
    let release!: (o: THREE.Object3D) => void;
    const late = new Promise<THREE.Object3D>((r) => (release = r));
    const f = loadFurniture(scene, (piece) => (piece.id === 'sofa' ? late : Promise.resolve(new THREE.Group())));
    f.setShown((id) => id !== 'sofa');
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
    f.setShown((id) => id !== 'shelving');
    expect(piece.visible).toBe(false);
    f.setShown(() => true);
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
    f.setShown((id) => id !== 'sofa');
    f.setShown(() => true);
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
    /* 48 cm, plus the knobs standing 2.6 cm proud of the fronts (the top overhangs the fronts by 1.5 cm) */
    expect(b.max.z - b.min.z).toBeCloseTo(0.475 + 0.026);
  });

  it('has two doors and then three drawers from its left, each with one knob', () => {
    const { fronts, knobs } = sideboardLayout();
    /* seen facing the wall, left is +x */
    expect(fronts.map((f) => f.kind)).toEqual(['door', 'door', 'drawer', 'drawer', 'drawer']);
    expect(fronts[0].x).toBeGreaterThan(fronts[1].x);
    expect(fronts[1].x).toBeGreaterThan(fronts[2].x);
    const drawers = fronts.slice(2);
    for (const d of drawers) expect(d.x).toBeCloseTo(drawers[0].x);
    expect(new Set(drawers.map((d) => d.y0.toFixed(3))).size).toBe(3);
    expect(knobs).toHaveLength(5);
    /* the doors open from the middle: their knobs sit 5 cm either side of the seam, at one height */
    const seam = (fronts[0].x - fronts[0].w / 2 + fronts[1].x + fronts[1].w / 2) / 2;
    expect(knobs[0][0] - seam).toBeCloseTo(0.05 - 0.002);
    expect(seam - knobs[1][0]).toBeCloseTo(0.05 - 0.002);
    expect(knobs[0][1]).toBeCloseTo(knobs[1][1]);
    /* each drawer's knob in its centre */
    drawers.forEach((d, i) => expect(knobs[2 + i]).toEqual([expect.closeTo(d.x), expect.closeTo((d.y0 + d.y1) / 2)]));
  });

  it('builds a knob for every front, standing out of its face', () => {
    const knobs = sideboard().children.find(
      (o) => o instanceof THREE.Mesh && !(o.material as THREE.MeshStandardMaterial).map,
    ) as THREE.Mesh;
    const b = new THREE.Box3().setFromObject(knobs);
    const { knobs: at } = sideboardLayout();
    expect(b.max.x).toBeCloseTo(Math.max(...at.map(([x]) => x)) + 0.016);
    expect(b.min.x).toBeCloseTo(Math.min(...at.map(([x]) => x)) - 0.016);
    expect(2.709 - b.max.z).toBeCloseTo(0.475);
    expect(b.max.z - b.min.z).toBeCloseTo(0.026);
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
