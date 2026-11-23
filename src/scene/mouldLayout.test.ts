import { describe, expect, it } from 'vitest';
import { CEILING, SKIRTING } from '../data/rooms';
import { MIN_COL, dadoRange, layoutSection, layoutWall, rows, segments, shareColumns, spacingMax, type MouldWall } from './mouldLayout';

const wall = (o: Partial<MouldWall> = {}): MouldWall => ({
  spacing: null,
  columns: 3,
  fixedColumn: 0,
  fixedWidth: 100,
  fixedPosition: 'even',
  fixedCentre: 0,
  ...o,
});
const room = { spacing: 8, dado: 77 };

describe('rows', () => {
  it('puts every row one spacing from its neighbours', () => {
    const r = rows(0.08, 0.77);
    expect(r.rail).toEqual([0.73, 0.77]);
    expect(r.lower![0]).toBeCloseTo(0.26);
    expect(r.lower![1]).toBeCloseTo(0.65);
    expect(r.upper![0]).toBeCloseTo(0.85);
    expect(r.upper![1]).toBeCloseTo(3.22);
  });
  it('drops a row that would be shorter than the minimum', () => {
    const r = rows(0.3, 0.77);
    expect(r.lower).toBeNull();
    expect(r.upper).not.toBeNull();
  });
  it('derives the spacing and dado limits from the minimum row height', () => {
    expect(spacingMax(0.77)).toBeCloseTo(0.225);
    expect(dadoRange(0.08).min).toBeCloseTo(0.48);
    expect(dadoRange(0.08).max).toBeCloseTo(3.04);
  });
});

describe('layoutSection rules', () => {
  type Pos = [pos: 'even' | 'custom' | 'bed', centre: number, bedX: 'in' | 'out' | 'none'];
  const positions: Pos[] = [['even', 0, 'none']];
  for (const pc of [-0.1, 0, 0.25, 0.5, 0.75, 1, 1.1]) positions.push(['custom', pc, 'none']);
  positions.push(['bed', 0, 'in'], ['bed', 0, 'out']);
  const cases: [number[], number, number, number, number, ...Pos][] = [];
  for (const run of [[0, 3.72], [0, 1.59]])
    for (const s of [4, 8, 15, 30])
      for (let n = 1; n <= 10; n++)
        for (const f of [...new Set([0, 1, 2, Math.ceil(n / 2), n])])
          for (const w of [20, 100, 500])
            for (const p of positions) cases.push([run, s, n, f, w, ...p]);
  it.each(cases)('run %j S %i n %i fixed %i w %i %s %f bed %s', (run, s, n, f, w, pos, pc, bed) => {
    const [a, b] = run;
    const bedX = bed === 'in' ? a + (b - a) * 0.4 : bed === 'out' ? b + 1 : undefined;
    const l = layoutSection(
      [a, b],
      { spacing: s, dado: 77 },
      wall({ columns: n, fixedColumn: f, fixedWidth: w, fixedPosition: pos, fixedCentre: pc * (b - a) * 100 }),
      bedX,
    );
    if (l.fixed && l.limits.fixedCentre) {
      const rel = (l.fixed.centre - a) * 100;
      expect(rel).toBeGreaterThanOrEqual(l.limits.fixedCentre.min - 1e-6);
      expect(rel).toBeLessThanOrEqual(l.limits.fixedCentre.max + 1e-6);
    }
    const S = s / 100;
    expect(l.spacing).toBeCloseTo(S, 12);
    if (l.count > 0) {
      expect(l.columns[0][0]).toBeCloseTo(a + S, 9);
      expect(l.columns[l.count - 1][1]).toBeCloseTo(b - S, 9);
      for (let i = 1; i < l.count; i++) expect(l.columns[i][0] - l.columns[i - 1][1]).toBeCloseTo(S, 9);
      for (const [x0, x1] of l.columns) expect(x1 - x0).toBeGreaterThanOrEqual(MIN_COL - 1e-9);
    }
    const { rail, lower, upper } = l.rows;
    if (lower) {
      expect(lower[0] - SKIRTING).toBeCloseTo(S, 9);
      expect(rail[0] - lower[1]).toBeCloseTo(S, 9);
    }
    if (upper) {
      expect(upper[0] - rail[1]).toBeCloseTo(S, 9);
      expect(CEILING - upper[1]).toBeCloseTo(S, 9);
    }
  });
});

describe('layoutSection defaults', () => {
  it('lays out the bed wall around the bed centre', () => {
    const l = layoutSection([-2.15, 1.57], room, wall({ fixedColumn: 2, fixedWidth: 180, fixedPosition: 'bed' }), -0.33);
    const exp = [[-2.07, -1.31], [-1.23, 0.57], [0.65, 1.49]];
    l.columns.forEach((c, i) => {
      expect(c[0]).toBeCloseTo(exp[i][0]);
      expect(c[1]).toBeCloseTo(exp[i][1]);
    });
    expect(l.fixed!.index).toBe(1);
  });
  it('falls back to even when the bed position is unknown', () => {
    const l = layoutSection([0, 4], room, wall({ fixedColumn: 2, fixedPosition: 'bed' }));
    expect(l.fixed!.centre).toBeCloseTo(2);
  });
  it('lays out the TV wall', () => {
    const l = layoutSection([3.69, 7.376], room, wall({ fixedColumn: 2, fixedWidth: 170 }));
    expect(l.columns[1][0]).toBeCloseTo(4.683);
    expect(l.columns[1][1]).toBeCloseTo(6.383);
    expect(l.columns[1][0]).toBeLessThanOrEqual(4.85);
    expect(l.columns[1][1]).toBeGreaterThanOrEqual(6.31);
  });
});

