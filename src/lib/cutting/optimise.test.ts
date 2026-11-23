import { describe, expect, it } from 'vitest';
import { bruteForce } from './bruteForce';
import { better, optimise, type CutItem, type CutPlan, type Stock } from './optimise';

const item = (id: string, length: number): CutItem => ({ id, length, maxParts: 1, minPart: length });
const items = (...lengths: number[]) => lengths.map((l, i) => item(`i${i}`, l));

/** a small deterministic random source */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** every item is placed exactly once and every bar holds its cuts */
function expectValid(plan: CutPlan, all: CutItem[], stocks: Stock[], kerf: number) {
  const placed = plan.bars.flatMap((b) => b.cuts.map((c) => c.item)).sort();
  expect(placed).toEqual(all.filter((i) => !plan.unfit.includes(i.id)).map((i) => i.id).sort());
  for (const b of plan.bars) {
    const used = b.cuts.reduce((t, c) => t + c.length, 0) + kerf * (b.cuts.length - 1);
    expect(used).toBeLessThanOrEqual(stocks[b.stock].length);
    expect(b.offcut).toBe(stocks[b.stock].length - used);
  }
  expect(plan.cost).toBe(plan.bars.reduce((t, b) => t + stocks[b.stock].price, 0));
  expect(plan.total).toBe(plan.bars.reduce((t, b) => t + stocks[b.stock].length, 0));
}

describe('optimise', () => {
  it('matches a brute force on 200 random small cases', () => {
    const rand = rng(20261124);
    for (let c = 0; c < 200; c++) {
      const n = 1 + Math.floor(rand() * 7);
      const lengths = Array.from({ length: n }, () => 100 + Math.floor(rand() * 140) * 10);
      const stocks: Stock[] = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => {
        const length = 1200 + Math.floor(rand() * 19) * 100;
        return { length, price: rand() < 0.15 ? 0 : Math.round(length * (2 + rand() * 3)) };
      });
      stocks.push({ length: 3100, price: 12000 }); // everything fits at least this one
      const kerf = Math.floor(rand() * 6);
      const all = items(...lengths);
      const plan = optimise(all, stocks, { kerf });
      const brute = bruteForce(all, stocks, kerf)!;
      expect({ cost: plan.cost, total: plan.total, bars: plan.bars.length }, `case ${c}: ${JSON.stringify({ lengths, stocks, kerf })}`).toEqual(brute);
      expect(plan.proven).toBe(true);
      expectValid(plan, all, stocks, kerf);
    }
  });

  it('buys two 2400 bars for three 1000 pieces, since three need 3006 mm', () => {
    const stocks = [{ length: 2400, price: 8900 }, { length: 3000, price: 10900 }];
    const plan = optimise(items(1000, 1000, 1000), stocks, { kerf: 3 });
    expect(plan.cost).toBe(17800);
    expect(plan.bars.map((b) => stocks[b.stock].length)).toEqual([2400, 2400]);
    expect(plan.proven).toBe(true);
  });

  it('counts a kerf between cuts but not after the last one', () => {
    const stocks = [{ length: 3000, price: 100 }];
    expect(optimise(items(1500, 1497), stocks, { kerf: 3 }).bars).toHaveLength(1);
    expect(optimise(items(1500, 1498), stocks, { kerf: 3 }).bars).toHaveLength(2);
  });

  it('puts an item longer than every stock in unfit and packs the rest', () => {
    const stocks = [{ length: 2400, price: 100 }];
    const all = [item('long', 5000), item('a', 1000)];
    const plan = optimise(all, stocks, { kerf: 3 });
    expect(plan.unfit).toEqual(['long']);
    expect(plan.bars).toHaveLength(1);
    expectValid(plan, all, stocks, 3);
  });

  it('has nothing to buy for nothing to cut, or with no lengths to buy', () => {
    expect(optimise([], [{ length: 2400, price: 100 }], { kerf: 3 })).toMatchObject({ bars: [], cost: 0, total: 0, proven: true, unfit: [] });
    expect(optimise(items(500), [], { kerf: 3 })).toMatchObject({ bars: [], unfit: ['i0'] });
  });

  it('returns the first-fit plan, not proven, when the deadline has already passed', () => {
    const stocks = [{ length: 2400, price: 8900 }, { length: 3000, price: 10900 }];
    const all = items(1000, 900, 800, 700, 600, 500);
    const plan = optimise(all, stocks, { kerf: 3, deadline: 0, now: () => 1000 });
    expect(plan.proven).toBe(false);
    expectValid(plan, all, stocks, 3);
  });

  it('reports each improvement, and every one is strictly better than the last', () => {
    const stocks = [{ length: 2400, price: 8900 }, { length: 3000, price: 10900 }, { length: 2700, price: 9800 }];
    const all = items(1210, 1210, 812, 812, 640, 640, 520, 520, 431, 431, 900, 900, 1050, 1050, 300, 300);
    const seen: CutPlan[] = [];
    const plan = optimise(all, stocks, { kerf: 3, onImprove: (p) => seen.push(p) });
    expect(seen.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < seen.length; i++) expect(better(seen[i], seen[i - 1])).toBe(true);
    expect(plan.proven).toBe(true);
    expect({ cost: plan.cost, total: plan.total }).toEqual({ cost: seen.at(-1)!.cost, total: seen.at(-1)!.total });
  });

  it('proves a bedroom-sized job (60 pieces, 6 lengths, 3 stocks) within 3 seconds', () => {
    const base = [1210, 812, 640, 520, 431, 900];
    const all = base.flatMap((l, k) => Array.from({ length: 10 }, (_, i) => item(`b${k}-${i}`, l)));
    const stocks = [{ length: 2400, price: 8900 }, { length: 3000, price: 10900 }, { length: 2700, price: 9800 }];
    const start = Date.now();
    const plan = optimise(all, stocks, { kerf: 3, deadline: start + 3000 });
    expect(plan.proven).toBe(true);
    expect(Date.now() - start).toBeLessThan(3000);
    expectValid(plan, all, stocks, 3);
  });

  it('ranks plans by cost, then total length, then bars', () => {
    const p = (cost: number, total: number, bars: number): CutPlan => ({ bars: Array.from({ length: bars }, () => ({ stock: 0, cuts: [], offcut: 0 })), cost, total, proven: true, unfit: [] });
    expect(better(p(1, 9, 9), p(2, 1, 1))).toBe(true);
    expect(better(p(2, 1, 9), p(2, 2, 1))).toBe(true);
    expect(better(p(2, 2, 1), p(2, 2, 2))).toBe(true);
    expect(better(p(2, 2, 2), p(2, 2, 2))).toBe(false);
  });
});
