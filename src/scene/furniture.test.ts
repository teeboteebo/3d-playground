import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadFurniture } from './furniture';

afterEach(() => vi.restoreAllMocks());

const byFile = (scene: THREE.Object3D, id: string) => scene.children.find((c) => c.name === id)!;

describe('loadFurniture', () => {
  it('adds every piece that loads and carries on past one that fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const f = loadFurniture(scene, (url) => (url.endsWith('/tv.glb') ? Promise.reject(new Error('404')) : Promise.resolve(new THREE.Group())));
    await f.ready;
    expect(scene.children).toHaveLength(7);
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
    const f = loadFurniture(scene, (url) => (url.endsWith('/sofa.glb') ? late : Promise.resolve(new THREE.Group())));
    f.setHidden(['sofa']);
    release(new THREE.Group());
    await f.ready;
    expect(byFile(scene, 'sofa').visible).toBe(false);
  });
});
