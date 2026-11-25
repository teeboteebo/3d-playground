import { describe, expect, it } from 'vitest';
import { CEILING, type Room, type XZ } from '../data/rooms';
import type { PlacedLeaf } from '../scene/rigidPlacement';
import { clearances, footprintCm, leafClearances } from './clearances';

const room = (poly: XZ[]): Room => ({ id: 'office', name: 'Test', poly, paint: 'x', view: 'x' });
const square = room([[0, 0], [4, 0], [4, 3], [0, 3]]);
const box = (x0: number, z0: number, x1: number, z1: number, over: Partial<PlacedLeaf> = {}): PlacedLeaf => ({
  footprint: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
  bottom: 0, top: 1, mount: { kind: 'floor' }, obstructs: true, ...over,
});
const find = (cs: readonly { label: string; cm: number }[], label: string) => cs.filter((c) => c.label === label).map((c) => c.cm);

describe('clearances', () => {
  it('measures a floor piece from its own edges to the walls, with absolute endpoints', () => {
    const cs = clearances(square, [box(1, 1, 2, 2)]);
    expect(find(cs, '−X to wall')).toEqual([100]);
    expect(find(cs, '+X to wall')).toEqual([200]);
    expect(find(cs, '−Z to wall')).toEqual([100]);
    expect(find(cs, '+Z to wall')).toEqual([100]);
    const left = cs.find((c) => c.label === '−X to wall')!;
    expect(left.from).toMatchObject({ x: 1, z: 1.5 });
    expect(left.to).toMatchObject({ x: 0, z: 1.5, y: left.from.y });
  });

  it('draws nothing for a piece touching the wall', () => {
    expect(find(clearances(square, [box(0, 1, 1, 2)]), '−X to wall')).toEqual([]);
  });

  it('measures to an angled wall along the axis', () => {
    const cut = room([[0, 0], [4, 0], [4, 1], [3, 3], [0, 3]]);
    const cs = clearances(cut, [box(1, 1.5, 2, 2.5)]);
    const right = cs.find((c) => c.label === '+X to wall')!;
    // wall from (4,1) to (3,3): x = 4 − (z − 1)/2, at z = 2 → 3.5
    expect(right.to.x).toBeCloseTo(3.5);
    expect(right.cm).toBe(150);
  });

  it('measures from the tip of a rotated piece', () => {
    const diamond: PlacedLeaf = { ...box(0, 0, 1, 1), footprint: [[2, 0.5], [2.5, 1], [2, 1.5], [1.5, 1]] };
    const cs = clearances(square, [diamond]);
    expect(find(cs, '−X to wall')).toEqual([150]);
    expect(find(cs, '+X to wall')).toEqual([150]);
  });

  it('drops guides that would cross a neighbour, so a group has no guide through its middle', () => {
    const cs = clearances(square, [box(1, 1, 2, 2), box(2, 1, 3, 2)]);
    expect(find(cs, '+X to wall').length).toBe(1);
    expect(cs.filter((c) => c.label === '+X to wall')[0].from.x).toBe(3);
    expect(find(cs, '−X to wall')).toEqual([100]);
  });

  it('ignores rugs as blockers', () => {
    const cs = clearances(square, [box(1, 1, 2, 2), box(0, 0, 4, 3, { top: 0.02, obstructs: false })]);
    expect(find(cs, '+X to wall')).toEqual([200]);
  });

  it('gives a wall piece distances along its wall, to the floor and to the ceiling', () => {
    const shelf = box(1, 0, 2, 0.3, { bottom: 1.2, top: 1.5, mount: { kind: 'wall', edge: 0 } });
    const cs = clearances(square, [shelf]);
    expect([...find(cs, 'Along wall −'), ...find(cs, 'Along wall +')].sort()).toEqual([100, 200])
    expect(find(cs, 'Along wall −')).toEqual([100])
    expect(find(cs, 'Along wall +')).toEqual([200]);
    expect(find(cs, 'Down to floor')).toEqual([120]);
    expect(find(cs, 'Up to ceiling')).toEqual([Math.round((CEILING - 1.5) * 1000) / 10]);
    expect(find(cs, '+Z to wall')).toEqual([]);
    const down = cs.find((c) => c.label === 'Down to floor')!;
    expect(down.to.y).toBe(0);
  });

  it('follows an angled wall for a piece hung on it', () => {
    const cut = room([[0, 0], [3, 0], [4, 3], [0, 3]]);
    const len = Math.hypot(1, 3);
    const leaf = box(0, 0, 1, 1, { footprint: [[3.3, 0.9], [3.5, 1.5], [3.3, 1.5], [3.1, 0.9]], bottom: 1, top: 1.5, mount: { kind: 'wall', edge: 1 } });
    const cs = clearances(cut, [leaf]);
    const along = cs.filter((c) => c.label.startsWith('Along wall'));
    expect(along.length).toBe(2);
    for (const c of along) expect(Math.hypot(c.to.x - c.from.x, c.to.z - c.from.z) / len).toBeGreaterThan(0.1);
    expect(along.some((c) => Math.abs((c.to.x - c.from.x) / (c.to.z - c.from.z) - 1 / 3) < 1e-6)).toBe(true);
  });
});

describe('leafClearances', () => {
  it('keeps both wall distances when unrelated furniture or an overlapping neighbour stands in the way', () => {
    const wall = { kind: 'wall', edge: 0 } as const;
    const a = box(1, 0, 1.5, 0.4, { mount: wall });
    const b = box(1.2, 0, 1.7, 0.4, { mount: wall });
    const other = box(2.5, 0, 3, 0.4);
    const cs = leafClearances(square, [a, b, other], new Set([0, 1]));
    expect(cs.filter((c) => c.leaf === 0).map((c) => c.label)).toContain('Along wall −');
    const ofB = cs.filter((c) => c.leaf === 1 && c.label.startsWith('Along wall'));
    expect(ofB.map((c) => c.label)).toEqual(['Along wall +']);
    const single = leafClearances(square, [a, other], new Set([0]));
    expect(single.filter((c) => c.label.startsWith('Along wall')).map((c) => c.cm).sort()).toEqual([100, 250]);
  });

  it('keeps the nearest look when a selection boxes a piece in on every side', () => {
    const mid = box(1.5, 1, 2.5, 2);
    const ring = [box(0.5, 1, 1.5, 2), box(2.5, 1, 3.5, 2), box(1.5, 0, 2.5, 1), box(1.5, 2, 2.5, 3)];
    const cs = leafClearances(square, [mid, ...ring], new Set([0, 1, 2, 3, 4]));
    expect(cs.filter((c) => c.leaf === 0).length).toBe(1);
  });
});

describe('footprintCm', () => {
  it('sizes a rotated rectangle by its own sides', () => {
    const c = Math.SQRT1_2;
    expect(footprintCm([[0, 0], [2 * c, 2 * c], [c, 3 * c], [-c, c]])).toEqual([200, 100]);
  });
});
