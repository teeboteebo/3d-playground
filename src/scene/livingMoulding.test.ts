import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PAINTS, TRIM } from '../data/catalog';
import { DEFAULTS, applyPatch, type SettingsPatch } from '../state/settings';
import { buildApartment } from './buildApartment';
import { buildLivingMoulding } from './livingMoulding';
import { lin } from './materials';
import { layoutSection } from './mouldLayout';
import { LIVING_MOULD_WALLS } from './mouldWalls';
import { strips } from './testStrips';

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

const shown = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

describe('living-room moulding at the product size', () => {
  it('draws the frames at the product width and depth, and the rail as the panel profile', () => {
    const { m, meshes } = setup();
    m.apply(settings());
    for (const name of ['living-mould-sofa', 'living-mould-tv']) {
      const boxes = meshes(name).flatMap(strips);
      const rail = boxes.reduce((a, b) => (b.max.x - b.min.x > a.max.x - a.min.x ? b : a));
      expect(rail.max.y - rail.min.y).toBeCloseTo(0.028);
      for (const b of boxes) {
        expect(b.max.z - b.min.z).toBeCloseTo(0.012);
        if (b !== rail) expect(Math.min(b.max.x - b.min.x, b.max.y - b.min.y)).toBeCloseTo(0.028);
      }
    }
  });
});

describe('living-room moulding', () => {
  it('builds a rail and the columns on each wall, inside the wall', () => {
    const { m, meshes } = setup();
    m.apply(settings());
    for (const [name, wallZ, x0, x1, columns] of [
      ['living-mould-sofa', -1.925, 3.69, 8.69, 5], ['living-mould-tv', 2.725, 3.69, 7.376, 3],
    ] as const) {
      const boxes = meshes(name).flatMap(strips);
      /* rail + columns × 2 frames × 4 strips */
      expect(boxes).toHaveLength(1 + columns * 8);
      for (const b of boxes) {
        expect(b.min.x).toBeGreaterThanOrEqual(x0 - 1e-6);
        expect(b.max.x).toBeLessThanOrEqual(x1 + 1e-6);
        expect(b.min.y).toBeGreaterThanOrEqual(0.26 - 1e-6);
        expect(b.max.y).toBeLessThanOrEqual(3.22 + 1e-6);
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

  it('keeps the TV wall centre column over the TV', () => {
    const { m, meshes } = setup();
    m.apply(settings());
    const l = layoutSection(LIVING_MOULD_WALLS[1].sections[0].run, { spacing: 8, dado: 77 }, DEFAULTS.living.mouldWalls.tv);
    const [c0, c1] = l.columns[1];
    expect(c0).toBeLessThanOrEqual(4.85);
    expect(c1).toBeGreaterThanOrEqual(6.31);
    /* no strip crosses the TV's side edges */
    for (const b of meshes('living-mould-tv').flatMap(strips)) {
      for (const edge of [4.85, 6.31]) expect(b.min.x < edge && b.max.x > edge && b.max.x - b.min.x < 0.1).toBe(false);
    }
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

  it('lays the sofa wall out as five columns with one spacing on every side', () => {
    const { m, meshes } = setup();
    m.apply(settings());
    const boxes = meshes('living-mould-sofa').flatMap(strips);
    expect(boxes).toHaveLength(1 + 5 * 8);
    const bottoms = boxes.filter((b) => Math.abs(b.min.y - 0.26) < 1e-6 && b.max.y - b.min.y < 0.1)
      .sort((a, b) => a.min.x - b.min.x);
    expect(bottoms).toHaveLength(5);
    const w = (5 - 6 * 0.08) / 5;
    bottoms.forEach((b, i) => {
      expect(b.max.x - b.min.x).toBeCloseTo(w);
      expect(b.min.x).toBeCloseTo(3.69 + 0.08 + i * (w + 0.08));
    });
    expect(bottoms[4].max.x).toBeCloseTo(8.69 - 0.08);
  });

  it('rebuilds only the wall whose layout changes', () => {
    const { m, meshes } = setup();
    m.apply(settings());
    const sofa = meshes('living-mould-sofa');
    const tv = meshes('living-mould-tv');
    m.apply(settings({ mouldTvWall: 'off' }));
    expect(meshes('living-mould-sofa')).toEqual(sofa);
    const wallsOf = (o: Partial<typeof DEFAULTS.living.mouldWalls.sofa>) => ({
      ...DEFAULTS.living.mouldWalls, sofa: { ...DEFAULTS.living.mouldWalls.sofa, ...o },
    });
    m.apply(settings({ mouldWalls: wallsOf({ columns: 4 }) }));
    expect(meshes('living-mould-sofa')[0]).not.toBe(sofa[0]);
    expect(meshes('living-mould-tv')).toEqual(tv);
    const sofa2 = meshes('living-mould-sofa');
    m.apply(settings({ mouldWalls: wallsOf({ columns: 4 }), mouldSpacing: 12 }));
    expect(meshes('living-mould-tv')[0]).not.toBe(tv[0]);
    expect(meshes('living-mould-sofa')[0]).not.toBe(sofa2[0]);
  });

  it('attaches each wall once, so rebuilding keeps the attached group', () => {
    const { m, parent, attached } = setup();
    m.apply(settings());
    const groups = [...parent.children];
    m.apply(settings({ mouldSpacing: 12 }));
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
  });
});
