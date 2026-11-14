import { describe, expect, it } from 'vitest';
import { bedWallLayout, wallLayout } from './layout';

describe('bedWallLayout', () => {
  it('lays out three columns symmetrically for the defaults', () => {
    const l = bedWallLayout(180, 8, 68);
    expect(l.centreHalf).toBeCloseTo(0.9);
    expect(l.gap).toBeCloseTo(0.08);
    expect(l.sideWidth).toBeCloseTo(0.68);
    expect(l.columns[1]).toEqual([-0.9, 0.9]);
    expect(l.columns[0][0]).toBeCloseTo(-1.66);
    expect(l.columns[2][1]).toBeCloseTo(1.66);
    expect(l.tableOffset).toBeCloseTo(1.32);
  });

  it('shrinks the gap so columns fit the wall', () => {
    const l = bedWallLayout(200, 30, 80);
    expect(l.gap).toBeCloseTo(0.04);
    expect(l.sideWidth).toBeCloseTo(0.8);
    expect(l.columns[2][1]).toBeCloseTo(1.84);
  });

  it('shrinks side columns when even the minimum gap does not fit', () => {
    const l = bedWallLayout(200, 4, 90);
    expect(l.gap).toBeCloseTo(0.04);
    expect(l.sideWidth).toBeCloseTo(0.8);
  });

  it('never puts the bedside tables closer than 1.115 m to the bed centre', () => {
    expect(bedWallLayout(150, 4, 50).tableOffset).toBeCloseTo(1.115);
  });
});

describe('wallLayout', () => {
  it('keeps the bed-wall layout as it was', () => {
    expect(bedWallLayout(180, 8, 68)).toEqual({
      centreHalf: 0.9,
      gap: 0.08,
      sideWidth: 0.68,
      columns: [[-1.6600000000000001, -0.98], [-0.9, 0.9], [0.98, 1.6600000000000001]],
      tableOffset: 1.32,
    });
  });
  it('widens the centre column to the minimum', () => {
    const l = wallLayout(150, 8, 68, 1.75, 1.66);
    expect(l.centreHalf).toBeCloseTo(0.83);
    expect(l.columns[2][1]).toBeLessThanOrEqual(1.75 + 1e-9);
  });
});
