import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../state/settings';
import type { MouldWall } from './mouldLayout';
import { wallPieces } from './mouldPieces';
import { drawRail, drawSection, frames, railSegments, type StripFn } from './mouldStrips';
import { BEDROOM_MOULD_WALLS, LIVING_MOULD_WALLS, wallLayouts, type MouldWallDef } from './mouldWalls';

const ALL: [string, MouldWallDef<string>][] = [...BEDROOM_MOULD_WALLS, ...LIVING_MOULD_WALLS].map((d) => [d.label, d as MouldWallDef<string>]);

const defaults: Record<string, MouldWall> = { ...DEFAULTS.bedroom.mouldWalls, ...DEFAULTS.living.mouldWalls };
const walls = (def: MouldWallDef<string>, columns: number) =>
  Object.fromEntries(def.sections.map((s) => [s.key, { ...defaults[s.key], columns }])) as Record<string, MouldWall>;
const layoutsOf = (def: MouldWallDef<string>, spacing: number, columns: number, rail = 2.8) =>
  wallLayouts(def, { spacing, dado: 77, rail }, walls(def, columns), -0.33);

interface Box { x0: number; x1: number; y0: number; y1: number }

/** what drawSection draws, as the bounding box of each frame's four strips */
function drawnFrames(layouts: ReturnType<typeof layoutsOf>, t: number): Box[] {
  const strips: Box[] = [];
  const rec: StripFn = (w, h, x, y) => strips.push({ x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 });
  for (const l of layouts) drawSection(rec, l, t);
  const out: Box[] = [];
  for (let i = 0; i < strips.length; i += 4) {
    const q = strips.slice(i, i + 4);
    out.push({ x0: Math.min(...q.map((s) => s.x0)), x1: Math.max(...q.map((s) => s.x1)), y0: Math.min(...q.map((s) => s.y0)), y1: Math.max(...q.map((s) => s.y1)) });
  }
  return out;
}

describe('frames', () => {
  const cases: [string, MouldWallDef<string>, number, number, number][] = [];
  for (const [name, def] of ALL) for (const s of [4, 8, 20]) for (const n of [1, 3, 6]) for (const rail of [2.8, 4]) cases.push([name, def, s, n, rail]);
  it.each(cases)('%s S %i n %i rail %f: each frame is the outer box of its four drawn strips', (_n, def, s, n, rail) => {
    const layouts = layoutsOf(def, s, n, rail);
    const listed = frames(layouts);
    const drawn = drawnFrames(layouts, 0.028);
    expect(listed).toHaveLength(drawn.length);
    listed.forEach((f, i) => {
      expect(f.x[0]).toBeCloseTo(drawn[i].x0, 9);
      expect(f.x[1]).toBeCloseTo(drawn[i].x1, 9);
      expect(f.y[0]).toBeCloseTo(drawn[i].y0, 9);
      expect(f.y[1]).toBeCloseTo(drawn[i].y1, 9);
    });
  });

  it('numbers the columns across the wall and tags the frame over the door', () => {
    const dresser = BEDROOM_MOULD_WALLS[1] as MouldWallDef<string>;
    const list = frames(layoutsOf(dresser, 8, 4));
    expect(list.filter((f) => f.row === 'lower').map((f) => f.column)).toEqual([1, 2, 3, 4]);
    expect(list.filter((f) => f.row === 'over')).toEqual([expect.objectContaining({ name: 'door', column: 0 })]);
  });
});

describe('railSegments', () => {
  it('drops empty segments and draws each remaining one', () => {
    expect(railSegments([[0, 1], [2, 2], [3, 2], [4, 6]])).toEqual([[0, 1], [4, 6]]);
    const drawn: number[] = [];
    drawRail((w) => drawn.push(w), [[0, 1], [2, 2], [4, 6]], [0.7, 0.77]);
    expect(drawn).toEqual([1, 2]);
  });
});

