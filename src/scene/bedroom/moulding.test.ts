import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULTS, applyPatch, type BedroomMoulding } from '../../state/settings';
import { layoutSection } from '../mouldLayout';
import { BEDROOM_MOULD_WALLS, WINDOW_WALL_CLEARANCE } from '../mouldWalls';
import { strips } from '../testStrips';
import { buildBedroom } from './index';
import { BEDX, DRESSER_X, FRONT_DOOR_TOP, FRONT_DOOR_X0, FRONT_DOOR_X1, H, L, WARD_FRONT, W } from './dimensions';
import { kit } from './kit';
import { bedroomMaterials } from './materials';
import { bedroomMoulding } from './moulding';

/* jsdom has no 2D canvas: the textures only need something that swallows every drawing call */
beforeAll(() => {
  const ctx: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : ctx),
    set: () => true,
    apply: () => ctx,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
});

const bedroom = (b: Partial<BedroomMoulding> = {}): BedroomMoulding => applyPatch(DEFAULTS, { rooms: { bedroom: { moulding: b } } }).rooms.bedroom.moulding;

function setup() {
  const parent = new THREE.Group();
  const mould = bedroomMoulding(kit(parent), bedroomMaterials('#2F5D62'));
  const boxes = (w: 'bed' | 'dresser') => mould[w].parts.flatMap((p) => (p instanceof THREE.Mesh ? strips(p) : []));
  return { parent, mould, boxes };
}

