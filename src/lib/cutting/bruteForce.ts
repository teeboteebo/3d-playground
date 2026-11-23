import type { CutItem, Stock } from './optimise';

export interface Best {
  cost: number;
  total: number;
  bars: number;
}

const lexLess = (a: Best, b: Best) => a.cost !== b.cost ? a.cost < b.cost : a.total !== b.total ? a.total < b.total : a.bars < b.bars;

/**
 * The best (cost, then total length, then bar count) way to cut whole items from stock lengths, found by trying every way
 * to group the items into bars and giving each bar its cheapest stock length that fits. For tests: use few items.
 */
export function bruteForce(items: readonly CutItem[], stocks: readonly Stock[], kerf: number): Best | null {
  if (items.some((i) => i.length > Math.max(0, ...stocks.map((s) => s.length)))) return null;
  let best: Best | null = null;
  const groups: number[][] = [];
  const price = (need: number) => {
    let pick: Stock | null = null;
    for (const s of stocks) {
      if (s.length < need) continue;
      if (!pick || s.price < pick.price || (s.price === pick.price && s.length < pick.length)) pick = s;
    }
    return pick;
  };
  const place = (i: number) => {
    if (i === items.length) {
      let cost = 0;
      let total = 0;
      for (const g of groups) {
        const need = g.reduce((t, l) => t + l, 0) + kerf * (g.length - 1);
        const s = price(need);
        if (!s) return;
        cost += s.price;
        total += s.length;
      }
      const cand = { cost, total, bars: groups.length };
      if (!best || lexLess(cand, best)) best = cand;
      return;
    }
    for (const g of groups) {
      g.push(items[i].length);
      place(i + 1);
      g.pop();
    }
    groups.push([items[i].length]);
    place(i + 1);
    groups.pop();
  };
  place(0);
  return best;
}

/** the whole piece, and every way to cut `length` into 2 to `maxParts` parts of at least `minPart`, on a grid */
function splits(length: number, maxParts: number, minPart: number, grid: number): number[][] {
  const out: number[][] = [[length]];
  const go = (left: number, parts: number[], lo: number) => {
    if (left === 0) {
      if (parts.length >= 2) out.push(parts);
      return;
    }
    if (parts.length === maxParts) return;
    for (let p = Math.max(lo, minPart); p <= left; p += grid) if (left - p === 0 || left - p >= p) go(left - p, [...parts, p], p);
  };
  go(length, [], grid);
  return out;
}

/**
 * Like bruteForce, but an item with maxParts above 1 may also be cut into parts (on `grid` mm steps), the parts going
 * into bars like any other piece. For tests: use few items.
 */
export function bruteForceSplit(items: readonly CutItem[], stocks: readonly Stock[], kerf: number, grid: number): Best | null {
  let best: Best | null = null;
  const choose = (i: number, pieces: CutItem[]) => {
    if (i === items.length) {
      const r = bruteForce(pieces, stocks, kerf);
      if (r && (!best || lexLess(r, best))) best = r;
      return;
    }
    const it = items[i];
    for (const parts of splits(it.length, it.maxParts, it.minPart, grid)) {
      choose(i + 1, [...pieces, ...parts.map((length, k) => ({ id: `${it.id}.${k}`, length, maxParts: 1, minPart: length }))]);
    }
  };
  choose(0, []);
  return best;
}
