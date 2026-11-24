import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { XZ } from '../data/rooms';
import { DEFAULTS, applyPatch } from '../state/settings';
import { buildBedroom } from './bedroom';
import { buildApartment } from './buildApartment';
import { highlighter } from './highlight';
import { optionOf, sameOption, tagOption } from './options';
import { pick } from './pickRoom';

/* jsdom has no 2D canvas: the textures only need something that swallows every drawing call */
beforeAll(() => {
  const ctx: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : ctx),
    set: () => true,
    apply: () => ctx,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
});

/** the menu paths the meshes under `root` open, for one room */
const paths = (root: THREE.Object3D, room: string) => {
  const found = new Set<string>();
  root.traverse((o) => {
    const opt = o instanceof THREE.Mesh ? optionOf(o) : null;
    if (opt?.room === room) found.add(opt.path.join('/'));
  });
  return [...found].sort();
};

describe('options', () => {
  it('belong to an object through its nearest tagged parent', () => {
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    const mesh = new THREE.Mesh();
    outer.add(inner);
    inner.add(mesh);
    tagOption([outer], 'living', ['furniture']);
    expect(optionOf(mesh)).toEqual({ room: 'living', path: ['furniture'] });
    tagOption([inner], 'living', ['sofa']);
    expect(optionOf(mesh)?.path).toEqual(['sofa']);
    expect(optionOf(new THREE.Mesh())).toBeNull();
    expect(sameOption({ room: 'living', path: ['sofa'] }, optionOf(mesh))).toBe(true);
    expect(sameOption({ room: 'office', path: ['sofa'] }, optionOf(mesh))).toBe(false);
  });

  it('tag the bedroom\'s parts with the page each opens', () => {
    const parent = new THREE.Group();
    const room = buildBedroom(parent, '#B5654A');
    room.apply(applyPatch(DEFAULTS, { room: 'bedroom' }));
    expect(paths(parent, 'bedroom')).toEqual(['accent', 'ceiling', 'moulding/bed', 'moulding/dresser', 'painting', 'pillows', 'rug', 'wardrobes']);
  });

  it('keep the moulding tagged when a setting rebuilds it', () => {
    const parent = new THREE.Group();
    const room = buildBedroom(parent, '#B5654A');
    room.apply(DEFAULTS);
    room.apply(applyPatch(DEFAULTS, { bedroom: { mouldSpacing: 14 } }));
    expect(paths(parent, 'bedroom')).toContain('moulding/bed');
  });

  it('tag every room\'s walls', () => {
    const apartment = buildApartment({
      trim: new THREE.MeshStandardMaterial(),
      glass: new THREE.MeshBasicMaterial(),
      floor: () => new THREE.MeshStandardMaterial(),
    });
    for (const id of ['bedroom', 'hall', 'living', 'office']) expect(paths(apartment.group, id)).toEqual(['walls']);
  });
});

describe('pick', () => {
  const rooms: { id: 'bedroom'; poly: XZ[] }[] = [{ id: 'bedroom', poly: [[-2, -2], [2, -2], [2, 2], [-2, 2]] }];
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
  camera.position.set(0, 10, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const flat = (y: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.updateMatrixWorld();
    return m;
  };

  it('reports the option of what it hits, looking past meshes that draw no colour', () => {
    const rug = flat(0.01, new THREE.MeshBasicMaterial());
    tagOption([rug], 'bedroom', ['rug']);
    const ceiling = flat(3.3, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
    expect(pick({ x: 0, y: 0 }, camera, [ceiling, rug], rooms)).toEqual({ room: 'bedroom', option: { room: 'bedroom', path: ['rug'] } });
  });

  it('reports no option for something untagged, and nothing outside', () => {
    expect(pick({ x: 0, y: 0 }, camera, [flat(0, new THREE.MeshBasicMaterial())], rooms)).toEqual({ room: 'bedroom', option: null });
    expect(pick({ x: 0, y: 0 }, camera, [], rooms)).toEqual({ room: null, option: null });
  });
});

describe('highlighter', () => {
  it('highlights a whole room by its walls and floor, and nothing of another room', () => {
    const root = new THREE.Group();
    const mesh = (name = '') => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      m.name = name;
      root.add(m);
      return m;
    };
    const wall = mesh();
    tagOption([wall], 'hall', ['walls']);
    const floor = mesh('hall-floor');
    const rug = mesh();
    tagOption([rug], 'hall', ['rug']);
    const otherWall = mesh();
    tagOption([otherWall], 'living', ['walls']);
    const own = new Map([wall, floor, rug, otherWall].map((m) => [m, m.material]));
    const h = highlighter(root, () => {});
    h.set({ kind: 'room', room: 'hall' });
    expect([wall, floor, rug, otherWall].map((m) => m.material !== own.get(m))).toEqual([true, true, false, false]);
    h.set(null);
    expect([wall, floor].every((m) => m.material === own.get(m))).toBe(true);
  });

  it('tints copies of the option\'s materials, leaves shared materials alone, and puts them back', () => {
    const root = new THREE.Group();
    const shared = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const a = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const b = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    root.add(a, b);
    tagOption([a], 'bedroom', ['rug']);
    let drawn = 0;
    const h = highlighter(root, () => drawn++);
    h.set({ kind: 'option', option: { room: 'bedroom', path: ['rug'] } });
    expect(a.material).not.toBe(shared);
    expect((a.material as THREE.MeshStandardMaterial).color.equals(shared.color)).toBe(false);
    expect(b.material).toBe(shared);
    expect(shared.color.getHex()).toBe(0xffffff);
    expect(drawn).toBe(1);
    h.set({ kind: 'option', option: { room: 'bedroom', path: ['rug'] } });
    expect(drawn).toBe(1);
    h.set(null);
    expect(a.material).toBe(shared);
  });

  it('keeps a material that was replaced while highlighted', () => {
    const root = new THREE.Group();
    const own = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), own);
    root.add(mesh);
    tagOption([mesh], 'living', ['sofa']);
    const h = highlighter(root, () => {});
    h.set({ kind: 'option', option: { room: 'living', path: ['sofa'] } });
    const fabric = new THREE.MeshStandardMaterial();
    mesh.material = fabric;
    h.set(null);
    expect(mesh.material).toBe(fabric);
  });
});
