import { expect, it } from 'vitest';
import { CEILING, roomById, type XZ } from '../data/rooms';
import { roomWalls } from '../scene/apartment';
import type { PlacedLeaf } from '../scene/rigidPlacement';
import { elevationGuides, projectOnWall } from './wallElevation';

const leaf = (footprint: XZ[]): PlacedLeaf => ({ footprint, bottom: 0.8, top: 1.5, mount: { kind: 'floor' }, obstructs: true });

it('faces each wall from the interior, preserving height and reversing left/right on opposite walls', () => {
  const [front, , back] = roomWalls(roomById('bedroom'));
  const p = leaf([[-1.9, -0.5], [-1.4, -0.5], [-1.4, 0.5], [-1.9, 0.5]]);
  const a = projectOnWall(front, p)!, b = projectOnWall(back, p)!;
  expect(a.left).toBeCloseTo(0.25);
  expect(b.right).toBeCloseTo(back.length - a.left);
  expect(b.left).toBeCloseTo(back.length - a.right);
  expect(a.top).toBeCloseTo(CEILING - p.top);
  expect(a.bottom).toBeCloseTo(CEILING - p.bottom);
});

it('clips a piece at an angled wall end and measures the setback to the part within the span', () => {
  const bay = roomWalls(roomById('living'))[2];
  const ux = (bay.b[0] - bay.a[0]) / bay.length, uz = (bay.b[1] - bay.a[1]) / bay.length;
  const point = (u: number, depth: number): XZ => [bay.a[0] + ux * u - uz * depth, bay.a[1] + uz * u + ux * depth];
  const result = projectOnWall(bay, leaf([point(-1, 0), point(1, 1), point(0, 1.5)]))!;
  expect(result.left).toBe(0);
  expect(result.right).toBeCloseTo(1);
  expect(result.setback).toBeCloseTo(0.5);
  expect(projectOnWall(bay, leaf([point(-1, 0), point(-1, 1), point(-0.1, 1)]))).toBeNull();
});

it('measures only the outer gaps of the visible group members and omits contacts', () => {
  const wall = roomWalls(roomById('bedroom'))[0];
  const group = [
    { left: 0, right: 0.5, top: 1.2, bottom: 1.8, setback: 0 },
    { left: 2, right: 3.3, top: 0.7, bottom: CEILING, setback: 1 },
  ];
  const guides = elevationGuides(wall, group);
  expect(guides.map((g) => [g.label, Math.round(g.cm)])).toEqual([['To right edge', 100], ['Up to ceiling', 70]]);
});
