import { describe, expect, it } from 'vitest';
import { bruteForce, bruteForceSplit } from './bruteForce';
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

/** every item is cut exactly (in parts, if it is split), every part is long enough, and every bar holds its cuts */
function expectValid(plan: CutPlan, all: CutItem[], stocks: Stock[], kerf: number) {
  for (const it of all) {
    const cuts = plan.bars.flatMap((b) => b.cuts).filter((c) => c.item === it.id);
    if (plan.unfit.includes(it.id)) {
      expect(cuts).toHaveLength(0);
      continue;
    }
    expect(cuts.reduce((t, c) => t + c.length, 0), it.id).toBe(it.length);
    expect(cuts.length).toBeLessThanOrEqual(it.maxParts);
    if (cuts.length === 1) expect(cuts[0].part).toBeUndefined();
    else {
      for (const c of cuts) {
        expect(c.length).toBeGreaterThanOrEqual(it.minPart);
        expect(c.part!.of).toBe(cuts.length);
      }
      expect(cuts.map((c) => c.part!.index).sort()).toEqual(cuts.map((_, i) => i + 1));
    }
  }
  for (const b of plan.bars) {
    const used = b.cuts.reduce((t, c) => t + c.length, 0) + kerf * (b.cuts.length - 1);
    expect(used).toBeLessThanOrEqual(stocks[b.stock].length);
    expect(b.offcut).toBe(stocks[b.stock].length - used);
  }
  expect(plan.cost).toBe(plan.bars.reduce((t, b) => t + stocks[b.stock].price, 0));
  expect(plan.total).toBe(plan.bars.reduce((t, b) => t + stocks[b.stock].length, 0));
}

/** pieces that can really be split: with two or more, the search is good but does not claim to be exact */
const splittableCount = (all: CutItem[]) => all.filter((i) => i.maxParts >= 2 && i.length >= 2 * Math.max(10, i.minPart)).length;