describe('bedroom moulding', () => {
  it('lays the bed wall out as the shared layout, with the frames at the default rows', () => {
    const { mould, boxes } = setup();
    mould.bed.layout(bedroom(), DEFAULTS.mouldShop);
    const expected = layoutSection(BEDROOM_MOULD_WALLS[0].sections[0].run, { spacing: 8, dado: 77 }, DEFAULTS.rooms.bedroom.moulding.mouldWalls.bed, BEDX);
    const all = boxes('bed');
    /* rail + 3 columns x 2 frames x 4 strips */
    expect(all).toHaveLength(1 + 3 * 8);
    const outer = (lo: number) =>
      all.filter((b) => Math.abs(b.min.y - lo) < 1e-6 && b.max.y - b.min.y < 0.1).sort((a, b) => a.min.x - b.min.x);
    for (const lo of [0.26, 0.85]) {
      const tops = outer(lo);
      expect(tops).toHaveLength(3);
      tops.forEach((b, i) => {
        expect(b.min.x).toBeCloseTo(expected.columns[i][0]);
        expect(b.max.x).toBeCloseTo(expected.columns[i][1]);
      });
    }
    const lowTop = Math.max(...all.filter((b) => b.max.y < 0.7).map((b) => b.max.y));
    expect(lowTop).toBeCloseTo(0.662);
    const upTop = Math.max(...all.map((b) => b.max.y));
    expect(upTop).toBeCloseTo(3.22);
    const rail = all.find((b) => b.max.x - b.min.x > W - 0.9)!;
    expect(rail.min.x).toBeCloseTo(-W / 2 + WINDOW_WALL_CLEARANCE);
    expect(rail.max.x).toBeCloseTo(WARD_FRONT);
    expect(rail.min.y).toBeCloseTo(0.742);
    expect(rail.max.y).toBeCloseTo(0.77);
    /* the left corner keeps 12 cm clear on top of the spacing; the wardrobe side has the spacing alone */
    expect(expected.columns[0][0]).toBeCloseTo(-W / 2 + 0.12 + 0.08);
    expect(expected.columns[2][1]).toBeCloseTo(WARD_FRONT - 0.08);
  });

  it('draws every frame strip and the rail at the product size, on both walls', () => {
    const { mould, boxes } = setup();
    for (const wall of ['bed', 'dresser'] as const) {
      mould[wall].layout(bedroom(), DEFAULTS.mouldShop);
      const all = boxes(wall);
      const rail = all.reduce((a, b) => (b.max.x - b.min.x > a.max.x - a.min.x ? b : a));
      expect(rail.max.y - rail.min.y).toBeCloseTo(0.028);
      expect(rail.max.z - rail.min.z).toBeCloseTo(0.012);
      for (const b of all.filter((x) => x !== rail)) {
        expect(Math.min(b.max.x - b.min.x, b.max.y - b.min.y)).toBeCloseTo(0.028);
        expect(b.max.z - b.min.z).toBeCloseTo(0.012);
      }
    }
  });

  it('follows a wider, deeper product, and the rows move with the rail', () => {
    const { mould, boxes } = setup();
    const shop = { ...DEFAULTS.mouldShop, panel: { ...DEFAULTS.mouldShop.panel, width: 50, depth: 20 } };
    mould.bed.layout(bedroom(), shop);
    const all = boxes('bed');
    const rail = all.reduce((a, b) => (b.max.x - b.min.x > a.max.x - a.min.x ? b : a));
    expect(rail.max.y - rail.min.y).toBeCloseTo(0.05);
    expect(rail.max.z - rail.min.z).toBeCloseTo(0.02);
    expect(rail.max.y).toBeCloseTo(0.77);
    const lowTop = Math.max(...all.filter((b) => b.max.y < 0.7).map((b) => b.max.y));
    expect(lowTop).toBeCloseTo(0.77 - 0.05 - 0.08);
  });

  it('keeps the bed-wall rail clear of the space behind the wardrobes', () => {
    const { mould, boxes } = setup();
    mould.bed.layout(bedroom(), DEFAULTS.mouldShop);
    const rail = boxes('bed').reduce((a, b) => (b.max.x - b.min.x > a.max.x - a.min.x ? b : a));
    expect(rail.max.x).toBeCloseTo(WARD_FRONT);
  });

  it('starts the bed wall 12 cm plus the spacing from the left corner', () => {
    const { mould, boxes } = setup();
    mould.bed.layout(bedroom({ mouldSpacing: 10 }), DEFAULTS.mouldShop);
    const panels = boxes('bed').filter((b) => b.max.x - b.min.x < W - 0.9);
    expect(Math.min(...panels.map((b) => b.min.x)) - -W / 2).toBeCloseTo(0.22);
    expect(WARD_FRONT - Math.max(...panels.map((b) => b.max.x))).toBeCloseTo(0.1);
  });

  it('rebuilds only the wall whose layout changes', () => {
    const { mould } = setup();
    mould.bed.layout(bedroom(), DEFAULTS.mouldShop);
    mould.dresser.layout(bedroom(), DEFAULTS.mouldShop);
    const bed = [...mould.bed.parts];
    const dresser = [...mould.dresser.parts];
    const withBed = bedroom({ mouldWalls: { ...DEFAULTS.rooms.bedroom.moulding.mouldWalls, bed: { ...DEFAULTS.rooms.bedroom.moulding.mouldWalls.bed, spacing: 12 } } });
    mould.bed.layout(withBed, DEFAULTS.mouldShop);
    mould.dresser.layout(withBed, DEFAULTS.mouldShop);
    expect(mould.bed.parts[0]).not.toBe(bed[0]);
    expect(mould.dresser.parts).toEqual(dresser);
    const room = bedroom({ mouldSpacing: 12 });
    const before = [...mould.bed.parts];
    mould.bed.layout(room, DEFAULTS.mouldShop);
    mould.dresser.layout(room, DEFAULTS.mouldShop);
    /* the bed wall's own spacing wins, so it is unchanged; the dresser wall follows the room */
    expect(mould.bed.parts).toEqual(before);
    expect(mould.dresser.parts[0]).not.toBe(dresser[0]);
  });

  it('draws the dresser rail broken behind the dresser and at the door', () => {
    const { mould, boxes } = setup();
    mould.dresser.layout(bedroom(), DEFAULTS.mouldShop);
    const rails = boxes('dresser')
      .filter((b) => Math.abs(b.max.y - b.min.y - 0.028) < 1e-6 && Math.abs(b.min.y - 0.742) < 1e-6)
      .sort((a, b) => a.min.x - b.min.x);
    expect(rails.map((b) => [b.min.x, b.max.x])).toEqual([
      [expect.closeTo(-W / 2 + 0.12), expect.closeTo(DRESSER_X - 0.4)],
      [expect.closeTo(DRESSER_X + 0.4), expect.closeTo(FRONT_DOOR_X0)],
      [expect.closeTo(FRONT_DOOR_X1), expect.closeTo(W / 2)],
    ]);
    for (const b of rails) expect(b.max.z).toBeCloseTo(L / 2);
  });

  it('frames the space over the door, as wide as its casing, S from the casing and from the ceiling', () => {
    const { mould, boxes } = setup();
    mould.dresser.layout(bedroom({ mouldSpacing: 10 }), DEFAULTS.mouldShop);
    const over = boxes('dresser').filter((b) => b.min.x >= FRONT_DOOR_X0 - 1e-6 && b.max.x <= FRONT_DOOR_X1 + 1e-6);
    /* one frame of four strips */
    expect(over).toHaveLength(4);
    expect(Math.min(...over.map((b) => b.min.x))).toBeCloseTo(FRONT_DOOR_X0);
    expect(Math.max(...over.map((b) => b.max.x))).toBeCloseTo(FRONT_DOOR_X1);
    expect(Math.min(...over.map((b) => b.min.y))).toBeCloseTo(FRONT_DOOR_TOP + 0.1);
    expect(Math.max(...over.map((b) => b.max.y))).toBeCloseTo(H - 0.1);
  });

  it('lays the dresser wall out as one wall, 12 cm plus the spacing from the window wall and clear of the door', () => {
    const { mould, boxes } = setup();
    mould.dresser.layout(bedroom({ mouldSpacing: 10 }), DEFAULTS.mouldShop);
    const panels = boxes('dresser').filter((b) => Math.abs(b.min.y - 0.28) < 1e-6 && b.max.y - b.min.y < 0.1);
    const cols = panels.map((b) => [b.min.x, b.max.x]).sort((p, q) => p[0] - q[0]);
    /* the default four columns: three from the window wall to the door, one from the door to the corner */
    expect(cols).toHaveLength(4);
    expect(cols[0][0] - -W / 2).toBeCloseTo(0.22);
    expect(FRONT_DOOR_X0 - cols[2][1]).toBeCloseTo(0.1);
    expect(cols[3][0] - FRONT_DOOR_X1).toBeCloseTo(0.1);
    expect(W / 2 - cols[3][1]).toBeCloseTo(0.1);
    const widths = cols.slice(0, 3).map(([a, b]) => b - a);
    for (const w of widths) expect(w).toBeCloseTo(widths[0]);
  });
});

