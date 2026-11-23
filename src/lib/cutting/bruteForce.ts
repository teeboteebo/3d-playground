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