/** the plan against the brute force over every split: equal and proven when at most one piece is split, else valid, no better, unproven */
function expectAgainstBrute(plan: CutPlan, all: CutItem[], stocks: Stock[], label: string) {
  const brute = bruteForceSplit(all, stocks, 0, 100)!;
  if (splittableCount(all) <= 1) {
    expect({ cost: plan.cost, total: plan.total, bars: plan.bars.length }, label).toEqual(brute);
    expect(plan.proven, label).toBe(true);
  } else {
    expect(plan.cost, label).toBeGreaterThanOrEqual(brute.cost);
    expect(plan.proven, label).toBe(false);
  }
  expectValid(plan, all, stocks, 0);
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

  it('proves a bedroom-sized job (60 pieces, 6 lengths, 3 stocks) well within 10 seconds', () => {
    const base = [1210, 812, 640, 520, 431, 900];
    const all = base.flatMap((l, k) => Array.from({ length: 10 }, (_, i) => item(`b${k}-${i}`, l)));
    const stocks = [{ length: 2400, price: 8900 }, { length: 3000, price: 10900 }, { length: 2700, price: 9800 }];
    const start = Date.now();
    const plan = optimise(all, stocks, { kerf: 3, deadline: start + 10000 });
    expect(plan.proven).toBe(true);
    expect(Date.now() - start).toBeLessThan(10000);
    expectValid(plan, all, stocks, 3);
  });

  it('ranks plans by cost, then total length, then bars', () => {
    const p = (cost: number, total: number, bars: number): CutPlan => ({ bars: Array.from({ length: bars }, () => ({ stock: 0, cuts: [], offcut: 0 })), cost, total, proven: true, unfit: [] });
    expect(better(p(1, 9, 9), p(2, 1, 1))).toBe(true);
    expect(better(p(2, 1, 9), p(2, 2, 1))).toBe(true);
    expect(better(p(2, 2, 1), p(2, 2, 2))).toBe(true);
    expect(better(p(2, 2, 2), p(2, 2, 2))).toBe(false);
  });

  describe('splitting', () => {
    const splittable = (id: string, length: number, minPart: number, maxParts = 2): CutItem => ({ id, length, maxParts, minPart });

    it('matches a brute force that tries every split, on 120 random small cases', () => {
      const rand = rng(1124);
      for (let c = 0; c < 120; c++) {
        const n = c < 110 ? 2 + Math.floor(rand() * 2) : 4;
        const all = Array.from({ length: n }, (_, i) => {
          const length = 200 + Math.floor(rand() * 8) * 100;
          const canSplit = c < 110 || i < 2;
          return canSplit && rand() < 0.8 ? splittable(`s${i}`, length, 200 + Math.floor(rand() * 2) * 100) : item(`s${i}`, length);
        });
        const stocks: Stock[] = Array.from({ length: 1 + Math.floor(rand() * 2) }, () => {
          const length = 800 + Math.floor(rand() * 9) * 100;
          return { length, price: rand() < 0.15 ? 0 : Math.round(length * (2 + rand() * 3)) };
        });
        stocks.push({ length: 1800, price: 9000 });
        const plan = optimise(all, stocks, { kerf: 0 });
        expectAgainstBrute(plan, all, stocks, `case ${c}: ${JSON.stringify({ all, stocks })}`);
      }
    });

    it('is not fooled by a splittable piece that is cut into all its parts elsewhere (review finding)', () => {
      const stocks = [{ length: 1000, price: 100 }];
      const all = [item('a', 800), splittable('x', 700, 200), item('p', 600), item('q', 600)];
      const plan = optimise(all, stocks, { kerf: 0 });
      expect(plan.cost).toBe(bruteForceSplit(all, stocks, 0, 100)!.cost);
      expect(plan.cost).toBe(300);
      expect(plan.proven).toBe(true);
      expectValid(plan, all, stocks, 0);
    });

    it('does not claim to be proven when two pieces can be split and share a bar (review finding)', () => {
      const stocks = [{ length: 1000, price: 100 }, { length: 600, price: 70 }];
      const all = [splittable('a', 700, 200), splittable('b', 500, 200)];
      const plan = optimise(all, stocks, { kerf: 0 });
      expect(bruteForceSplit(all, stocks, 0, 100)!.cost).toBe(140);
      expect(plan.cost).toBeGreaterThanOrEqual(140);
      expect(plan.proven).toBe(false);
      expectValid(plan, all, stocks, 0);
    });

    it('matches the brute force on 150 mixed cases of splittable and whole pieces', () => {
      const rand = rng(424242);
      for (let c = 0; c < 150; c++) {
        const n = 3 + Math.floor(rand() * 2);
        let splittableLeft = 2;
        const all = Array.from({ length: n }, (_, i) => {
          const length = 200 + Math.floor(rand() * 8) * 100;
          if (splittableLeft > 0 && rand() < 0.6) {
            splittableLeft--;
            return splittable(`m${i}`, length, 200);
          }
          return item(`m${i}`, length);
        });
        const stocks: Stock[] = Array.from({ length: 1 + Math.floor(rand() * 2) }, () => {
          const length = 600 + Math.floor(rand() * 9) * 100;
          return { length, price: Math.round(length * (2 + rand() * 3)) };
        });
        stocks.push({ length: 1800, price: 9000 });
        const plan = optimise(all, stocks, { kerf: 0 });
        expectAgainstBrute(plan, all, stocks, `case ${c}: ${JSON.stringify({ all, stocks })}`);
      }
    });

    it('uses offcuts: 2500 + 2500 + 1000 takes 2 bars when pieces may be joined, 3 when they may not', () => {
      const stocks = [{ length: 3000, price: 10000 }];
      const joined = [splittable('a', 2500, 200), splittable('b', 2500, 200), splittable('c', 1000, 200)];
      const plan = optimise(joined, stocks, { kerf: 0 });
      expect(plan.bars).toHaveLength(2);
      expect(plan.bars.flatMap((b) => b.cuts).some((c) => c.part)).toBe(true);
      expectValid(plan, joined, stocks, 0);
      expect(optimise([item('a', 2500), item('b', 2500), item('c', 1000)], stocks, { kerf: 0 }).bars).toHaveLength(3);
    });

    it('makes a rail longer than any stock from the parts it needs, numbered in order', () => {
      const stocks = [{ length: 2400, price: 8900 }, { length: 3000, price: 10900 }];
      const rail = [splittable('rail', 5200, 200)];
      const plan = optimise(rail, stocks, { kerf: 3 });
      expect(plan.unfit).toEqual([]);
      expect(plan.bars).toHaveLength(2);
      expectValid(plan, rail, stocks, 3);
      expect(plan.proven).toBe(true);
    });

    it('allows a rail in three parts when two are not enough', () => {
      const stocks = [{ length: 2400, price: 8900 }];
      const rail = [splittable('rail', 6000, 200, 3)];
      const plan = optimise(rail, stocks, { kerf: 3 });
      expect(plan.bars).toHaveLength(3);
      expectValid(plan, rail, stocks, 3);
    });

    it('calls a piece unfit when even its most parts are not enough', () => {
      const plan = optimise([splittable('huge', 7000, 200)], [{ length: 3000, price: 100 }], { kerf: 3 });
      expect(plan.unfit).toEqual(['huge']);
      expect(plan.bars).toEqual([]);
    });

    it('never makes a part shorter than the minimum, with a kerf', () => {
      const rand = rng(77);
      for (let c = 0; c < 40; c++) {
        const all = Array.from({ length: 6 }, (_, i) => splittable(`k${i}`, 300 + Math.floor(rand() * 20) * 100, 300, 2));
        const stocks = [{ length: 2400, price: 8900 }, { length: 3000, price: 10900 }];
        const plan = optimise(all, stocks, { kerf: 3, deadline: Date.now() + 1500 });
        expectValid(plan, all, stocks, 3);
      }
    });

    it('returns a valid first-fit plan, split where it must be, when the deadline has passed', () => {
      const stocks = [{ length: 2400, price: 8900 }];
      const all = [splittable('rail', 5200, 200, 3), splittable('x', 1000, 200)];
      const plan = optimise(all, stocks, { kerf: 3, deadline: 0, now: () => 1000 });
      expect(plan.proven).toBe(false);
      expectValid(plan, all, stocks, 3);
    });
  });
});
