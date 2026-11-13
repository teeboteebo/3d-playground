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
const boxOf = (g: THREE.Object3D, name: string) => new THREE.Box3().setFromObject(g.getObjectByName(name)!);

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
  it('stands the cabinets against the entrance wall, beside the opening', () => {
    const b = boxOf(build().g, 'office-cabinets');
    expect(b.min.x).toBeCloseTo(8.94, 2);
    expect(b.max.x).toBeCloseTo(9.54, 2);
    expect(b.min.z).toBeCloseTo(-1.875, 2);
    expect(b.max.z).toBeCloseTo(-0.675, 2);
  });
  it('stands the drawer unit between the desk and the left wall', () => {
    const { g } = build();
    const drawers = boxOf(g, 'office-drawers');
    const desk = boxOf(g, 'office-desk');
    expect(drawers.min.z).toBeCloseTo(-1.875, 2);
    expect(drawers.max.z).toBeLessThanOrEqual(desk.min.z);
    expect(drawers.max.x).toBeCloseTo(11.84, 2);
    expect(desk.max.z).toBeCloseTo(-0.205, 2);
  });
  it('keeps the pieces from standing inside each other', () => {
    const { g } = build();
    const names = ['office-cabinets', 'office-desk', 'office-drawers', 'office-chair'];
    const boxes = names.map((n) => boxOf(g, n));
    /* whole boxes are compared; the chair is not checked against the desk, because its seat slides under the desk top */
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(boxes[i].intersectsBox(boxes[j])).toBe(false);
    expect(boxes[3].intersectsBox(boxes[0])).toBe(false);
    expect(boxes[3].intersectsBox(boxes[2])).toBe(false);
  });
  it('faces the fronts outwards and pins the desk', () => {
    const { g } = build();
    const cabinets = boxOf(g, 'office-cabinets');
    const drawers = boxOf(g, 'office-drawers');
    const desk = boxOf(g, 'office-desk');
    /* the door gap lines stand proud of the cabinet fronts, which face +x */
    expect(cabinets.max.x).toBeGreaterThan(9.54);
    expect(cabinets.min.x).toBeCloseTo(8.94, 2);
    /* the drawer fronts stand proud of the body on its −x face */
    expect(drawers.min.x).toBeLessThan(11.84 - 0.47);
    expect(desk.max.x).toBeCloseTo(11.84, 2);
  });
});
