import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PAINTS, findById } from '../../data/catalog';
import { DEFAULTS } from '../../state/settings';
import { lin } from '../materials';
import { buildOffice } from './index';

const build = () => {
  const g = new THREE.Group();
  const office = buildOffice(g);
  return { g, office };
};
const box = (g: THREE.Object3D) => new THREE.Box3().setFromObject(g);

describe('buildOffice', () => {
  it('stands inside the office outline, on the floor, under the ceiling', () => {
    const { g } = build();
    const b = box(g);
    expect(b.min.x).toBeGreaterThanOrEqual(8.89);
    expect(b.max.x).toBeLessThanOrEqual(11.89);
    expect(b.min.z).toBeGreaterThanOrEqual(-1.925);
    expect(b.min.y).toBeGreaterThanOrEqual(0);
    expect(b.max.y).toBeCloseTo(2.88, 2);
  });
  it('leaves the opening to the living room clear', () => {
    /* nothing within 0.9 m of the west wall between z −0.185 and 0.685 */
    const { g } = build();
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const b = new THREE.Box3().setFromObject(o);
      const inDoorway = b.min.x < 9.79 && b.max.z > -0.185 && b.min.z < 0.685;
      expect(inDoorway).toBe(false);
    });
  });
  it('paints the cabinets in the office wall colour', () => {
    const { g, office } = build();
    office.apply({ ...DEFAULTS, walls: { ...DEFAULTS.walls, office: 'linen' } });
    const mats = new Set<THREE.Material>();
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && !Array.isArray(o.material)) mats.add(o.material);
    });
    const cabinet = [...mats].find((m) => m.name === 'office-cabinet') as THREE.MeshStandardMaterial;
    expect(cabinet.color.getHex()).toBe(lin(findById(PAINTS, 'linen').hex).getHex());
  });
  it('draws few meshes', () => {
    let n = 0;
    build().g.traverse((o) => {
      if (o instanceof THREE.Mesh) n++;
    });
    expect(n).toBeLessThanOrEqual(12);
  });
});
