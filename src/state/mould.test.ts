import { describe, expect, it } from 'vitest';
import { BEDROOM_MOULD_DEFAULTS, LIVING_MOULD_DEFAULTS, sanitizeMouldWall, withColumns } from './mould';

const tv = LIVING_MOULD_DEFAULTS.tv;
const bed = BEDROOM_MOULD_DEFAULTS.bed;
const opts = { minColumns: 1, allowBed: false } as const;

describe('withColumns', () => {
  it('clears the fixed column when it no longer exists', () => {
    expect(withColumns({ ...tv, fixedColumn: 2 }, 1).fixedColumn).toBe(0);
    expect(withColumns(tv, 4).fixedColumn).toBe(2);
    expect(withColumns(tv, 4).columns).toBe(4);
  });
});

describe('defaults', () => {
  it('match the design', () => {
    expect(bed).toMatchObject({ columns: 3, fixedColumn: 2, fixedWidth: 180, fixedPosition: 'bed', spacing: null });
    expect(tv).toMatchObject({ columns: 3, fixedColumn: 2, fixedWidth: 170, fixedPosition: 'even' });
    expect(LIVING_MOULD_DEFAULTS.sofa).toMatchObject({ columns: 5, fixedColumn: 0, fixedWidth: 100, fixedPosition: 'even', fixedCentre: 0 });
    expect(BEDROOM_MOULD_DEFAULTS.dresser).toMatchObject({ columns: 4, fixedColumn: 0, fixedPosition: 'even' });
    expect(Object.keys(BEDROOM_MOULD_DEFAULTS)).toEqual(['bed', 'dresser']);
  });
});

describe('sanitizeMouldWall', () => {
  it('clamps spacing to 4-30 and keeps null', () => {
    expect(sanitizeMouldWall({ spacing: 2 }, tv, opts).spacing).toBe(4);
    expect(sanitizeMouldWall({ spacing: 99 }, tv, opts).spacing).toBe(30);
    expect(sanitizeMouldWall({ spacing: null }, tv, opts).spacing).toBeNull();
    expect(sanitizeMouldWall({ spacing: 12 }, tv, opts).spacing).toBe(12);
  });
  it('clamps and rounds columns', () => {
    expect(sanitizeMouldWall({ columns: 0 }, tv, opts).columns).toBe(1);
    expect(sanitizeMouldWall({ columns: 0 }, tv, { minColumns: 0, allowBed: false }).columns).toBe(0);
    expect(sanitizeMouldWall({ columns: 99 }, tv, opts).columns).toBe(10);
    expect(sanitizeMouldWall({ columns: 3.6 }, tv, opts).columns).toBe(4);
  });
  it('zeroes a fixed column beyond the count', () => {
    expect(sanitizeMouldWall({ columns: 3, fixedColumn: 4 }, tv, opts).fixedColumn).toBe(0);
    expect(sanitizeMouldWall({ columns: 3, fixedColumn: 3 }, tv, opts).fixedColumn).toBe(3);
  });
  it("turns 'bed' into 'even' unless allowed", () => {
    expect(sanitizeMouldWall({ fixedPosition: 'bed' }, tv, opts).fixedPosition).toBe('even');
    expect(sanitizeMouldWall({ fixedPosition: 'bed' }, bed, { minColumns: 1, allowBed: true }).fixedPosition).toBe('bed');
  });
  it('clamps width and centre, and replaces junk with defaults', () => {
    expect(sanitizeMouldWall({ fixedWidth: 5 }, tv, opts).fixedWidth).toBe(20);
    expect(sanitizeMouldWall({ fixedWidth: 900 }, tv, opts).fixedWidth).toBe(500);
    expect(sanitizeMouldWall({ fixedCentre: -5 }, tv, opts).fixedCentre).toBe(0);
    expect(sanitizeMouldWall({ fixedCentre: 250 }, tv, opts).fixedCentre).toBe(250);
    expect(sanitizeMouldWall('x', tv, opts)).toEqual(tv);
    expect(sanitizeMouldWall({ spacing: 'abc', columns: NaN, fixedColumn: 'q', fixedWidth: NaN, fixedPosition: 7, fixedCentre: 'z' }, tv, opts)).toEqual(tv);
  });
});