describe('wallPieces', () => {
  it('gives the bed wall 24 mitred frame pieces and one square rail piece by default', () => {
    const def = BEDROOM_MOULD_WALLS[0] as MouldWallDef<string>;
    const pieces = wallPieces(def, layoutsOf(def, 8, 3));
    expect(pieces.filter((p) => p.kind === 'frame')).toHaveLength(24);
    const rails = pieces.filter((p) => p.kind === 'rail');
    expect(rails).toHaveLength(1);
    expect(rails[0].ends).toEqual(['square', 'square']);
    for (const p of pieces.filter((x) => x.kind === 'frame')) expect(p.ends).toEqual(['mitre', 'mitre']);
  });

  it('cuts each side to the frame outer size, in whole mm', () => {
    const def = BEDROOM_MOULD_WALLS[0] as MouldWallDef<string>;
    const layouts = layoutsOf(def, 8, 3);
    const first = frames(layouts)[0];
    const side = (s: string) => wallPieces(def, layouts).find((p) => p.label === `Bed wall · lower · column 1 · ${s}`)!;
    expect(side('top').length).toBe(Math.round((first.x[1] - first.x[0]) * 1000));
    expect(side('bottom').length).toBe(side('top').length);
    expect(side('left').length).toBe(Math.round((first.y[1] - first.y[0]) * 1000));
    expect(side('right').length).toBe(side('left').length);
  });

  it('lists the four pieces of the frame over the door and every rail segment', () => {
    const def = BEDROOM_MOULD_WALLS[1] as MouldWallDef<string>;
    const layouts = layoutsOf(def, 8, 4);
    const pieces = wallPieces(def, layouts);
    expect(pieces.filter((p) => p.label.startsWith('Dresser wall · over door'))).toHaveLength(4);
    expect(pieces.filter((p) => p.label.startsWith('Dresser wall · over door')).map((p) => p.label.split(' · ')[2])).toEqual(['top', 'bottom', 'left', 'right']);
    const rails = pieces.filter((p) => p.kind === 'rail');
    expect(rails.map((p) => p.label)).toEqual(['Dresser wall · rail · 1 of 3', 'Dresser wall · rail · 2 of 3', 'Dresser wall · rail · 3 of 3']);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
  });

  it('lists only the drawn columns when a large spacing clamps the count', () => {
    const def = LIVING_MOULD_WALLS[0] as MouldWallDef<string>;
    const layouts = layoutsOf(def, 30, 10);
    const drawn = layouts.reduce((t, l) => t + l.count, 0);
    expect(drawn).toBeLessThan(10);
    const rows = layouts[0].rows.lower && layouts[0].rows.upper ? 2 : 1;
    expect(wallPieces(def, layouts).filter((p) => p.kind === 'frame')).toHaveLength(drawn * rows * 4);
  });

  it('every wall in both rooms has unique ids and positive lengths', () => {
    for (const [, def] of ALL) {
      const pieces = wallPieces(def, layoutsOf(def, 8, 3));
      expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
      for (const p of pieces) expect(p.length).toBeGreaterThan(0);
    }
  });
});

describe('wide profiles (review finding)', () => {
  const cases: [string, MouldWallDef<string>, number, number, number, number][] = [];
  for (const [name, def] of ALL) for (const w of [28, 60, 90, 120]) for (const s of [4, 8, 14]) for (const dado of [60, 77, 110]) cases.push([name, def, w, s, dado, 3]);
  it.each(cases)('%s, profile %i mm, S %i, dado %i: every frame side is room for two mitres', (_n, def, w, s, dado, n) => {
    const room = { spacing: s, dado, rail: Math.min(w, 60) / 10, frame: w / 10 };
    const layouts = wallLayouts(def, room, walls(def, n), -0.33);
    for (const f of frames(layouts)) {
      expect(f.x[1] - f.x[0]).toBeGreaterThanOrEqual((2 * w) / 1000 - 1e-9);
      expect(f.y[1] - f.y[0]).toBeGreaterThanOrEqual((2 * w) / 1000 - 1e-9);
    }
    expect(drawnFrames(layouts, w / 1000).every((b) => b.y1 - b.y0 > 0 && b.x1 - b.x0 > 0)).toBe(true);
  });

  it('draws fewer columns for a wider profile instead of squeezing them', () => {
    const def = LIVING_MOULD_WALLS[0] as MouldWallDef<string>;
    const count = (w: number) => wallLayouts(def, { spacing: 30, dado: 77, rail: 2.8, frame: w / 10 }, walls(def, 10), undefined).reduce((t, l) => t + l.count, 0);
    expect(count(120)).toBeLessThan(count(28));
  });
});
