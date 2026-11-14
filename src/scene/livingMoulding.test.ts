import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PAINTS, TRIM } from '../data/catalog';
import { ROOMS } from '../data/rooms';
import { DEFAULTS, applyPatch, type SettingsPatch } from '../state/settings';
import { buildApartment } from './buildApartment';
import { buildLivingMoulding } from './livingMoulding';
import { lin } from './materials';

const settings = (living: SettingsPatch['living'] = {}, walls: Partial<typeof DEFAULTS.walls> = {}) =>
  applyPatch(DEFAULTS, { living, walls: { ...DEFAULTS.walls, ...walls } });

function setup() {
  const parent = new THREE.Group();
  const attached: (readonly [number, number])[] = [];
  const m = buildLivingMoulding(parent, (p) => attached.push(p));
  const meshes = (name: string) => {
    const out: THREE.Mesh[] = [];
    parent.traverse((o) => o instanceof THREE.Mesh && (o.material as THREE.Material).name === name && out.push(o));
    return out;
  };
  return { parent, m, meshes, attached };
}

/** one Box3 per strip: merged boxes are 36 non-indexed vertices each */
function strips(mesh: THREE.Mesh): THREE.Box3[] {
  const pos = mesh.geometry.attributes.position;
  const out: THREE.Box3[] = [];
  for (let i = 0; i < pos.count; i += 36) {
    const b = new THREE.Box3();
    for (let j = i; j < i + 36; j++) b.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, j));
    out.push(b);
  }
  return out;
}

const shown = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

describe('living-room moulding', () => {
  it('builds three columns and a rail on each wall, inside the wall', () => {
    const { m, meshes } = setup();
    m.apply(settings());
    for (const [name, wallZ, x0, x1] of [['living-mould-sofa', -1.925, 3.69, 8.69], ['living-mould-tv', 2.725, 3.69, 7.376]] as const) {
      const boxes = meshes(name).flatMap(strips);
      /* rail + 3 columns × 2 frames × 4 strips */
      expect(boxes).toHaveLength(25);
      for (const b of boxes) {
        expect(b.min.x).toBeGreaterThanOrEqual(x0 - 1e-6);
        expect(b.max.x).toBeLessThanOrEqual(x1 + 1e-6);
        expect(b.min.y).toBeGreaterThanOrEqual(0.28 - 1e-6);
        expect(b.max.y).toBeLessThanOrEqual(3.0 + 1e-6);
        expect(Math.abs(b.min.z - wallZ)).toBeLessThanOrEqual(0.015);
        expect(Math.abs(b.max.z - wallZ)).toBeLessThanOrEqual(0.015);
      }
    }
  });

  it('faces the strips into the room', () => {
    const { m, meshes } = setup();
    m.apply(settings());
    for (const b of meshes('living-mould-sofa').flatMap(strips)) expect(b.min.z).toBeCloseTo(-1.925);
    for (const b of meshes('living-mould-tv').flatMap(strips)) expect(b.max.z).toBeCloseTo(2.725);
  });

  it('keeps the TV-wall moulding off the TV at the narrowest centre width', () => {
    const { m, meshes } = setup();
    m.apply(settings({ mouldCentre: 150 }));
    const tv = new THREE.Box3(new THREE.Vector3(4.85, 1.0, 2.6), new THREE.Vector3(6.31, 1.83, 2.8));
    const boxes = meshes('living-mould-tv').flatMap(strips);
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) expect(b.intersectsBox(tv)).toBe(false);
  });

  it('follows the wall paint in tone mode', () => {
    const { m, meshes } = setup();
    for (const id of ['linen', 'stone']) {
      const hex = PAINTS.find((p) => p.id === id)!.hex;
      m.apply(settings({ mouldColour: 'tone' }, { living: id }));
      for (const name of ['living-mould-sofa', 'living-mould-tv']) {
        const mat = meshes(name)[0].material as THREE.MeshStandardMaterial;
        expect(mat.color.equals(lin(hex).multiplyScalar(0.82))).toBe(true);
      }
    }
    m.apply(settings({ mouldColour: 'white' }));
    expect((meshes('living-mould-tv')[0].material as THREE.MeshStandardMaterial).color.equals(lin(TRIM.hex))).toBe(true);
  });

  it('hides a wall that is switched off', () => {
    const { m, meshes } = setup();
    m.apply(settings({ mouldTvWall: 'off' }));
    expect(meshes('living-mould-tv').length).toBeGreaterThan(0);
    for (const mesh of meshes('living-mould-tv')) expect(shown(mesh)).toBe(false);
    for (const mesh of meshes('living-mould-sofa')) expect(shown(mesh)).toBe(true);
    m.apply(settings());
    for (const mesh of meshes('living-mould-tv')) expect(shown(mesh)).toBe(true);
  });

  it('rebuilds only when the layout changes', () => {
    const { m, meshes } = setup();
    m.apply(settings());
    const first = meshes('living-mould-sofa');
    m.apply(settings({ mouldTvWall: 'off' }));
    expect(meshes('living-mould-sofa')).toEqual(first);
    m.apply(settings({ mouldGap: 12 }));
    expect(meshes('living-mould-sofa')[0]).not.toBe(first[0]);
  });

  it('attaches each wall once, so rebuilding keeps the attached group', () => {
    const { m, parent, attached } = setup();
    m.apply(settings());
    const groups = [...parent.children];
    m.apply(settings({ mouldGap: 12 }));
    expect(parent.children).toEqual(groups);
    expect(attached).toEqual([[5.855, -1.925], [5.58, 2.725]]);
  });
});

describe('Apartment.attachToWall', () => {
  const apartment = () =>
    buildApartment({
      trim: new THREE.MeshStandardMaterial(),
      glass: new THREE.MeshStandardMaterial(),
      floor: () => new THREE.MeshStandardMaterial(),
    });

  it('shows the parts with their wall and hides them from behind it', () => {
    const a = apartment();
    const part = new THREE.Group();
    a.attachToWall('living', [5.855, -1.925], [part]);
    a.showFrom(new THREE.Vector3(5.8, 1.5, 0));
    expect(part.visible).toBe(true);
    a.showFrom(new THREE.Vector3(5.8, 1.5, -6));
    expect(part.visible).toBe(false);
  });

  it('picks the wall by its line: the TV wall faces the other way', () => {
    const a = apartment();
    const part = new THREE.Group();
    a.attachToWall('living', [5.58, 2.725], [part]);
    a.showFrom(new THREE.Vector3(5.8, 1.5, 0));
    expect(part.visible).toBe(true);
    a.showFrom(new THREE.Vector3(5.8, 1.5, 6));
    expect(part.visible).toBe(false);
  });

  it('replaces the parts attached before for the same wall', () => {
    const a = apartment();
    const first = new THREE.Group();
    const second = new THREE.Group();
    a.attachToWall('living', [5.855, -1.925], [first]);
    a.attachToWall('living', [5.855, -1.925], [second]);
    a.showFrom(new THREE.Vector3(5.8, 1.5, -6));
    expect(second.visible).toBe(false);
    first.visible = true;
    a.showFrom(new THREE.Vector3(5.8, 1.5, -6));
    expect(first.visible).toBe(true);
  });

  it('throws when no wall of the room passes through the point', () => {
    expect(() => apartment().attachToWall('living', [5, 0], [new THREE.Group()])).toThrow();
    expect(ROOMS.some((r) => r.id === 'living')).toBe(true);
  });
});