describe('dresser wall toggle', () => {
  it('hides every dresser section with the one toggle, and leaves the bed wall', () => {
    const parent = new THREE.Group();
    const room = buildBedroom(parent, '#2F5D62');
    const front = new THREE.Vector3(0, 1.5, 0);
    const state = (on: boolean) => {
      room.apply(applyPatch(DEFAULTS, { rooms: { bedroom: { moulding: { mouldDresserWall: on ? 'on' : 'off' } } } }));
      room.showFrom(front);
      const vis = new Map<THREE.Object3D, boolean>();
      parent.traverse((o) => o instanceof THREE.Mesh && vis.set(o, o.visible));
      return vis;
    };
    const on = state(true);
    /* the moulding meshes, told apart by where they stand: thin strips against the front or the back wall */
    const bbox = (m: THREE.Mesh) => new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position as THREE.BufferAttribute);
    const meshes = [...on.keys()] as THREE.Mesh[];
    const dresser = meshes.filter((m) => {
      const b = bbox(m);
      return b.min.z > L / 2 - 0.0125 && b.max.z < L / 2 + 1e-6 && b.min.y > 0.2 && b.max.y < 3.3;
    });
    const bed = meshes.filter((m) => {
      const b = bbox(m);
      return b.max.z < -L / 2 + 0.0205 && b.min.z > -L / 2 - 1e-6 && b.min.y > 0.2 && b.max.y < 3.3;
    });
    expect(dresser.length).toBeGreaterThan(0);
    expect(bed.length).toBeGreaterThan(0);
    for (const m of dresser) expect(on.get(m)).toBe(true);
    const off = state(false);
    for (const m of dresser) expect(off.get(m)).toBe(false);
    for (const m of bed) expect(off.get(m)).toBe(true);
  });
});
