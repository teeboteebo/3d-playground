import { describe, expect, it } from 'vitest';
import { bedWallLayout } from './layout';

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
