import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FURNITURE } from '../data/catalog';
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
