import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FURNITURE, SHELVING_CUT } from '../data/catalog';
import { loadFurniture } from './furniture';

afterEach(() => vi.restoreAllMocks());

const byFile = (scene: THREE.Object3D, id: string) => scene.children.find((c) => c.name === id)!;

describe('loadFurniture', () => {
  it('hands the loader each piece, the rug without a model file', async () => {
    const seen: (string | undefined)[] = [];
    await loadFurniture(new THREE.Scene(), (piece) => {
      seen.push(piece.file);
      return Promise.resolve(new THREE.Group());
    }).ready;
    expect(seen).toContain('models/living/sofa.glb');
    expect(seen).toContain(undefined);
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
});