describe('layoutSection clamping', () => {
  it('draws fewer columns than saved when they do not fit', () => {
    const w = wall({ columns: 10 });
    const l = layoutSection([0, 1.59], { spacing: 30, dado: 77 }, w);
    expect(l.count).toBe(2);
    expect(l.limits.maxColumns).toBe(2);
    expect(w.columns).toBe(10);
  });
  it('draws no fixed column when it is beyond the drawn count', () => {
    expect(layoutSection([0, 4], room, wall({ columns: 2, fixedColumn: 3 })).fixed).toBeNull();
  });
  it('clamps the fixed width', () => {
    const l = layoutSection([0, 4], room, wall({ fixedColumn: 2, fixedWidth: 500 }));
    expect(l.fixed!.width * 100).toBeCloseTo(l.limits.fixedWidth!.max);
  });
  it('draws a narrow fixed width at the minimum', () => {
    expect(layoutSection([0, 4], room, wall({ fixedColumn: 2, fixedWidth: 5 })).fixed!.width).toBeCloseTo(MIN_COL);
  });
  it('clamps the custom centre', () => {
    const l = layoutSection([1, 5], room, wall({ fixedColumn: 2, fixedPosition: 'custom', fixedCentre: 0 }));
    expect((l.fixed!.centre - 1) * 100).toBeCloseTo(l.limits.fixedCentre!.min);
  });
  it('returns the rows with no columns', () => {
    const l = layoutSection([0, 4], room, wall({ columns: 0 }));
    expect(l.columns).toEqual([]);
    expect(l.rows.rail).toEqual([0.73, 0.77]);
  });
});

describe('layoutWall around a door', () => {
  const room = { spacing: 10, dado: 77 };
  const w = (p: Partial<MouldWall> = {}): MouldWall => ({
    spacing: null, columns: 4, fixedColumn: 0, fixedWidth: 100, fixedPosition: 'even', fixedCentre: 0, ...p,
  });
  const run: [number, number] = [0, 4];
  const door: [number, number] = [2.5, 3.2];

  it('splits the run at the gaps', () => {
    expect(segments(run, [door])).toEqual([[0, 2.5], [3.2, 4]]);
    expect(segments(run, [[-1, 0.5], [3.5, 9]])).toEqual([[0.5, 3.5]]);
    expect(segments(run, [])).toEqual([run]);
  });

  it('gives every stretch a column before evening out the widths', () => {
    const segs = segments(run, [door]);
    expect(shareColumns(segs, 0.1, 1)).toEqual([1, 0]);
    expect(shareColumns(segs, 0.1, 2)).toEqual([1, 1]);
    expect(shareColumns(segs, 0.1, 4)).toEqual([3, 1]);
    /* a stretch too narrow for a column gets none */
    expect(shareColumns([[0, 2], [2.5, 2.7]], 0.1, 3)).toEqual([3, 0]);
  });

  it('keeps the spacing from both ends and from the door', () => {
    const l = layoutWall(run, [door], room, w());
    expect(l.count).toBe(4);
    const [a, b, c, d] = l.columns;
    expect(a[0]).toBeCloseTo(0.1);
    expect(door[0] - c[1]).toBeCloseTo(0.1);
    expect(b[0] - a[1]).toBeCloseTo(0.1);
    expect(d).toEqual([expect.closeTo(3.3), expect.closeTo(3.9)]);
    for (const [x0, x1] of l.columns) expect(x1 <= door[0] + 1e-9 || x0 >= door[1] - 1e-9).toBe(true);
  });

  it('caps the columns at what fits either side', () => {
    const l = layoutWall(run, [door], room, w({ columns: 10 }));
    expect(l.limits.maxColumns).toBe(Math.floor(2.4 / (MIN_COL + 0.1)) + Math.floor(0.7 / (MIN_COL + 0.1)));
    expect(l.count).toBe(l.limits.maxColumns);
  });

  it('places the fixed column in its stretch, with the custom centre measured from the run start', () => {
    const right = layoutWall(run, [door], room, w({ fixedColumn: 4, fixedWidth: 40 }));
    expect(right.fixed).toMatchObject({ index: 3, centre: expect.closeTo(3.6) });
    /* alone in its stretch, it fills it and cannot move */
    expect(right.limits.fixedCentre).toEqual({ min: expect.closeTo(360), max: expect.closeTo(360) });
    const left = layoutWall(run, [door], room, w({ fixedColumn: 2, fixedWidth: 60, fixedPosition: 'custom', fixedCentre: 120 }));
    expect(left.fixed).toMatchObject({ index: 1, width: expect.closeTo(0.6), centre: expect.closeTo(1.2) });
    expect(left.limits.fixedCentre!.min).toBeGreaterThan(0);
    expect(left.limits.fixedCentre!.max * 0.01).toBeLessThan(door[0]);
  });

  it('is layoutSection when nothing is in the way', () => {
    expect(layoutWall(run, [], room, w({ fixedColumn: 2 }))).toEqual(layoutSection(run, room, w({ fixedColumn: 2 })));
  });
});
