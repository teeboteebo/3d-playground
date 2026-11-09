import { describe, expect, it } from 'vitest';
import { CEILING, OPENINGS, ROOMS, apartmentBounds, centroid, roomSize } from '../data/rooms';
import { roomWalls } from './apartment';
import { SHELL_ROOMS } from './buildApartment';

const room = (id: string) => ROOMS.find((r) => r.id === id)!;

const size = (id: string) => {
  const xs = room(id).poly.map((p) => p[0]);
  const zs = room(id).poly.map((p) => p[1]);
  return [Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)];
};

describe('apartment rooms', () => {
  it('keeps the room sizes measured in the SketchUp model', () => {
    expect(size('hall')[0]).toBeCloseTo(1.14);
    expect(size('hall')[1]).toBeCloseTo(3.1);
    expect(size('living')[0]).toBeCloseTo(5.0);
    expect(size('living')[1]).toBeCloseTo(4.65);
    expect(size('office')[0]).toBeCloseTo(3.0);
    expect(size('office')[1]).toBeCloseTo(4.0);
  });

  it('leaves 20 cm inner walls between neighbouring rooms, starting at the bedroom (x = 2.15)', () => {
    const minX = (id: string) => Math.min(...room(id).poly.map((p) => p[0]));
    const maxX = (id: string) => Math.max(...room(id).poly.map((p) => p[0]));
    expect(minX('hall') - 2.15).toBeCloseTo(0.2);
    expect(minX('living') - maxX('hall')).toBeCloseTo(0.2);
    expect(minX('office') - maxX('living')).toBeCloseTo(0.2);
  });

  it('orients every wall to face into its room', () => {
    for (const r of ROOMS) {
      const c = centroid(r.poly);
      for (const w of roomWalls(r)) {
        const dx = (w.b[0] - w.a[0]) / w.length;
        const dz = (w.b[1] - w.a[1]) / w.length;
        expect(-dz * (c[0] - w.a[0]) + dx * (c[1] - w.a[1])).toBeGreaterThan(0);
      }
    }
  });

  it('cuts each opening into the walls on both sides of it', () => {
    const walls = SHELL_ROOMS.flatMap((r) => roomWalls(r));
    const cuts = (i: number) => walls.filter((w) => w.holes.some((h) => h.opening === OPENINGS[i])).map((w) => w.room.id);
    expect(cuts(0)).toEqual(['hall']); // the bedroom side is built by the bedroom itself
    expect(cuts(1).sort()).toEqual(['hall', 'living']);
    expect(cuts(2).sort()).toEqual(['living', 'office']);
    expect(cuts(3)).toEqual(['living']);
    expect(cuts(4)).toEqual(['office']);
    expect(cuts(5)).toEqual(['office']);
  });

  it('keeps openings inside their wall and under the ceiling', () => {
    for (const w of ROOMS.flatMap((r) => roomWalls(r))) {
      for (const h of w.holes) {
        expect(h.u0).toBeGreaterThanOrEqual(0);
        expect(h.u1).toBeLessThanOrEqual(w.length + 1e-9);
        expect(h.u1 - h.u0).toBeGreaterThan(0.4);
        expect(h.opening.y1).toBeLessThan(CEILING);
      }
    }
  });

  it('leaves the hall open where the model stops', () => {
    expect(roomWalls(room('hall'))).toHaveLength(3);
  });

  it('spans the bedroom through the office', () => {
    const b = apartmentBounds();
    expect(b.minX).toBeCloseTo(-2.15);
    expect(b.maxX).toBeCloseTo(11.89);
  });

  it('labels each room with its outline size', () => {
    expect(ROOMS.map((r) => `${r.name}: ${roomSize(r)}`)).toEqual([
      'Bedroom: 430 × 395 cm',
      'Hall: 114 × 310 cm',
      'Living room: 500 × 465 cm',
      'Office: 300 × 400 cm',
    ]);
  });
});
